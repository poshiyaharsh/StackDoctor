import type { Report, Finding, Severity, Confidence } from "@stackdoctor/schemas";
import type {
  AiProvider,
  AiInput,
  AiInputEnvironment
} from "./types.js";
import type { AiConfig } from "./config.js";
import { buildAiInput, type BuildAiInputOptions } from "./sanitizer.js";
import { buildExplanationPrompt } from "./prompt.js";
import type { AiExplanation } from "./schema.js";
import { parseAiOutput } from "./parser.js";
import { validateGrounding, type GroundingStatus } from "./grounding.js";
import { sanitizeCommands, DEFAULT_ALLOWLISTED_OPERATIONS } from "./command-safety.js";
import { buildFallbackExplanation } from "./fallback.js";

export * from "./types.js";
export * from "./mock-provider.js";
export * from "./config.js";
export * from "./schema.js";
export * from "./sanitizer.js";
export * from "./prompt.js";
export * from "./parser.js";
export * from "./grounding.js";
export * from "./command-safety.js";
export * from "./fallback.js";
export * from "./providers/http-client.js";
export * from "./providers/anthropic.js";
export * from "./providers/openai-compatible.js";
export * from "./providers/factory.js";

export interface ExplainWithAiOptions {
  provider: AiProvider;
  config: AiConfig;
  input: Report | Finding[] | AiInput | { findings: Finding[]; environment?: Partial<AiInputEnvironment> };
  sanitizerOptions?: BuildAiInputOptions;
  allowlistedOperations?: string[];
  signal?: AbortSignal;
}

export type ExplainWithAiResult =
  | {
      status: "ai_disabled";
      message: string;
      explanation: AiExplanation;
      isFallback: true;
    }
  | {
      status: "ok" | "partially_trusted" | "success";
      groundingStatus: GroundingStatus;
      explanation: AiExplanation;
      data: AiExplanation;
      raw: string;
      removed: string[];
      reasons: string[];
      unverifiedSuggestions: string[];
      isFallback: false;
    }
  | {
      status: "rejected";
      groundingStatus: "rejected";
      explanation: AiExplanation;
      error: string;
      reasons: string[];
      removed: string[];
      isFallback: true;
      raw?: string;
    }
  | {
      status: "error";
      explanation: AiExplanation;
      error: string;
      reasons: string[];
      isFallback: true;
    };

function isAiInput(val: unknown): val is AiInput {
  return (
    typeof val === "object" &&
    val !== null &&
    "findings" in val &&
    "environment" in val &&
    !("schemaVersion" in val)
  );
}

/**
 * Executes AI diagnostic explanation on findings or reports with full
 * grounding validation, command safety checks, and deterministic fallback.
 *
 * Safe-by-default: If config.enabled is false, immediately returns an 'ai_disabled' result
 * with a deterministic fallback explanation without contacting any provider.
 */
export async function explainWithAi(
  options: ExplainWithAiOptions
): Promise<ExplainWithAiResult> {
  const { provider, config, input, sanitizerOptions, allowlistedOperations = DEFAULT_ALLOWLISTED_OPERATIONS, signal } = options;

  const fallback = buildFallbackExplanation(
    isAiInput(input)
      ? {
          findings: input.findings.map((f) => ({
            ruleId: f.ruleId,
            title: f.title,
            category: f.category,
            severity: f.severity as Severity,
            confidence: f.confidence as Confidence,
            status: "failed",
            evidence: f.evidence.map((e) => ({
              id: e.id,
              kind: e.kind,
              description: "",
              observed: e.observed,
              source: "diagnostic_input",
              collectedAt: new Date().toISOString()
            })),
            possibleCauses: f.possibleCauses,
            recommendations: [],
            verificationStatus: "unverified",
            docs: []
          }))
        }
      : input
  );

  if (!config.enabled) {
    return {
      status: "ai_disabled",
      message:
        "AI explanations are disabled by default. Configure and enable AI in settings to use this feature.",
      explanation: fallback,
      isFallback: true
    };
  }

  try {
    const aiInput: AiInput = isAiInput(input)
      ? input
      : buildAiInput(input, {
          ...sanitizerOptions,
          maxInputBytes: config.maxInputBytes
        });

    const request = buildExplanationPrompt(aiInput, {
      maxOutputTokens: config.maxOutputTokens,
      timeoutMs: config.timeoutMs,
      signal
    });

    const response = await provider.complete(request);

    // 1. Parse and schema-validate
    const parsed = parseAiOutput(response.text);
    if (!parsed.success) {
      return {
        status: "error",
        error: parsed.error,
        reasons: [parsed.error],
        explanation: fallback,
        isFallback: true
      };
    }

    // 2. Grounding validation
    const grounding = validateGrounding(parsed.data, aiInput);
    if (grounding.status === "rejected" || !grounding.output) {
      return {
        status: "rejected",
        groundingStatus: "rejected",
        error: grounding.reasons.join("; ") || "AI explanation rejected by grounding checks",
        reasons: grounding.reasons,
        removed: grounding.removed,
        explanation: fallback,
        isFallback: true,
        raw: response.text
      };
    }

    // 3. Command safety sanitization
    const commandResult = sanitizeCommands(grounding.output, allowlistedOperations);

    const allRemoved = [
      ...grounding.removed,
      ...commandResult.droppedOperationIds.map((id) => `Dropped unallowlisted operation ID: ${id}`)
    ];

    return {
      status: "success",
      groundingStatus: grounding.status,
      explanation: commandResult.sanitizedOutput,
      data: commandResult.sanitizedOutput,
      raw: response.text,
      removed: allRemoved,
      reasons: grounding.reasons,
      unverifiedSuggestions: commandResult.unverifiedSuggestions,
      isFallback: false
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      error: errMsg,
      reasons: [errMsg],
      explanation: fallback,
      isFallback: true
    };
  }
}
