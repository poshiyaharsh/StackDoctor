import type { AiProvider } from "../types.js";
import type { AiConfig } from "../config.js";
import { MockProvider } from "../mock-provider.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAiCompatibleProvider } from "./openai-compatible.js";

/**
 * Creates the appropriate AiProvider implementation based on configuration.
 */
export function createAiProvider(config: AiConfig, fallbackMock?: AiProvider): AiProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider({
        model: config.model,
        baseUrl: config.baseUrl,
        apiKeyEnvVar: config.apiKeyEnvVar,
        maxRetries: config.maxRetries,
        responseSizeCapBytes: config.responseSizeCapBytes
      });

    case "openai":
    case "openai-compatible":
      return new OpenAiCompatibleProvider({
        id: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        apiKeyEnvVar: config.apiKeyEnvVar,
        maxRetries: config.maxRetries,
        responseSizeCapBytes: config.responseSizeCapBytes
      });

    case "mock":
      return fallbackMock || new MockProvider();

    default:
      if (fallbackMock) return fallbackMock;
      throw new Error(`Unsupported or unconfigured AI provider: ${config.provider || "none"}`);
  }
}
