import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const nodeDepsNotInstalledRule: Rule = {
  id: "NODE_DEPS_NOT_INSTALLED",
  title: "Node.js dependencies not installed",
  category: "dependencies",
  description: "package.json exists in the project root, but the node_modules folder is missing.",
  technologies: ["Node.js"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Verify presence of package.json and absence of node_modules",
    "Identify available lockfile to select the declared package manager"
  ],
  remediation: [
    {
      problem: "Node.js application dependencies are not present locally.",
      relevance: "Application runtime and build scripts fail immediately without installed packages.",
      commandOrAction: "npm install",
      expectedResult: "Dependencies will be downloaded and linked into node_modules.",
      risks: "Network download and build scripts; suggest only with user confirmation.",
      undo: "rm -rf node_modules",
      verification: "test -d node_modules",
      operationId: "NODE_INSTALL_DEPENDENCIES"
    }
  ],
  verification: "Verify that node_modules directory exists after installation.",
  docs: ["https://docs.npmjs.com/cli/v10/commands/npm-install"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return ctx.files.hasPackageJson;
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    if (ctx.files.hasPackageJson && !ctx.files.hasNodeModules) {
      const lockfileType = ctx.files.lockfileType ?? "npm";
      const installCmd =
        lockfileType === "pnpm"
          ? "pnpm install"
          : lockfileType === "yarn"
            ? "yarn install"
            : lockfileType === "bun"
              ? "bun install"
              : "npm install";

      return {
        ruleId: "NODE_DEPS_NOT_INSTALLED",
        title: "Node.js dependencies not installed",
        category: "dependencies",
        severity: "high",
        confidence: "confirmed",
        status: "failed",
        evidence: [
          {
            id: "ev-node-deps-missing",
            kind: "file_presence",
            description: "Observed package.json without corresponding node_modules directory",
            observed: "package.json exists in the project root, but node_modules does not exist.",
            source: "filesystem",
            collectedAt: new Date().toISOString()
          }
        ],
        possibleCauses: [
          "Project dependencies have not yet been installed after cloning the repository.",
          "The node_modules directory was cleaned or deleted."
        ],
        recommendations: [
          {
            problem: "Node.js dependencies are not installed in node_modules.",
            relevance: "Node.js cannot resolve imported modules without installed packages.",
            commandOrAction: installCmd,
            expectedResult: `node_modules will be created and populated using ${lockfileType}.`,
            risks: "Downloads external packages; suggestion only until user approves.",
            undo: "rm -rf node_modules",
            verification: "test -d node_modules",
            operationId: "NODE_INSTALL_DEPENDENCIES"
          }
        ],
        verificationStatus: "unverified",
        docs: ["https://docs.npmjs.com/cli/v10/commands/npm-install"]
      };
    }

    return null;
  }
};
