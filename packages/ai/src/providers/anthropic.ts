import type { AiProvider, AiRequest, AiResponse } from "../types.js";
import { resilientPost } from "./http-client.js";

export interface AnthropicProviderOptions {
  model?: string;
  baseUrl?: string;
  apiKeyEnvVar?: string;
  apiKey?: string;
  maxRetries?: number;
  responseSizeCapBytes?: number;
}

export class AnthropicProvider implements AiProvider {
  public readonly id = "anthropic";
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKeyEnvVar: string;
  private readonly directApiKey?: string;
  private readonly maxRetries: number;
  private readonly responseSizeCapBytes: number;

  constructor(options: AnthropicProviderOptions = {}) {
    this.model = options.model || "claude-3-5-sonnet-20241022";
    this.baseUrl = options.baseUrl || "https://api.anthropic.com/v1/messages";
    this.apiKeyEnvVar = options.apiKeyEnvVar || "ANTHROPIC_API_KEY";
    this.directApiKey = options.apiKey;
    this.maxRetries = options.maxRetries ?? 2;
    this.responseSizeCapBytes = options.responseSizeCapBytes ?? 250_000;
  }

  async complete(request: AiRequest): Promise<AiResponse> {
    const apiKey = this.directApiKey || process.env[this.apiKeyEnvVar];
    if (!apiKey) {
      throw new Error(
        `AI API key not found in environment variable '${this.apiKeyEnvVar}'. Please set it in your environment before running AI operations.`
      );
    }

    const payload = JSON.stringify({
      model: this.model,
      max_tokens: request.maxOutputTokens,
      system: request.system,
      messages: [
        {
          role: "user",
          content: request.user
        }
      ]
    });

    const { text } = await resilientPost({
      url: this.baseUrl,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
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
      throw new Error("Received non-JSON response from Anthropic API");
    }

    interface AnthropicPayload {
      content?: Array<{ text?: string }>;
    }

    const payloadObj = data as AnthropicPayload;
    if (
      Array.isArray(payloadObj?.content) &&
      payloadObj.content.length > 0 &&
      typeof payloadObj.content[0]?.text === "string"
    ) {
      return { text: payloadObj.content[0].text };
    }

    throw new Error("Anthropic response did not contain expected content text structure");
  }
}
