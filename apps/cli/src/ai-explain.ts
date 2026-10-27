import readline from "node:readline";
import type { Report, Finding } from "@stackdoctor/schemas";
import {
  buildAiInput,
  explainWithAi,
  createAiProvider,
  buildFallbackExplanation,
  type AiConfig,
  type AiInput,
  type ExplainWithAiResult,
  type AiProvider
} from "@stackdoctor/ai";
import {
  loadStoredAiConfig,
  saveStoredAiConfig,
  toAiConfig,
  type StoredAiConfig
} from "./ai-config-store.js";

export interface AiExplainCliOptions {
  targetPath?: string;
  report?: Report;
  findings?: Finding[];
  provider?: "anthropic" | "openai" | "openai-compatible" | "mock";
  model?: string;
  baseUrl?: string;
  keyEnv?: string;
  yes?: boolean;
  showPayload?: boolean;
  json?: boolean;
  customMockProvider?: AiProvider;
}

/**
 * Formats the consent preview showing precisely what data will be sent and to whom.
 */
export function formatConsentPreview(
  aiInput: AiInput,
  config: AiConfig,
  showFullPayload = false
): string {
  const isLocal =
    config.baseUrl &&
    (config.baseUrl.includes("localhost") ||
      config.baseUrl.includes("127.0.0.1") ||
      config.baseUrl.includes("::1"));

  const keyIsSet = config.apiKeyEnvVar && process.env[config.apiKeyEnvVar] ? "[SET]" : "[NOT SET]";
  const providerLabel = isLocal
    ? `${config.provider || "local"} (Localhost / Ollama connection)`
    : `${config.provider || "unconfigured"} (Remote HTTPS connection)`;

  const serialized = JSON.stringify(aiInput, null, 2);
  const byteSize = Buffer.byteLength(serialized, "utf-8");

  const lines: string[] = [
    "======================================================",
    "                StackDoctor AI Consent Preview        ",
    "======================================================",
    `Provider       : ${providerLabel}`,
    `Model          : ${config.model || "default"}`,
    `API Key Source : Process Environment ($${config.apiKeyEnvVar}) ${keyIsSet}`,
    `Payload Size   : ${byteSize.toLocaleString()} bytes (sanitized & secret-redacted)`,
    `Findings Count : ${aiInput.findings.length} finding(s)`,
    `Environment    : ${aiInput.environment.osFamily} (${aiInput.environment.runtimeVersions.join(", ") || "none detected"})`,
    "",
    "Findings to be Transmitted:"
  ];

  for (const f of aiInput.findings) {
    lines.push(`  • [${f.severity.toUpperCase()}] ${f.title} (${f.ruleId})`);
    for (const ev of f.evidence) {
      lines.push(`    Evidence: ${ev.id} (${ev.kind})`);
    }
  }

  lines.push("");
  lines.push("Privacy Guarantees:");
  lines.push("  ✓ Absolute paths, user home directories, and hostnames stripped");
  lines.push("  ✓ Secrets, API keys, tokens, and credentials redacted");
  lines.push("  ✓ Only strictly allowlisted diagnostic fields transmitted");
  lines.push("  ✓ Data tagged as untrusted telemetry (cannot execute commands)");
  lines.push("======================================================");

  if (showFullPayload) {
    lines.push("");
    lines.push("--- Full Sanitized Payload JSON ---");
    lines.push(serialized);
    lines.push("-----------------------------------");
  }

  return lines.join("\n");
}

/**
 * Formats the AI explanation or deterministic fallback for terminal display.
 */
export function formatAiExplanationTerminal(result: ExplainWithAiResult): string {
  const lines: string[] = [];

  lines.push("======================================================");
  if (result.isFallback) {
    lines.push("        StackDoctor Diagnostic Explanation (FALLBACK) ");
  } else {
    lines.push("    AI-Generated Diagnostic Explanation (UNVERIFIED)  ");
  }
  lines.push("======================================================");

  if (result.isFallback) {
    const reasonText =
      "reasons" in result && result.reasons?.length > 0
        ? result.reasons.join("; ")
        : "error" in result && result.error
        ? result.error
        : "message" in result && result.message
        ? result.message
        : "AI unconfigured or disabled";
    lines.push(`Notice: Showing deterministic explanation. Reason: ${reasonText}`);
    lines.push("");
  } else {
    lines.push("Notice: AI-generated explanation. Verify before acting.");
    if ("removed" in result && result.removed?.length > 0) {
      lines.push(`Notice: ${result.removed.length} item(s) downgraded or removed by grounding checks:`);
      for (const rem of result.removed) {
        lines.push(`  - ${rem}`);
      }
    }
    lines.push("");
  }

  const exp = result.explanation;

  // Summary
  lines.push("--- Summary ---");
  lines.push(exp.summary);
  lines.push("");

  // Confirmed facts
  lines.push("--- Confirmed Facts (Grounded in Evidence) ---");
  if (exp.confirmedFacts.length === 0) {
    lines.push("  No confirmed facts available.");
  } else {
    for (const fact of exp.confirmedFacts) {
      lines.push(`  • ${fact.statement} (Citing: ${fact.evidenceIds.join(", ")})`);
    }
  }
  lines.push("");

  // Probabilistic hypotheses
  lines.push("--- Probabilistic Hypotheses ---");
  if (exp.hypotheses.length === 0) {
    lines.push("  No hypotheses generated.");
  } else {
    for (const h of exp.hypotheses) {
      lines.push(`  • ${h.statement}`);
      lines.push(`    How to confirm: ${h.whatWouldConfirmIt}`);
    }
  }
  lines.push("");

  // Root cause ranking
  lines.push("--- Root Cause Ranking ---");
  if (exp.rootCauseRanking.length === 0) {
    lines.push("  No ranked root causes available.");
  } else {
    for (const rc of exp.rootCauseRanking) {
      lines.push(`  [${rc.likelihood.toUpperCase()}] ${rc.cause}`);
      lines.push(`    Reasoning: ${rc.reasoning}`);
      if (rc.supportingEvidenceIds.length > 0) {
        lines.push(`    Supporting Evidence: ${rc.supportingEvidenceIds.join(", ")}`);
      }
    }
  }
  lines.push("");

  // Checklist
  lines.push("--- Remediation Checklist ---");
  if (exp.checklist.length === 0) {
    lines.push("  No checklist items.");
  } else {
    for (const item of exp.checklist) {
      lines.push(`  [ ] ${item}`);
    }
  }
  lines.push("");

  // Extra checks
  if (exp.suggestedExtraChecks.length > 0) {
    lines.push("--- Suggested Extra Verification Checks ---");
    for (const check of exp.suggestedExtraChecks) {
      lines.push(`  • ${check}`);
    }
    lines.push("");
  }

  // Quarantined command suggestions if any
  if ("unverifiedSuggestions" in result && result.unverifiedSuggestions?.length > 0) {
    lines.push("--- Unverified Command Suggestions (NOT EXECUTABLE) ---");
    for (const sug of result.unverifiedSuggestions) {
      lines.push(`  ⚠️  ${sug}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Prompts user for interactive confirmation.
 */
async function promptConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolve(trimmed === "y" || trimmed === "yes");
    });
  });
}

/**
 * Handles `stackdoctor ai setup` CLI command.
 */
export async function handleAiSetup(options: {
  provider?: "anthropic" | "openai" | "openai-compatible" | "mock";
  model?: string;
  baseUrl?: string;
  keyEnv?: string;
  yes?: boolean;
}): Promise<number> {
  console.log("======================================================");
  console.log("            StackDoctor AI Configuration Setup         ");
  console.log("======================================================");
  console.log("AI explanations are an optional feature.");
  console.log("Your diagnostic telemetry is strictly sanitized before leaving your machine.");
  console.log("API keys are loaded directly from process environment variables and");
  console.log("are NEVER stored in files or transmitted in telemetry.");
  console.log("======================================================\n");

  const stored = loadStoredAiConfig();

  const provider = options.provider || stored.provider || "anthropic";
  const defaultModel =
    provider === "anthropic"
      ? "claude-3-5-sonnet-20241022"
      : provider === "openai"
      ? "gpt-4o"
      : "llama3";
  const model = options.model || stored.model || defaultModel;
  const baseUrl = options.baseUrl || stored.baseUrl;
  const apiKeyEnvVar =
    options.keyEnv ||
    stored.apiKeyEnvVar ||
    (provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY");

  const newConfig: StoredAiConfig = {
    enabled: true,
    provider,
    model,
    baseUrl,
    apiKeyEnvVar
  };

  saveStoredAiConfig(newConfig);

  console.log("AI configuration saved successfully!");
  console.log(`Status         : Enabled`);
  console.log(`Provider       : ${provider}`);
  console.log(`Model          : ${model}`);
  if (baseUrl) {
    console.log(`Base URL       : ${baseUrl}`);
  }
  console.log(`Key Env Var    : $${apiKeyEnvVar}`);
  const keySet = process.env[apiKeyEnvVar] ? "[SET]" : "[NOT SET]";
  console.log(`Key Status     : ${keySet} in current environment`);
  console.log("\nTo use: run 'stackdoctor ai-explain'");
  return 0;
}

/**
 * Handles `stackdoctor ai status` CLI command.
 */
export function handleAiStatus(): number {
  const stored = loadStoredAiConfig();
  console.log("======================================================");
  console.log("             StackDoctor AI Configuration Status       ");
  console.log("======================================================");
  console.log(`Status         : ${stored.enabled ? "Enabled" : "Disabled"}`);
  console.log(`Provider       : ${stored.provider || "Not configured"}`);
  console.log(`Model          : ${stored.model || "Not configured"}`);
  if (stored.baseUrl) {
    console.log(`Base URL       : ${stored.baseUrl}`);
  }
  const keyEnv = stored.apiKeyEnvVar || "STACKDOCTOR_AI_API_KEY";
  console.log(`Key Env Var    : $${keyEnv}`);
  const isSet = process.env[keyEnv] ? "[SET]" : "[NOT SET]";
  console.log(`Key Status     : ${isSet} in current environment`);
  console.log("======================================================");
  return 0;
}

/**
 * Handles `stackdoctor ai-explain` CLI command.
 */
export async function handleAiExplain(
  options: AiExplainCliOptions
): Promise<number> {
  const stored = loadStoredAiConfig();

  const config = toAiConfig(stored, {
    enabled: stored.enabled || options.provider !== undefined,
    provider: options.provider,
    model: options.model,
    baseUrl: options.baseUrl,
    apiKeyEnvVar: options.keyEnv
  });

  const findings = options.findings || options.report?.findings || [];
  const reportOrFindings = options.report || findings;

  // 1. If AI is not configured or disabled, show fallback
  if (!config.enabled || !config.provider) {
    const fallback = buildFallbackExplanation(reportOrFindings);
    const disabledResult: ExplainWithAiResult = {
      status: "ai_disabled",
      message: "AI explanations are unconfigured or disabled. To configure, run 'stackdoctor ai setup'.",
      explanation: fallback,
      isFallback: true
    };

    if (options.json) {
      console.log(JSON.stringify(disabledResult, null, 2));
    } else {
      console.log(formatAiExplanationTerminal(disabledResult));
    }
    return 0;
  }

  // 2. Build sanitized AI input
  const aiInput = buildAiInput(reportOrFindings, {
    maxInputBytes: config.maxInputBytes
  });

  // 3. Show consent preview
  if (!options.json) {
    const preview = formatConsentPreview(aiInput, config, options.showPayload);
    console.log(preview);
  }

  // 4. Require explicit confirmation unless --yes is passed
  if (!options.yes) {
    const confirmed = await promptConfirmation("\nSend this sanitized diagnostic telemetry for AI explanation? (y/N): ");
    if (!confirmed) {
      console.log("\nOperation cancelled by user. Showing deterministic explanation:");
      const fallback = buildFallbackExplanation(reportOrFindings);
      const cancelledResult: ExplainWithAiResult = {
        status: "ai_disabled",
        message: "Consent was declined by user.",
        explanation: fallback,
        isFallback: true
      };
      if (options.json) {
        console.log(JSON.stringify(cancelledResult, null, 2));
      } else {
        console.log(formatAiExplanationTerminal(cancelledResult));
      }
      return 0;
    }
  }

  // 5. Instantiate provider
  let provider;
  try {
    provider = options.customMockProvider || createAiProvider(config);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const fallback = buildFallbackExplanation(reportOrFindings);
    const failResult: ExplainWithAiResult = {
      status: "error",
      error: errMsg,
      reasons: [errMsg],
      explanation: fallback,
      isFallback: true
    };
    if (options.json) {
      console.log(JSON.stringify(failResult, null, 2));
    } else {
      console.log(formatAiExplanationTerminal(failResult));
    }
    return 0;
  }

  // 6. Execute explanation
  const result = await explainWithAi({
    provider,
    config,
    input: aiInput
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatAiExplanationTerminal(result));
  }

  return 0;
}
