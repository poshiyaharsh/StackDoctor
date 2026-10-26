import type { Finding } from "@stackdoctor/schemas";
import semver from "semver";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const nodeVersionMismatchRule: Rule = {
  id: "NODE_VERSION_MISMATCH",
  title: "Installed Node.js version does not satisfy project requirement",
  category: "runtime",
  description: "The active Node.js runtime version does not satisfy the version range explicitly declared by the project.",
  technologies: ["Node.js"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["version_check"],
  recommendedChecks: [
    "Read declared Node version requirement from package.json engines or .nvmrc",
    "Inspect installed Node.js version from node -v"
  ],
  remediation: [
    {
      problem: "Active Node.js runtime version does not satisfy the declared requirement.",
      relevance: "Incompatible runtime versions can lead to unsupported syntax, API mismatches, and native dependency build errors.",
      commandOrAction: "nvm use",
      expectedResult: "Active Node.js environment switches to a compatible version.",
      risks: "Changes active node version in this terminal session; harmless to code.",
      undo: "nvm use system",
      verification: "node -v"
    }
  ],
  verification: "Run `node -v` to confirm active version satisfies the declared range.",
  docs: ["https://nodejs.org/"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(ctx.runtime?.nodeRequirement?.declared && ctx.runtime?.nodeVersion);
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const requirement = ctx.runtime?.nodeRequirement;
    const installed = ctx.runtime?.nodeVersion;

    if (!requirement?.declared || !requirement.rawRange || !installed) {
      return null;
    }

    const cleanInstalled =
      semver.clean(installed) || semver.coerce(installed)?.version || installed;

    let targetRange = requirement.rawRange;
    if (/^v?\d+$/.test(targetRange)) {
      targetRange = `^${targetRange.replace(/^v/, "")}.0.0`;
    } else if (/^v\d+\.\d+\.\d+/.test(targetRange)) {
      targetRange = targetRange.replace(/^v/, "");
    }

    const validRange = semver.validRange(targetRange);
    if (!validRange) {
      // Unparseable range is NOT a mismatch failure
      return null;
    }

    if (!semver.satisfies(cleanInstalled, validRange)) {
      const source = requirement.sourceFile ?? "project configuration";
      return {
        ruleId: "NODE_VERSION_MISMATCH",
        title: "Installed Node.js version does not satisfy project requirement",
        category: "runtime",
        severity: "high",
        confidence: "confirmed",
        status: "failed",
        evidence: [
          {
            id: "ev-node-version-mismatch",
            kind: "version_check",
            description: "Active Node.js version is outside declared range",
            observed: `Active Node.js version is "${cleanInstalled}", but ${source} specifies requirement "${requirement.rawRange}".`,
            source,
            collectedAt: new Date().toISOString()
          }
        ],
        possibleCauses: [
          `Active Node.js runtime version (${cleanInstalled}) does not satisfy declared requirement (${requirement.rawRange}).`,
          "Version manager (nvm, fnm, or volta) has a different default version selected."
        ],
        recommendations: [
          {
            problem: "Active Node.js runtime is incompatible with declared requirements.",
            relevance: "Application runtime may crash due to syntax or API incompatibilities.",
            commandOrAction: `nvm install "${requirement.rawRange}" && nvm use "${requirement.rawRange}"`,
            expectedResult: `Switches to Node.js matching ${requirement.rawRange}.`,
            risks: "Installs a Node.js version via nvm; suggestion only.",
            undo: "nvm use system",
            verification: "node -v"
          }
        ],
        verificationStatus: "unverified",
        docs: ["https://nodejs.org/"]
      };
    }

    return null;
  }
};
