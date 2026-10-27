import { z } from "zod";

export const configSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  MONGODB_URI: z.string({ required_error: "MONGODB_URI is required" }).min(1, "MONGODB_URI is required"),
  SESSION_SECRET: z
    .string({ required_error: "SESSION_SECRET is required" })
    .min(32, "SESSION_SECRET must be at least 32 characters long"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .default("false"),
  AI_ENABLED: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((val) => val === true || val === "true")
    .default(false),
  AI_PROVIDER: z.enum(["anthropic", "openai", "ollama"]).default("anthropic"),
  AI_MODEL: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_ENCRYPTION_MASTER_KEY: z
    .string()
    .min(32, "AI_ENCRYPTION_MASTER_KEY must be at least 32 characters long")
    .default("stackdoctor-default-master-key-32b-min")
});

export type ApiConfig = z.infer<typeof configSchema>;

/**
 * Parses and validates environment configuration.
 * Fails fast with clear diagnostic messages on missing or invalid variables.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`API Configuration Error:\n${errorDetails}`);
  }
  return result.data;
}
