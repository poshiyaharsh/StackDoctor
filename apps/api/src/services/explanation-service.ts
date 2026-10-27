import crypto from "node:crypto";
import type { Finding } from "@stackdoctor/schemas";
import {
  explainWithAi,
  createAiProvider,
  buildFallbackExplanation,
  DEFAULT_AI_CONFIG,
  type AiConfig,
  type AiProvider
} from "@stackdoctor/ai";
import { Explanation } from "../models/explanation.js";
import type { UserDocument } from "../models/user.js";
import type { DiagnosticRunDocument } from "../models/diagnostic-run.js";
import { decryptApiKey } from "../lib/ai-crypto.js";
import type { ApiConfig } from "../config.js";

// Rate limiting & quota state
const userWindows = new Map<string, { count: number; resetAt: number }>();
const ipWindows = new Map<string, { count: number; resetAt: number }>();
const userDailyQuotas = new Map<string, { count: number; resetAt: number }>();
const activeUserJobs = new Map<string, number>();

export interface ExplanationRateLimitConfig {
  maxPerMinutePerUser: number;
  maxPerMinutePerIp: number;
  dailyQuotaPerUser: number;
  maxConcurrentPerUser: number;
}

export const DEFAULT_AI_LIMITS: ExplanationRateLimitConfig = {
  maxPerMinutePerUser: 10,
  maxPerMinutePerIp: 20,
  dailyQuotaPerUser: 50,
  maxConcurrentPerUser: 2
};

export function resetAiRateLimits(): void {
  userWindows.clear();
  ipWindows.clear();
  userDailyQuotas.clear();
  activeUserJobs.clear();
}

let customTestProvider: AiProvider | undefined;

export function setCustomTestProvider(provider?: AiProvider): void {
  customTestProvider = provider;
}

export function getCustomTestProvider(): AiProvider | undefined {
  return customTestProvider;
}

/**
 * Checks in-memory sliding window rate limits, daily quotas, and concurrent jobs.
 * Acquires a slot if allowed.
 */
export function checkAndAcquireExplanationSlot(
  userId: string,
  ip: string,
  limits: ExplanationRateLimitConfig = DEFAULT_AI_LIMITS
): { allowed: boolean; reason?: string; retryAfter?: number } {
  const now = Date.now();

  // 1. Max concurrent jobs per user
  const activeJobs = activeUserJobs.get(userId) || 0;
  if (activeJobs >= limits.maxConcurrentPerUser) {
    return {
      allowed: false,
      reason: "Maximum concurrent explanation jobs reached. Please wait for current job to finish."
    };
  }

  // 2. Per-user minute rate limit
  let userEntry = userWindows.get(userId);
  if (!userEntry || now > userEntry.resetAt) {
    userEntry = { count: 0, resetAt: now + 60 * 1000 };
    userWindows.set(userId, userEntry);
  }
  if (userEntry.count >= limits.maxPerMinutePerUser) {
    const retryAfter = Math.ceil((userEntry.resetAt - now) / 1000);
    return {
      allowed: false,
      reason: "Rate limit exceeded for user. Please wait before requesting another explanation.",
      retryAfter
    };
  }

  // 3. Per-IP minute rate limit
  let ipEntry = ipWindows.get(ip);
  if (!ipEntry || now > ipEntry.resetAt) {
    ipEntry = { count: 0, resetAt: now + 60 * 1000 };
    ipWindows.set(ip, ipEntry);
  }
  if (ipEntry.count >= limits.maxPerMinutePerIp) {
    const retryAfter = Math.ceil((ipEntry.resetAt - now) / 1000);
    return {
      allowed: false,
      reason: "Rate limit exceeded for IP. Please wait before requesting another explanation.",
      retryAfter
    };
  }

  // 4. Daily quota per user (24h sliding/fixed window)
  let quotaEntry = userDailyQuotas.get(userId);
  if (!quotaEntry || now > quotaEntry.resetAt) {
    quotaEntry = { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
    userDailyQuotas.set(userId, quotaEntry);
  }
  if (quotaEntry.count >= limits.dailyQuotaPerUser) {
    return {
      allowed: false,
      reason: "Daily AI explanation quota exceeded. Please try again tomorrow."
    };
  }

  // Increment usage counters
  userEntry.count++;
  ipEntry.count++;
  quotaEntry.count++;
  activeUserJobs.set(userId, activeJobs + 1);

  return { allowed: true };
}

export function releaseExplanationSlot(userId: string): void {
  const activeJobs = activeUserJobs.get(userId) || 0;
  if (activeJobs <= 1) {
    activeUserJobs.delete(userId);
  } else {
    activeUserJobs.set(userId, activeJobs - 1);
  }
}

export interface ResolvedAiRuntime {
  enabled: boolean;
  provider?: AiProvider;
  model: string;
  config: AiConfig;
}

export function resolveAiRuntime(
  user: UserDocument,
  apiConfig: ApiConfig
): ResolvedAiRuntime {
  // 1. User BYOK takes precedence if user has AI enabled and key configured
  const userAi = user.aiSettings;
  if (userAi?.enabled && userAi?.encryptedKey && userAi?.iv && userAi?.tag) {
    try {
      const decryptedKey = decryptApiKey(
        {
          ciphertext: userAi.encryptedKey,
          iv: userAi.iv,
          tag: userAi.tag
        },
        apiConfig.AI_ENCRYPTION_MASTER_KEY
      );

      const providerType = userAi.provider || "anthropic";
      const mappedProvider: "anthropic" | "openai" | "openai-compatible" =
        providerType === "ollama" ? "openai-compatible" : providerType;
      const model = userAi.model || (providerType === "anthropic" ? "claude-3-5-sonnet-20241022" : "gpt-4o");

      const provider = createAiProvider({
        provider: mappedProvider,
        model,
        apiKey: decryptedKey
      });

      return {
        enabled: true,
        provider,
        model,
        config: {
          ...DEFAULT_AI_CONFIG,
          enabled: true,
          provider: mappedProvider,
          model,
          maxOutputTokens: 2048,
          timeoutMs: 30000
        }
      };
    } catch {
      // If decryption fails, fall back to disabled
    }
  }

  // 2. Server-level AI configuration
  if (apiConfig.AI_ENABLED && apiConfig.AI_API_KEY) {
    const providerType = apiConfig.AI_PROVIDER;
    const mappedProvider: "anthropic" | "openai" | "openai-compatible" =
      providerType === "ollama" ? "openai-compatible" : providerType;
    const model = apiConfig.AI_MODEL || (providerType === "anthropic" ? "claude-3-5-sonnet-20241022" : "gpt-4o");

    const provider = createAiProvider({
      provider: mappedProvider,
      model,
      baseUrl: apiConfig.AI_BASE_URL,
      apiKey: apiConfig.AI_API_KEY
    });

    return {
      enabled: true,
      provider,
      model,
      config: {
        ...DEFAULT_AI_CONFIG,
        enabled: true,
        provider: mappedProvider,
        model,
        baseUrl: apiConfig.AI_BASE_URL,
        maxOutputTokens: 2048,
        timeoutMs: 30000
      }
    };
  }

  // 3. AI is disabled
  return {
    enabled: false,
    model: "fallback",
    config: {
      ...DEFAULT_AI_CONFIG,
      enabled: false,
      provider: "anthropic",
      model: "none"
    }
  };
}

export interface ExplanationResponse {
  ai: boolean;
  status: "success" | "fallback";
  explanation: Record<string, unknown>;
  removed: string[];
  reasons: string[];
  unverifiedSuggestions: string[];
  cached: boolean;
}

/**
 * Executes or retrieves cached diagnostic explanation for a given diagnostic run.
 * Strictly uses the stored findings and operating system from the database.
 */
export async function getOrGenerateExplanation(options: {
  run: DiagnosticRunDocument;
  user: UserDocument;
  apiConfig: ApiConfig;
  customProvider?: AiProvider;
  customModel?: string;
}): Promise<ExplanationResponse> {
  const { run, user, apiConfig, customProvider, customModel } = options;

  const reportHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(run.findings || []))
    .digest("hex");

  const testProvider = customProvider || customTestProvider;
  let runtime: ResolvedAiRuntime;
  if (testProvider) {
    const model = customModel || "mock-model";
    runtime = {
      enabled: true,
      provider: testProvider,
      model,
      config: {
        ...DEFAULT_AI_CONFIG,
        enabled: true,
        provider: "anthropic",
        model,
        maxOutputTokens: 2048,
        timeoutMs: 30000
      }
    };
  } else {
    runtime = resolveAiRuntime(user, apiConfig);
  }

  // 1. Check cached explanation per (runId, reportHash, aiModel)
  const cachedDoc = await Explanation.findOne({
    runId: run._id,
    reportHash,
    aiModel: runtime.model
  });

  if (cachedDoc) {
    return {
      ai: cachedDoc.ai,
      status: cachedDoc.status,
      explanation: cachedDoc.explanation,
      removed: cachedDoc.removed || [],
      reasons: cachedDoc.reasons || [],
      unverifiedSuggestions: cachedDoc.unverifiedSuggestions || [],
      cached: true
    };
  }

  // 2. If AI is disabled on both server and account, return and cache deterministic fallback
  if (!runtime.enabled || !runtime.provider) {
    const fallback = buildFallbackExplanation({
      findings: (run.findings || []) as Finding[]
    });
    const fallbackData = fallback as unknown as Record<string, unknown>;

    await Explanation.create({
      ownerId: user._id,
      runId: run._id,
      reportHash,
      aiModel: runtime.model,
      status: "fallback",
      ai: false,
      explanation: fallbackData,
      removed: [],
      reasons: ["AI is disabled on this server and account"],
      unverifiedSuggestions: []
    });

    return {
      ai: false,
      status: "fallback",
      explanation: fallbackData,
      removed: [],
      reasons: ["AI is disabled on this server and account"],
      unverifiedSuggestions: [],
      cached: false
    };
  }

  // 3. Generate explanation using pipeline from @stackdoctor/ai
  const result = await explainWithAi({
    provider: runtime.provider,
    config: runtime.config,
    input: {
      findings: (run.findings || []) as Finding[],
      environment: {
        osFamily: run.operatingSystem || "unknown",
        runtimeVersions: []
      }
    }
  });

  const isSuccess =
    result.status === "success" || result.status === "ok" || result.status === "partially_trusted";
  const explanationData = result.explanation as unknown as Record<string, unknown>;
  const removed = "removed" in result && Array.isArray(result.removed) ? result.removed : [];
  const reasons = "reasons" in result && Array.isArray(result.reasons) ? result.reasons : [];
  const unverifiedSuggestions =
    "unverifiedSuggestions" in result && Array.isArray(result.unverifiedSuggestions)
      ? result.unverifiedSuggestions
      : [];

  // 4. Cache in database
  await Explanation.create({
    ownerId: user._id,
    runId: run._id,
    reportHash,
    aiModel: runtime.model,
    status: isSuccess ? "success" : "fallback",
    ai: isSuccess,
    explanation: explanationData,
    removed,
    reasons,
    unverifiedSuggestions
  });

  return {
    ai: isSuccess,
    status: isSuccess ? "success" : "fallback",
    explanation: explanationData,
    removed,
    reasons,
    unverifiedSuggestions,
    cached: false
  };
}
