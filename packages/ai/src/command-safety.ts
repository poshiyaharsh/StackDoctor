import type { AiExplanation } from "./schema.js";

export const DEFAULT_ALLOWLISTED_OPERATIONS = [
  "npm_install",
  "pip_install",
  "create_env_file",
  "kill_port_process",
  "create_directory"
];

// Dangerous or privileged shell command verbs and constructs
const DANGEROUS_COMMAND_PATTERNS = [
  /\bsudo\s+[^\n`]+/gi,
  /\brm(?:\s+-[rf]+|\s+--recursive|\s+--force)?\s+[^\n`]+/gi,
  /\brmdir\s+[^\n`]+/gi,
  /\bchmod\s+[^\n`]+/gi,
  /\bchown\s+[^\n`]+/gi,
  /\bkill\s+[^\n`]+/gi,
  /\bpkill\s+[^\n`]+/gi,
  /\btaskkill\s+[^\n`]+/gi,
  /\breg(?:\.exe)?\s+[^\n`]+/gi,
  /\bnetsh(?:\.exe)?\s+[^\n`]+/gi,
  /\biptables\s+[^\n`]+/gi,
  /\bformat\s+[A-Za-z]:[^\n`]*/gi,
  /\bmkfs(?:\.[a-z0-9]+)?\s+[^\n`]+/gi,
  /\b(?:curl|wget)\s+[^\n`]*\|\s*(?:bash|sh|zsh)\b[^\n`]*/gi,
  /\bpowershell(?:\.exe)?\s+-[Ee](?:ncodedCommand)?\s+[^\n`]+/gi
];

export interface CommandSanitizationResult {
  sanitizedOutput: AiExplanation;
  unverifiedSuggestions: string[];
  droppedOperationIds: string[];
}

/**
 * Scans AI explanation text for potentially dangerous shell commands,
 * strips them from displayed text, isolates them as unverified suggestions,
 * and drops any suggestedOperationIds not matching the safe allowlist.
 */
export function sanitizeCommands(
  output: AiExplanation,
  allowlistedOperations: string[] = DEFAULT_ALLOWLISTED_OPERATIONS
): CommandSanitizationResult {
  const unverifiedSuggestions: string[] = [];
  const droppedOperationIds: string[] = [];

  function sanitizeField(text: string): string {
    if (!text || typeof text !== "string") return "";

    let current = text;

    // Check code fences
    const codeFenceRegex = /```(?:bash|sh|shell|cmd|powershell)?\s*([\s\S]*?)```/gi;
    current = current.replace(codeFenceRegex, (_match, code) => {
      const trimmed = code.trim();
      unverifiedSuggestions.push(`unverified suggestion (not executable): ${trimmed}`);
      return "[COMMAND SUGGESTION REMOVED]";
    });

    // Check inline code backticks with commands (e.g. `rm -rf ...`)
    const inlineCodeRegex = /`([^`]+)`/g;
    current = current.replace(inlineCodeRegex, (match, innerCode) => {
      for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(innerCode)) {
          unverifiedSuggestions.push(`unverified suggestion (not executable): ${innerCode.trim()}`);
          return "[COMMAND SUGGESTION REMOVED]";
        }
      }
      return match;
    });

    // Check $ or > command prompt lines
    const promptRegex = /^[>$]\s+([^\n]+)$/gm;
    current = current.replace(promptRegex, (_match, cmd) => {
      unverifiedSuggestions.push(`unverified suggestion (not executable): ${cmd.trim()}`);
      return "[COMMAND SUGGESTION REMOVED]";
    });

    // Check dangerous patterns
    for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
      pattern.lastIndex = 0;
      current = current.replace(pattern, (cmdMatch) => {
        if (!cmdMatch.includes("[COMMAND SUGGESTION REMOVED]")) {
          unverifiedSuggestions.push(`unverified suggestion (not executable): ${cmdMatch.trim()}`);
        }
        return "[COMMAND SUGGESTION REMOVED]";
      });
    }

    return current;
  }

  // Clone output before sanitization
  const sanitized: AiExplanation = {
    summary: sanitizeField(output.summary),
    rootCauseRanking: output.rootCauseRanking.map((rc) => ({
      ...rc,
      cause: sanitizeField(rc.cause),
      reasoning: sanitizeField(rc.reasoning)
    })),
    confirmedFacts: output.confirmedFacts.map((cf) => ({
      ...cf,
      statement: sanitizeField(cf.statement)
    })),
    hypotheses: output.hypotheses.map((h) => ({
      statement: sanitizeField(h.statement),
      whatWouldConfirmIt: sanitizeField(h.whatWouldConfirmIt)
    })),
    checklist: output.checklist
      .map(sanitizeField)
      .filter((item) => item !== "[COMMAND SUGGESTION REMOVED]"),
    suggestedExtraChecks: output.suggestedExtraChecks
      .map(sanitizeField)
      .filter((item) => item !== "[COMMAND SUGGESTION REMOVED]"),
    suggestedOperationIds: []
  };

  // Allowlist suggestedOperationIds
  for (const opId of output.suggestedOperationIds) {
    if (allowlistedOperations.includes(opId)) {
      sanitized.suggestedOperationIds.push(opId);
    } else {
      droppedOperationIds.push(opId);
    }
  }

  return {
    sanitizedOutput: sanitized,
    unverifiedSuggestions,
    droppedOperationIds
  };
}
