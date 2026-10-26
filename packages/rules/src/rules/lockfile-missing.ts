import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const lockfileMissingRule: Rule = {
  id: "LOCKFILE_MISSING",
  title: "Package lockfile missing",
  category: "dependencies",
  description: "package.json is present in the project root, but no lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock) was found.",
  technologies: ["Node.js"],
  severity: "low",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Check for presence of package.json",
    "Scan project root for package-lock.json, pnpm-lock.yaml, yarn.lock, or bun.lockb"
  ],
  remediation: [
    {
      problem: "No lockfile is present to pin dependency versions.",
      relevance: "Builds and installations can become non-deterministic when dependency versions drift.",
      commandOrAction: "npm install --package-lock-only",
      expectedResult: "Generates package-lock.json without modifying code.",
      risks: "Pins resolved dependency versions; recommended for version control.",
      undo: "rm -f package-lock.json",
      verification: "test -f package-lock.json"
    }
  ],
  verification: "Confirm that a lockfile exists in the project root.",
  docs: ["https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return ctx.files.hasPackageJson;
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    if (ctx.files.hasPackageJson && !ctx.files.hasLockfile) {
      return {
        ruleId: "LOCKFILE_MISSING",
        title: "Package lockfile missing",
        category: "dependencies",
        severity: "low",
        confidence: "confirmed",
        status: "warning",
        evidence: [
          {
            id: "ev-lockfile-missing",
            kind: "file_presence",
            description: "package.json is present, but no lockfile exists",
            observed: "package.json exists in the project root, but no lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lockb) was detected.",
            source: "filesystem",
            collectedAt: new Date().toISOString()
          }
        ],
        possibleCauses: [
          "Project was initialized or modified without generating a lockfile.",
          "The lockfile was excluded by .gitignore or not checked into source control."
        ],
        recommendations: [
          {
            problem: "Missing dependency lockfile.",
            relevance: "Lockfiles guarantee repeatable installations across machines.",
            commandOrAction: "npm install --package-lock-only",
            expectedResult: "Generates a package-lock.json file pinning exact dependency versions.",
            risks: "Harmless file creation; does not modify source code.",
            undo: "rm -f package-lock.json",
            verification: "test -f package-lock.json"
          }
        ],
        verificationStatus: "unverified",
        docs: ["https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json"]
      };
    }

    return null;
  }
};
