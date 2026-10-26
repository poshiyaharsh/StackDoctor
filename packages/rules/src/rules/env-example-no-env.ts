import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

/**
 * Extracts variable names from .env.example content.
 * Strictly collects NAMES only. Values are completely ignored.
 */
export function extractEnvVarNames(content: string): string[] {
  const varNames = new Set<string>();
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*[=:]/);
    if (match && match[1]) {
      varNames.add(match[1]);
    }
  }

  return Array.from(varNames);
}

export const envExamplePresentNoEnvRule: Rule = {
  id: "ENV_EXAMPLE_PRESENT_NO_ENV",
  title: "Environment template present but .env file is missing",
  category: "configuration",
  description: ".env.example exists declaring required environment variables, but no .env file exists.",
  technologies: ["*"],
  severity: "medium",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Check for presence of .env.example or template file",
    "Confirm whether .env file is missing from project root"
  ],
  remediation: [
    {
      problem: "Application environment configuration file .env is missing.",
      relevance: "Application runtime will likely fail when attempting to read declared environment variables.",
      commandOrAction: "cp .env.example .env",
      expectedResult: ".env file will be created based on template variable declarations.",
      risks: "Requires manual configuration of appropriate values for this local environment.",
      undo: "rm -f .env",
      verification: "test -f .env"
    }
  ],
  verification: "Confirm that .env file exists in project root.",
  docs: ["https://12factor.net/config"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return ctx.files.hasEnvExample;
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    if (ctx.files.hasEnvExample && !ctx.files.hasEnv) {
      const varNames = ctx.files.envExampleVarNames ?? [];
      const varNamesDesc =
        varNames.length > 0
          ? `Template declares variable names: ${varNames.join(", ")}.`
          : "Template declares environment variable requirements.";

      return {
        ruleId: "ENV_EXAMPLE_PRESENT_NO_ENV",
        title: "Environment template present but .env file is missing",
        category: "configuration",
        severity: "medium",
        confidence: "confirmed",
        status: "warning",
        evidence: [
          {
            id: "ev-env-example-no-env",
            kind: "file_presence",
            description: `Found .env.example without active .env file. ${varNamesDesc}`,
            observed: `.env.example exists, but .env is absent. Declared variable names: [${varNames.join(", ")}]`,
            source: ".env.example",
            collectedAt: new Date().toISOString()
          }
        ],
        possibleCauses: [
          "Developer cloned repository but has not copied .env.example to .env.",
          "Local environment variables were not yet configured."
        ],
        recommendations: [
          {
            problem: "No .env file found to provide environment variables.",
            relevance: "Environment variables declared in .env.example must be defined for application runtime.",
            commandOrAction: "cp .env.example .env",
            expectedResult: "A local .env configuration file will be initialized.",
            risks: "Template values may need adjustment with valid local secrets.",
            undo: "rm -f .env",
            verification: "test -f .env"
          }
        ],
        verificationStatus: "unverified",
        docs: ["https://12factor.net/config"]
      };
    }

    return null;
  }
};
