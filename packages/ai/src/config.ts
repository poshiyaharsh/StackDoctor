import { z } from "zod";

/**
 * Zod schema for AI subsystem configuration.
 * Disabled by default (enabled: false) to guarantee zero unsolicited network calls.
 * Never stores or accepts the raw API key directly; stores only the environment variable NAME.
 */
export const AiConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    provider: z.enum(["anthropic", "openai", "openai-compatible", "mock"]).optional(),
    model: z.string().optional(),
    baseUrl: z.string().optional(),
    apiKeyEnvVar: z.string().default("STACKDOCTOR_AI_API_KEY"),
    maxInputBytes: z.number().int().positive().default(16_000),
    maxOutputTokens: z.number().int().positive().default(2_048),
    timeoutMs: z.number().int().positive().default(30_000),
    maxRetries: z.number().int().nonnegative().default(2),
    responseSizeCapBytes: z.number().int().positive().default(250_000)
  })
  .strict();

export type AiConfig = z.infer<typeof AiConfigSchema>;

export function createDefaultAiConfig(): AiConfig {
  return {
    enabled: false,
    provider: undefined,
    model: undefined,
    baseUrl: undefined,
    apiKeyEnvVar: "STACKDOCTOR_AI_API_KEY",
    maxInputBytes: 16_000,
    maxOutputTokens: 2_048,
    timeoutMs: 30_000,
    maxRetries: 2,
    responseSizeCapBytes: 250_000
  };
}
