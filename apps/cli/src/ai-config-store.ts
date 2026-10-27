import fs from "node:fs";
import path from "node:path";
import { getConfigDir } from "./config-store.js";
import type { AiConfig } from "@stackdoctor/ai";

export interface StoredAiConfig {
  enabled: boolean;
  provider?: "anthropic" | "openai" | "openai-compatible" | "mock";
  model?: string;
  baseUrl?: string;
  apiKeyEnvVar?: string;
  maxInputBytes?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export function getAiConfigFilePath(): string {
  return path.join(getConfigDir(), "ai.json");
}

export function loadStoredAiConfig(): StoredAiConfig {
  const filePath = getAiConfigFilePath();
  if (!fs.existsSync(filePath)) {
    return {
      enabled: false,
      apiKeyEnvVar: "STACKDOCTOR_AI_API_KEY"
    };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      provider: parsed.provider,
      model: parsed.model,
      baseUrl: parsed.baseUrl,
      apiKeyEnvVar: parsed.apiKeyEnvVar || "STACKDOCTOR_AI_API_KEY",
      maxInputBytes: parsed.maxInputBytes,
      maxOutputTokens: parsed.maxOutputTokens,
      timeoutMs: parsed.timeoutMs
    };
  } catch {
    return {
      enabled: false,
      apiKeyEnvVar: "STACKDOCTOR_AI_API_KEY"
    };
  }
}

export function saveStoredAiConfig(config: StoredAiConfig): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const filePath = getAiConfigFilePath();
  // Never save raw keys - only provider, model, baseUrl, and env var name
  const safeData: StoredAiConfig = {
    enabled: Boolean(config.enabled),
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    apiKeyEnvVar: config.apiKeyEnvVar || "STACKDOCTOR_AI_API_KEY",
    maxInputBytes: config.maxInputBytes,
    maxOutputTokens: config.maxOutputTokens,
    timeoutMs: config.timeoutMs
  };

  fs.writeFileSync(filePath, JSON.stringify(safeData, null, 2), {
    mode: 0o600
  });
}

export function toAiConfig(stored: StoredAiConfig, overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    enabled: overrides.enabled ?? stored.enabled ?? false,
    provider: overrides.provider ?? stored.provider,
    model: overrides.model ?? stored.model,
    baseUrl: overrides.baseUrl ?? stored.baseUrl,
    apiKeyEnvVar: overrides.apiKeyEnvVar ?? stored.apiKeyEnvVar ?? "STACKDOCTOR_AI_API_KEY",
    maxInputBytes: overrides.maxInputBytes ?? stored.maxInputBytes ?? 16000,
    maxOutputTokens: overrides.maxOutputTokens ?? stored.maxOutputTokens ?? 2048,
    timeoutMs: overrides.timeoutMs ?? stored.timeoutMs ?? 30000,
    maxRetries: overrides.maxRetries ?? 2,
    responseSizeCapBytes: overrides.responseSizeCapBytes ?? 250000
  };
}
