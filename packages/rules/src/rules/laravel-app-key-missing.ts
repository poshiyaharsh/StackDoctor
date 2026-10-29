import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const laravelAppKeyMissingRule: Rule = {
  id: "LARAVEL_APP_KEY_MISSING",
  title: "Laravel application encryption key missing or empty",
  category: "environment",
  description: "Laravel application encryption key (APP_KEY) is missing or empty in .env, causing fatal bootstrap decryption exceptions.",
  technologies: ["PHP", "Laravel"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_content"],
  recommendedChecks: [
    "Check .env file for an 'APP_KEY' entry.",
    "Verify whether 'php artisan key:generate' has been run."
  ],
  remediation: [
    {
      problem: "Missing or unconfigured Laravel APP_KEY encryption key.",
      relevance: "Laravel halts on boot with a 500 error ('No application encryption key has been specified').",
      commandOrAction: "php artisan key:generate",
      expectedResult: "Populates APP_KEY with a secure base64 string in .env.",
      risks: "If existing user session cookies or database fields were encrypted with a prior key, they will become invalid.",
      verification: "grep -E '^APP_KEY=base64:' .env"
    }
  ],
  verification: "Verify that APP_KEY is populated with a base64 key in .env.",
  docs: ["https://laravel.com/docs/configuration#environment-configuration"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return Boolean(ctx.laravel?.isLaravel && ctx.laravel.keyIsMissingOrEmpty);
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    if (!ctx.laravel || !ctx.laravel.isLaravel || !ctx.laravel.keyIsMissingOrEmpty) {
      return null;
    }

    return {
      ruleId: "LARAVEL_APP_KEY_MISSING",
      title: "Laravel application encryption key missing or empty",
      category: "environment",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-laravel-app-key-missing",
          kind: "file_content",
          description: "Laravel APP_KEY configuration in .env",
          observed: "APP_KEY is empty, unset, or missing in .env",
          source: ".env",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "The project was cloned and .env was copied from .env.example without generating an application key.",
        "The APP_KEY setting was cleared or commented out in .env."
      ],
      recommendations: [
        {
          problem: "Laravel application key not set.",
          relevance: "HTTP requests will fail immediately with 500 internal server error.",
          commandOrAction: "php artisan key:generate",
          expectedResult: "Generates 32-character key in .env.",
          risks: "Invalidates existing session cookies.",
          verification: "grep -E '^APP_KEY=base64:' .env"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://laravel.com/docs/configuration#environment-configuration"]
    };
  }
};
