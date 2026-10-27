import type { AiProvider, AiRequest, AiResponse } from "../types.js";
import { resilientPost, validateEndpointUrl } from "./http-client.js";

export interface OpenAiCompatibleProviderOptions {
  id?: string;
  model?: string;
  baseUrl?: string;
  apiKeyEnvVar?: string;
  maxRetries?: number;
  responseSizeCapBytes?: number;
}

export class OpenAiCompatibleProvider implements AiProvider {
  public readonly id: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKeyEnvVar: string;
  private readonly maxRetries: number;
  private readonly responseSizeCapBytes: number;

  constructor(options: OpenAiCompatibleProviderOptions = {}) {
    this.id = options.id || "openai";
    this.model = options.model || "gpt-4o";
    this.baseUrl = options.baseUrl || "https://api.openai.com/v1/chat/completions";
    this.apiKeyEnvVar = options.apiKeyEnvVar || "OPENAI_API_KEY";
    this.maxRetries = options.maxRetries ?? 2;
    this.responseSizeCapBytes = options.responseSizeCapBytes ?? 250_000;
  }

  async complete(request: AiRequest): Promise<AiResponse> {
    const parsedUrl = validateEndpointUrl(this.baseUrl);
    const isLocalhost =
      parsedUrl.hostname === "localhost" ||
      parsedUrl.hostname === "127.0.0.1" ||
      parsedUrl.hostname === "::1";

    const apiKey = process.env[this.apiKeyEnvVar];
    if (!apiKey && !isLocalhost) {
      throw new Error(
        `AI API key not found in environment variable '${this.apiKeyEnvVar}'. Please set it in your environment before running AI operations.`
      );
    }

    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    if (apiKey) {
      headers["authorization"] = `Bearer ${apiKey}`;
    }

    const payload = JSON.stringify({
      model: this.model,
      max_tokens: request.maxOutputTokens,
      messages: [
        {
          role: "system",
          content: request.system
        },
        {
          role: "user",
          content: request.user
        }
      ]
    });

    const { text } = await resilientPost({
      url: this.baseUrl,
      headers,
      body: payload,
      timeoutMs: request.timeoutMs,
      maxRetries: this.maxRetries,
      responseSizeCapBytes: this.responseSizeCapBytes,
      signal: request.signal
    });

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Received non-JSON response from OpenAI-compatible API");
    }

    interface OpenAiPayload {
      choices?: Array<{ message?: { content?: string } }>;
    }

    const payloadObj = data as OpenAiPayload;
    if (
      Array.isArray(payloadObj?.choices) &&
      payloadObj.choices.length > 0 &&
      typeof payloadObj.choices[0]?.message?.content === "string"
    ) {
      return { text: payloadObj.choices[0].message.content };
    }

    throw new Error("OpenAI-compatible response did not contain expected choices message text");
  }
}
