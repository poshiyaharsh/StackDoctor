import { z } from "zod";

/**
 * Zod schema for AI subsystem configuration.
 * Disabled by default (enabled: false) to guarantee zero unsolicited network calls.
 */
export const AiConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    provider: z.string().optional(),
    model: z.string().optional(),
    maxInputBytes: z.number().int().positive().default(16_000),
    maxOutputTokens: z.number().int().positive().default(2_048),
    timeoutMs: z.number().int().positive().default(30_000)
  })
  .strict();

export type AiConfig = z.infer<typeof AiConfigSchema>;

export function createDefaultAiConfig(): AiConfig {
  return {
    enabled: false,
    provider: undefined,
    model: undefined,
    maxInputBytes: 16_000,
    maxOutputTokens: 2_048,
    timeoutMs: 30_000
  };
}
