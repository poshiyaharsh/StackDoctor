import type { Report, Finding } from "@stackdoctor/schemas";
import type {
  AiProvider,
  AiResult,
  AiInput,
  AiInputEnvironment
} from "./types.js";
import type { AiConfig } from "./config.js";
import { buildAiInput, type BuildAiInputOptions } from "./sanitizer.js";
import { buildExplanationPrompt } from "./prompt.js";
import { AiExplanationSchema, type AiExplanation } from "./schema.js";

export * from "./types.js";
export * from "./mock-provider.js";
export * from "./config.js";
export * from "./schema.js";
export * from "./sanitizer.js";
export * from "./prompt.js";

export interface ExplainWithAiOptions {
  provider: AiProvider;
  config: AiConfig;
  input: Report | Finding[] | AiInput | { findings: Finding[]; environment?: Partial<AiInputEnvironment> };
  sanitizerOptions?: BuildAiInputOptions;
  signal?: AbortSignal;
}

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
 * Strips markdown code block wrappers (e.g. ```json ... ```) if present.
 */
function cleanJsonOutput(text: string): string {
  const trimmed = text.trim();
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return trimmed;
}

/**
 * Executes AI diagnostic explanation on findings or reports.
 *
 * Safe-by-default: If config.enabled is false, immediately returns an 'ai_disabled' result
 * without making any network calls or contacting any provider.
 */
export async function explainWithAi(
  options: ExplainWithAiOptions
): Promise<AiResult<AiExplanation>> {
  const { provider, config, input, sanitizerOptions, signal } = options;

  if (!config.enabled) {
    return {
      status: "ai_disabled",
      message:
        "AI explanations are disabled by default. Configure and enable AI in settings to use this feature."
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
    const cleanedText = cleanJsonOutput(response.text);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleanedText);
    } catch (parseErr) {
      const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      return {
        status: "error",
        error: `Failed to parse AI response as JSON: ${errMsg}`
      };
    }

    const validation = AiExplanationSchema.safeParse(parsedJson);
    if (!validation.success) {
      const issues = validation.error.issues
        .map((iss) => `[${iss.path.join(".")}] ${iss.message}`)
        .join("; ");
      return {
        status: "error",
        error: `AI response failed schema validation: ${issues}`
      };
    }

    return {
      status: "success",
      data: validation.data,
      raw: response.text
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      error: errMsg
    };
  }
}
