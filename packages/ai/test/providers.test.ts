import http from "node:http";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import {
  AnthropicProvider,
  OpenAiCompatibleProvider,
  createAiProvider,
  validateEndpointUrl,
  resilientPost,
  AiConfigSchema
} from "../src/index.js";

describe("@stackdoctor/ai - Providers and HTTP Safety (Run 5C)", () => {
  let server: http.Server;
  let serverPort: number;
  let serverUrl: string;
  let requestCounter = 0;
  let simulateStatus = 200;
  let simulateResponseText = "";
  let receivedHeaders: http.IncomingHttpHeaders = {};
  let receivedBody = "";

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      requestCounter++;
      receivedHeaders = req.headers;
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        receivedBody = body;
        res.writeHead(simulateStatus, { "content-type": "application/json" });
        res.end(simulateResponseText);
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr) {
          serverPort = addr.port;
          serverUrl = `http://127.0.0.1:${serverPort}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("1. enforces HTTPS for remote hosts while permitting HTTP for localhost/127.0.0.1", () => {
    // Permitted: local http
    expect(() => validateEndpointUrl("http://localhost:11434/v1/chat/completions")).not.toThrow();
    expect(() => validateEndpointUrl("http://127.0.0.1:8000/v1/messages")).not.toThrow();
    // Permitted: remote https
    expect(() => validateEndpointUrl("https://api.anthropic.com/v1/messages")).not.toThrow();
    expect(() => validateEndpointUrl("https://api.openai.com/v1/chat/completions")).not.toThrow();

    // Refused: remote insecure http
    expect(() => validateEndpointUrl("http://api.anthropic.com/v1/messages")).toThrow(
      "Insecure HTTP connection disallowed"
    );
    expect(() => validateEndpointUrl("http://external-llm-service.com/v1")).toThrow(
      "Insecure HTTP connection disallowed"
    );
  });

  it("2. retries with exponential backoff on 429 rate limit then fails safely", async () => {
    requestCounter = 0;
    simulateStatus = 429;
    simulateResponseText = JSON.stringify({ error: "Rate limit exceeded" });

    await expect(
      resilientPost({
        url: serverUrl,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "test" }),
        timeoutMs: 5000,
        maxRetries: 2
      })
    ).rejects.toThrow("error status 429 (attempted 3 times)");

    // 1 initial + 2 retries = 3 total attempts
    expect(requestCounter).toBe(3);
  });

  it("3. rejects responses exceeding the maximum response size cap", async () => {
    requestCounter = 0;
    simulateStatus = 200;
    // 50KB payload
    simulateResponseText = "X".repeat(50_000);

    await expect(
      resilientPost({
        url: serverUrl,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "test" }),
        timeoutMs: 5000,
        maxRetries: 0,
        responseSizeCapBytes: 10_000 // Cap at 10KB
      })
    ).rejects.toThrow("exceeded maximum allowed size cap of 10000 bytes");
  });

  it("4. AnthropicProvider reads key from configured env var and sends proper headers", async () => {
    const CANARY_ANTHROPIC_KEY = "sk-ant-canary-test-key-9999999999";
    process.env.TEST_CUSTOM_ANTHROPIC_KEY = CANARY_ANTHROPIC_KEY;

    requestCounter = 0;
    simulateStatus = 200;
    simulateResponseText = JSON.stringify({
      id: "msg-123",
      content: [{ type: "text", text: JSON.stringify({ summary: "Anthropic response" }) }]
    });

    const provider = new AnthropicProvider({
      baseUrl: `${serverUrl}/v1/messages`,
      apiKeyEnvVar: "TEST_CUSTOM_ANTHROPIC_KEY",
      model: "claude-3-5-sonnet-20241022"
    });

    const res = await provider.complete({
      system: "System instructions",
      user: "User prompt",
      maxOutputTokens: 1000,
      timeoutMs: 5000
    });

    expect(res.text).toContain("Anthropic response");
    expect(receivedHeaders["x-api-key"]).toBe(CANARY_ANTHROPIC_KEY);
    expect(receivedHeaders["anthropic-version"]).toBe("2023-06-01");

    delete process.env.TEST_CUSTOM_ANTHROPIC_KEY;
  });

  it("5. OpenAiCompatibleProvider handles local Ollama connection without requiring remote API key", async () => {
    requestCounter = 0;
    simulateStatus = 200;
    simulateResponseText = JSON.stringify({
      id: "chatcmpl-123",
      choices: [{ message: { content: JSON.stringify({ summary: "Local Ollama response" }) } }]
    });

    const provider = new OpenAiCompatibleProvider({
      id: "ollama",
      baseUrl: `${serverUrl}/v1/chat/completions`,
      apiKeyEnvVar: "NON_EXISTENT_ENV_KEY",
      model: "llama3"
    });

    const res = await provider.complete({
      system: "System instructions",
      user: "User prompt",
      maxOutputTokens: 1000,
      timeoutMs: 5000
    });

    expect(res.text).toContain("Local Ollama response");
    const parsedReq = JSON.parse(receivedBody);
    expect(parsedReq.model).toBe("llama3");
    expect(parsedReq.messages).toHaveLength(2);
  });

  it("6. API key never appears in error messages when request fails", async () => {
    const CANARY_KEY = "sk-ant-secret-canary-do-not-leak-9999";
    process.env.SECRET_CANARY_ENV = CANARY_KEY;

    // Point to non-routable host to trigger network failure
    const provider = new AnthropicProvider({
      baseUrl: "https://127.0.0.1:59999/unreachable",
      apiKeyEnvVar: "SECRET_CANARY_ENV"
    });

    let errorThrown: Error | null = null;
    try {
      await provider.complete({
        system: "test",
        user: "test",
        maxOutputTokens: 100,
        timeoutMs: 500
      });
    } catch (err) {
      errorThrown = err as Error;
    }

    expect(errorThrown).not.toBeNull();
    // Invariant: The canary key must NEVER leak in error messages
    expect(errorThrown!.message).not.toContain(CANARY_KEY);

    delete process.env.SECRET_CANARY_ENV;
  });

  it("7. createAiProvider factory builds expected provider from config", () => {
    const anthropicConfig = AiConfigSchema.parse({
      enabled: true,
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022"
    });
    const p1 = createAiProvider(anthropicConfig);
    expect(p1.id).toBe("anthropic");

    const openaiConfig = AiConfigSchema.parse({
      enabled: true,
      provider: "openai",
      model: "gpt-4o"
    });
    const p2 = createAiProvider(openaiConfig);
    expect(p2.id).toBe("openai");
  });
});
