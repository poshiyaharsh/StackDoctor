import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const runtimeDeclarationsConflictRule: Rule = {
  id: "RUNTIME_DECLARATIONS_CONFLICT",
  title: "Conflicting runtime version declarations between project files",
  category: "configuration",
  description: "The project contains mutually conflicting runtime version specifications across configuration files (e.g. .nvmrc conflicts with package.json engines.node).",
  technologies: ["Node.js"],
  severity: "medium",
  confidence: "confirmed",
  requiredEvidence: ["version_check"],
  recommendedChecks: [
    "Read declared engines.node from package.json",
    "Read version string from .nvmrc and .node-version"
  ],
  remediation: [
    {
      problem: "Different developers and CI environments may run different and incompatible Node.js versions.",
      relevance: "Inconsistent version declarations lead to 'works on my machine' bugs and build failures.",
      commandOrAction: "Align .nvmrc and package.json engines.node to target the same compatible Node.js version range.",
      expectedResult: ".nvmrc and engines.node specify compatible Node versions.",
      risks: "Update version declaration files; harmless to code.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that .nvmrc satisfies the range specified in package.json engines.node.",
  docs: ["https://docs.npmjs.com/cli/v10/configuring-npm/package-json#engines"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!ctx.config?.runtimeConflict?.hasConflict;
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const conflict = ctx.config?.runtimeConflict;
    if (!conflict || !conflict.hasConflict) {
      return null;
    }

    const { nodeEngines, nvmrc, reason } = conflict;

    return {
      ruleId: "RUNTIME_DECLARATIONS_CONFLICT",
      title: "Conflicting Node.js versions declared in .nvmrc and package.json",
      category: "configuration",
      severity: "medium",
      confidence: "confirmed",
      status: "warning",
      evidence: [
        {
          id: "ev-runtime-conflict",
          kind: "version_check",
          description: "Conflicting Node version declarations detected",
          observed: reason || `.nvmrc specifies "${nvmrc}" but package.json engines.node specifies "${nodeEngines}".`,
          source: ".nvmrc <-> package.json",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        ".nvmrc was updated without updating engines.node in package.json (or vice versa).",
        "A version bump was partially completed across repository files."
      ],
      recommendations: [
        {
          problem: "Inconsistent version declarations between project files.",
          relevance: "Tools like nvm will switch to a version that npm engines flags as incompatible.",
          commandOrAction: `Update .nvmrc to match engines.node ("${nodeEngines}"), or update engines.node in package.json.`,
          expectedResult: "Both files agree on a compatible Node.js version.",
          risks: "Harmonizes configuration files only.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://docs.npmjs.com/cli/v10/configuring-npm/package-json#engines"]
    };
  }
};
