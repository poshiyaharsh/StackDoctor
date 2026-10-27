import type { Report, Finding } from "@stackdoctor/schemas";
import type { AiExplanation, RootCauseRankingItem, ConfirmedFactItem, HypothesisItem } from "./schema.js";

function isReport(input: unknown): input is Report {
  return (
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input &&
    "findings" in input
  );
}

const RULE_OPERATION_MAP: Record<string, string> = {
  NODE_DEPS_NOT_INSTALLED: "npm_install",
  NODE_DEPS_MISSING: "npm_install",
  PYTHON_DEPS_MISSING: "pip_install",
  REQUIREMENTS_NOT_INSTALLED: "pip_install",
  ENV_FILE_MISSING: "create_env_file",
  PORT_IN_USE: "kill_port_process",
  PORT_CONFLICT: "kill_port_process"
};

/**
 * Builds a deterministic, rule-based explanation directly from diagnostic findings or reports.
 * Used whenever AI is disabled, unavailable, or rejected by safety and grounding checks.
 */
export function buildFallbackExplanation(
  reportOrFindings: Report | Finding[] | { findings: Finding[] }
): AiExplanation {
  let findings: Finding[] = [];
  if (isReport(reportOrFindings)) {
    findings = reportOrFindings.findings || [];
  } else if (Array.isArray(reportOrFindings)) {
    findings = reportOrFindings;
  } else if (reportOrFindings && typeof reportOrFindings === "object" && "findings" in reportOrFindings) {
    findings = reportOrFindings.findings || [];
  }

  if (findings.length === 0) {
    return {
      summary: "No diagnostic findings detected. Environment appears ready and properly configured.",
      rootCauseRanking: [],
      confirmedFacts: [],
      hypotheses: [],
      checklist: ["Environment validated - no immediate remediation required."],
      suggestedExtraChecks: [],
      suggestedOperationIds: []
    };
  }

  const rootCauseRanking: RootCauseRankingItem[] = [];
  const confirmedFacts: ConfirmedFactItem[] = [];
  const hypotheses: HypothesisItem[] = [];
  const checklist: string[] = [];
  const suggestedExtraChecks: string[] = [];
  const suggestedOperationIds: string[] = [];

  for (const f of findings) {
    const evidenceIds = (f.evidence || []).map((e) => e.id);

    // Root cause from title / causes
    const likelihood = f.severity === "critical" || f.severity === "high" ? "high" : "medium";
    if (f.possibleCauses && f.possibleCauses.length > 0) {
      for (const cause of f.possibleCauses) {
        rootCauseRanking.push({
          cause,
          likelihood,
          reasoning: `Identified by rule ${f.ruleId} (${f.title}) with ${f.confidence} confidence.`,
          supportingEvidenceIds: evidenceIds
        });
        hypotheses.push({
          statement: cause,
          whatWouldConfirmIt: `Run verification command for ${f.ruleId}`
        });
      }
    } else {
      rootCauseRanking.push({
        cause: f.title,
        likelihood,
        reasoning: `Direct finding from rule ${f.ruleId}.`,
        supportingEvidenceIds: evidenceIds
      });
    }

    // Confirmed facts from each evidence item
    for (const ev of f.evidence || []) {
      confirmedFacts.push({
        statement: `[${f.ruleId}] ${ev.description || ev.kind}: ${ev.observed}`,
        evidenceIds: [ev.id]
      });
    }

    // Recommendations into checklist & extra checks
    for (const rec of f.recommendations || []) {
      if (rec.commandOrAction) {
        checklist.push(`${rec.commandOrAction} (${rec.problem})`);
      }
      if (rec.verification) {
        suggestedExtraChecks.push(rec.verification);
      }
    }

    // Map known operations
    const op = RULE_OPERATION_MAP[f.ruleId];
    if (op && !suggestedOperationIds.includes(op)) {
      suggestedOperationIds.push(op);
    }
  }

  const summary = `Deterministic analysis of ${findings.length} finding(s): ${findings
    .map((f) => f.title)
    .slice(0, 3)
    .join(", ")}${findings.length > 3 ? "..." : "."}`;

  return {
    summary,
    rootCauseRanking,
    confirmedFacts,
    hypotheses,
    checklist: checklist.length > 0 ? checklist : ["Review diagnostic report for individual rule guidance"],
    suggestedExtraChecks,
    suggestedOperationIds
  };
}
