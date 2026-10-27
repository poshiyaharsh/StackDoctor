import { AiExplanationSchema, type AiExplanation } from "./schema.js";

export type ParseAiOutputResult =
  | { success: true; data: AiExplanation }
  | { success: false; error: string };

/**
 * Extracts and parses JSON from AI output text, tolerating markdown code fences.
 * Validates strictly against AiExplanationSchema.
 * Never produces partial trust on invalid output or schema violations.
 */
export function parseAiOutput(text: string): ParseAiOutputResult {
  if (!text || typeof text !== "string") {
    return { success: false, error: "Empty or invalid response received from AI provider" };
  }

  let cleaned = text.trim();

  // Strip markdown code fences (```json ... ``` or ``` ...)
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(codeBlockRegex);
  if (match) {
    cleaned = match[1].trim();
  } else {
    // If text contains JSON object wrapped in pre/post text, locate outermost braces
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Invalid JSON syntax: ${msg}` };
  }

  const result = AiExplanationSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `[${issue.path.join(".")}] ${issue.message}`)
      .join("; ");
    return {
      success: false,
      error: `schema validation failed: ${errors}`
    };
  }

  return { success: true, data: result.data };
}
