import { redactText } from "@stackdoctor/core";
import type { AiExplanation, ConfirmedFactItem, HypothesisItem } from "./schema.js";
import type { AiInput, AiInputEvidenceItem } from "./types.js";

export type GroundingStatus = "ok" | "partially_trusted" | "rejected";

export interface GroundingValidationResult {
  status: GroundingStatus;
  output?: AiExplanation;
  removed: string[];
  reasons: string[];
}

const CANARY_SECRET_REGEX = /CANARY_SECRET_[A-Za-z0-9_-]+/i;
const TOKEN_PREFIX_REGEX = /\b(?:sk-[a-zA-Z0-9_-]{10,}|stk_[a-zA-Z0-9_-]{10,})\b/;

/**
 * Checks whether text contains potential secrets, tokens, or credentials.
 */
function containsPotentialSecret(text: string): boolean {
  if (!text) return false;
  if (CANARY_SECRET_REGEX.test(text) || TOKEN_PREFIX_REGEX.test(text)) {
    return true;
  }
  const redacted = redactText(text);
  return redacted !== text;
}

/**
 * Validates grounding of AI explanation against source diagnostic data.
 * Downgrades ungrounded claims, strips invalid evidence citations,
 * and rejects explanations that leak secrets or fail critical grounding thresholds.
 */
export function validateGrounding(
  output: AiExplanation,
  aiInput: AiInput
): GroundingValidationResult {
  const reasons: string[] = [];
  const removed: string[] = [];

  // 1. Secret scanning across all output text
  const allTexts: string[] = [
    output.summary,
    ...output.rootCauseRanking.map((rc) => `${rc.cause} ${rc.reasoning}`),
    ...output.confirmedFacts.map((cf) => cf.statement),
    ...output.hypotheses.map((h) => `${h.statement} ${h.whatWouldConfirmIt}`),
    ...output.checklist,
    ...output.suggestedExtraChecks
  ];

  for (const text of allTexts) {
    if (containsPotentialSecret(text)) {
      return {
        status: "rejected",
        reasons: ["Output contains potential secret, credential, or canary token"],
        removed: []
      };
    }
  }

  // 2. Build map of all known evidence items
  const evidenceMap = new Map<string, AiInputEvidenceItem>();
  for (const f of aiInput.findings) {
    for (const ev of f.evidence) {
      evidenceMap.set(ev.id, ev);
    }
  }

  // Clone output structures
  const validConfirmedFacts: ConfirmedFactItem[] = [];
  const validHypotheses: HypothesisItem[] = [...output.hypotheses];

  let ungroundedFactsCount = 0;
  const initialFactsCount = output.confirmedFacts.length;

  // 3. Validate confirmed facts
  for (const fact of output.confirmedFacts) {
    const unknownEvidenceIds = fact.evidenceIds.filter((id) => !evidenceMap.has(id));

    if (unknownEvidenceIds.length > 0) {
      // Citation of invented or non-existent evidence ID
      ungroundedFactsCount++;
      removed.push(`Confirmed fact "${fact.statement}" cited unknown evidence IDs: ${unknownEvidenceIds.join(", ")}`);
      reasons.push(`Unknown evidence ID cited: ${unknownEvidenceIds.join(", ")}`);

      // Downgrade to hypothesis
      validHypotheses.push({
        statement: fact.statement,
        whatWouldConfirmIt: "Gather observable diagnostic evidence supporting this claim"
      });
      continue;
    }

    // Fact has known evidence IDs. Check heuristic grounding against cited evidence content.
    const citedEvidence = fact.evidenceIds
      .map((id) => evidenceMap.get(id))
      .filter((ev): ev is AiInputEvidenceItem => ev !== undefined);

    const combinedObserved = citedEvidence
      .map((e) => `${e.kind} ${e.description || ""} ${e.observed} ${e.source || ""}`)
      .join(" ");
    const combinedLower = combinedObserved.toLowerCase();
    const statementLower = fact.statement.toLowerCase();

    // Check (a): Version numbers in statement must appear in cited evidence
    const versionRegex = /\bv?(\d+\.\d+(?:\.\d+)?)\b/g;
    let versionMatch: RegExpExecArray | null;
    let ungroundedVersion: string | null = null;
    while ((versionMatch = versionRegex.exec(statementLower)) !== null) {
      const ver = versionMatch[1];
      if (!combinedLower.includes(ver)) {
        ungroundedVersion = ver;
        break;
      }
    }

    if (ungroundedVersion) {
      ungroundedFactsCount++;
      removed.push(`Confirmed fact "${fact.statement}" cited ungrounded version "${ungroundedVersion}"`);
      reasons.push(`Unsubstantiated version "${ungroundedVersion}" not found in cited evidence`);
      validHypotheses.push({
        statement: fact.statement,
        whatWouldConfirmIt: `Verify actual version against environment (unsubstantiated version "${ungroundedVersion}")`
      });
      continue;
    }

    // Check (b): "not installed" claim cited to connection refused / socket error
    const installationClaimRegex = /\b(?:is not installed|not installed|missing installation|not present|has not been installed)\b/i;
    if (installationClaimRegex.test(statementLower)) {
      const hasInstallEvidence = /\b(?:not found|enoent|no such file|command not found|cannot find module|missing)\b/i.test(combinedLower);
      const hasConnectionError = /\b(?:econnrefused|connection refused|socket error|timed out|timeout|refused)\b/i.test(combinedLower);

      if (hasConnectionError && !hasInstallEvidence) {
        ungroundedFactsCount++;
        removed.push(`Confirmed fact "${fact.statement}" asserted installation absence based purely on connection failure`);
        reasons.push("Installation absence asserted without installation/filesystem evidence (connection error only)");
        validHypotheses.push({
          statement: fact.statement,
          whatWouldConfirmIt: "Verify if service package is installed or if the daemon is simply stopped"
        });
        continue;
      }
    }

    // Check (c): Specific file names in statement must appear in cited evidence
    const fileRegex = /\b([a-zA-Z0-9_.-]+\.(?:json|env|example|toml|yaml|yml|lock|js|ts|py|txt))\b/gi;
    const RUNTIME_NAMES = ["node.js", "next.js", "vue.js", "react.js", "deno.js"];
    let fileMatch: RegExpExecArray | null;
    let ungroundedFile: string | null = null;
    while ((fileMatch = fileRegex.exec(statementLower)) !== null) {
      const fileName = fileMatch[1].toLowerCase();
      if (RUNTIME_NAMES.includes(fileName)) {
        continue;
      }
      if (!combinedLower.includes(fileName)) {
        ungroundedFile = fileName;
        break;
      }
    }
    if (ungroundedFile) {
      ungroundedFactsCount++;
      removed.push(`Confirmed fact "${fact.statement}" cited ungrounded file "${ungroundedFile}"`);
      reasons.push(`Unsubstantiated file "${ungroundedFile}" not found in cited evidence`);
      validHypotheses.push({
        statement: fact.statement,
        whatWouldConfirmIt: `Verify presence or absence of "${ungroundedFile}" in project`
      });
      continue;
    }

    // Check (d): Named service or technology must appear in cited evidence or input technologies
    const KNOWN_SERVICES = ["redis", "postgres", "postgresql", "mysql", "mongodb", "sqlite", "nginx", "apache", "docker"];
    let ungroundedService: string | null = null;
    for (const service of KNOWN_SERVICES) {
      if (statementLower.includes(service) && !combinedLower.includes(service)) {
        ungroundedService = service;
        break;
      }
    }
    if (ungroundedService) {
      ungroundedFactsCount++;
      removed.push(`Confirmed fact "${fact.statement}" asserted ungrounded service "${ungroundedService}"`);
      reasons.push(`Unsubstantiated service "${ungroundedService}" not present in cited evidence`);
      validHypotheses.push({
        statement: fact.statement,
        whatWouldConfirmIt: `Check if "${ungroundedService}" is configured or installed`
      });
      continue;
    }

    // Check (e): Exit code / test status in statement must be grounded in evidence
    const exitCodeRegex = /\bexit code\s+(\d+)\b/i;
    const exitMatch = exitCodeRegex.exec(statementLower);
    if (exitMatch) {
      const code = exitMatch[1];
      if (!combinedLower.includes(code) && !combinedLower.includes(`exit code ${code}`)) {
        ungroundedFactsCount++;
        removed.push(`Confirmed fact "${fact.statement}" asserted exit code ${code} without evidence`);
        reasons.push(`Exit code ${code} not found in cited evidence`);
        validHypotheses.push({
          statement: fact.statement,
          whatWouldConfirmIt: `Inspect actual process exit code`
        });
        continue;
      }
    }

    // Check (f): Port numbers in statement must appear in cited evidence
    const portRegex = /\bport\s+(\d{2,5})\b/gi;
    let portMatch: RegExpExecArray | null;
    let ungroundedPort: string | null = null;
    while ((portMatch = portRegex.exec(statementLower)) !== null) {
      const portNum = portMatch[1];
      if (!combinedLower.includes(portNum)) {
        ungroundedPort = portNum;
        break;
      }
    }
    if (ungroundedPort) {
      ungroundedFactsCount++;
      removed.push(`Confirmed fact "${fact.statement}" asserted port ${ungroundedPort} not found in evidence`);
      reasons.push(`Port ${ungroundedPort} not found in cited evidence`);
      validHypotheses.push({
        statement: fact.statement,
        whatWouldConfirmIt: `Verify port ${ungroundedPort}`
      });
      continue;
    }

    // Check (g): Overclaimed definitive causality without conclusive proof
    const definitiveCausalityRegex = /\b(?:definitively|sole cause|guaranteed cause|conclusively caused|crashed definitively)\b/i;
    if (definitiveCausalityRegex.test(statementLower)) {
      ungroundedFactsCount++;
      removed.push(`Confirmed fact "${fact.statement}" asserted definitive causality without conclusive proof`);
      reasons.push("Definitive causality claim downgraded to hypothesis");
      validHypotheses.push({
        statement: fact.statement,
        whatWouldConfirmIt: "Conduct controlled isolation test to confirm causality"
      });
      continue;
    }

    // Check (h): Malicious prompt injection / jailbreak phrases
    const promptInjectionRegex = /\b(?:system compromised|root access|previous instructions|system prompt|jailbreak|pwned|exploit succeeded)\b/i;
    if (promptInjectionRegex.test(statementLower)) {
      ungroundedFactsCount++;
      removed.push(`Confirmed fact "${fact.statement}" contained disallowed prompt injection string`);
      reasons.push("Prompt injection phrase rejected");
      continue;
    }

    // Grounded fact
    validConfirmedFacts.push(fact);
  }

  // 4. Validate rootCauseRanking supporting evidence IDs
  const validRootCauses = output.rootCauseRanking.map((rc) => {
    const supportingIds = rc.supportingEvidenceIds || [];
    const validIds = supportingIds.filter((id) => evidenceMap.has(id));
    const missingIds = supportingIds.filter((id) => !evidenceMap.has(id));
    if (missingIds.length > 0) {
      removed.push(`Root cause "${rc.cause}" cited non-existent evidence IDs: ${missingIds.join(", ")}`);
      reasons.push(`Unknown evidence ID in root cause: ${missingIds.join(", ")}`);
    }
    return {
      ...rc,
      supportingEvidenceIds: validIds
    };
  });

  // 5. Evaluate overall grounding status
  const updatedOutput: AiExplanation = {
    ...output,
    rootCauseRanking: validRootCauses,
    confirmedFacts: validConfirmedFacts,
    hypotheses: validHypotheses
  };

  if (initialFactsCount > 0) {
    if (validConfirmedFacts.length === 0) {
      return {
        status: "rejected",
        output: undefined,
        removed,
        reasons: ["All confirmed facts were ungrounded or cited invalid evidence", ...reasons]
      };
    }

    if (ungroundedFactsCount / initialFactsCount > 0.5) {
      return {
        status: "rejected",
        output: undefined,
        removed,
        reasons: ["More than 50% of confirmed facts failed grounding checks", ...reasons]
      };
    }
  }

  if (reasons.length > 0) {
    return {
      status: "partially_trusted",
      output: updatedOutput,
      removed,
      reasons
    };
  }

  return {
    status: "ok",
    output: updatedOutput,
    removed: [],
    reasons: []
  };
}
