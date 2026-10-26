import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const envVarNamesMissingRule: Rule = {
  id: "ENV_VAR_NAMES_MISSING",
  title: "Required environment variable names missing from .env",
  category: "configuration",
  description: ".env file exists, but one or more variable names documented in .env.example are missing.",
  technologies: ["*"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Read variable names declared in .env.example",
    "Read variable names present in .env (names only, discarding all values)"
  ],
  remediation: [
    {
      problem: "Missing environment variables can cause runtime ReferenceErrors or unhandled undefined values.",
      relevance: "Applications rely on defined environment variables for database URLs, ports, and configuration keys.",
      commandOrAction: "Add missing variable names to .env with valid local values.",
      expectedResult: ".env contains all configuration keys defined in .env.example.",
      risks: "Modifies .env file with new keys; harmless if values are appropriate.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Check .env to ensure all expected variable names are present.",
  docs: ["https://12factor.net/config"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.files.hasEnv &&
      ctx.files.hasEnvExample &&
      ctx.config?.missingEnvVarNames &&
      ctx.config.missingEnvVarNames.length > 0
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const missing = ctx.config?.missingEnvVarNames;
    if (!missing || missing.length === 0) {
      return null;
    }

    const missingList = missing.join(", ");

    return {
      ruleId: "ENV_VAR_NAMES_MISSING",
      title: `${missing.length} environment variable name(s) missing from .env`,
      category: "configuration",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-missing-env-vars",
          kind: "file_presence",
          description: "Missing environment variable names in .env",
          observed: `The following variable name(s) defined in .env.example are missing from .env: ${missingList}. (Secret values were not read or stored).`,
          source: ".env.example -> .env",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "New configuration keys were added to .env.example without updating local .env.",
        ".env was copied from a template before recent features were added."
      ],
      recommendations: [
        {
          problem: "Missing configuration variables in local environment.",
          relevance: "Application runtime may fail when attempting to read undefined configuration.",
          commandOrAction: `Add missing key(s) to .env: ${missingList}`,
          expectedResult: "All expected environment keys are declared in .env.",
          risks: "Add keys only; never commit .env to source control.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://12factor.net/config"]
    };
  }
};
