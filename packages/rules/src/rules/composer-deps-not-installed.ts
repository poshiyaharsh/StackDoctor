import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const composerDepsNotInstalledRule: Rule = {
  id: "COMPOSER_DEPS_NOT_INSTALLED",
  title: "Composer dependencies not installed",
  category: "dependencies",
  description: "composer.json exists and declares dependencies, but the vendor directory or vendor/autoload.php is missing.",
  technologies: ["PHP", "Composer"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Check if vendor/autoload.php exists in the project root.",
    "Verify whether 'composer install' has been run after cloning the repository."
  ],
  remediation: [
    {
      problem: "Composer dependencies are missing locally.",
      relevance: "Application runtime fails immediately without installed vendor dependencies and PSR-4 autoloader.",
      commandOrAction: "composer install",
      expectedResult: "vendor directory is created and autoload.php is generated.",
      risks: "Downloads dependencies from Packagist; does not modify source code.",
      undo: "rm -rf vendor",
      verification: "test -f vendor/autoload.php",
      operationId: "COMPOSER_INSTALL_DEPENDENCIES"
    }
  ],
  verification: "Verify that vendor/autoload.php exists after running composer install.",
  docs: ["https://getcomposer.org/doc/01-basic-usage.md#installing-dependencies"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return Boolean(ctx.composer?.hasComposerJson && ctx.composer.missingVendor);
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    if (!ctx.composer || !ctx.composer.hasComposerJson || !ctx.composer.missingVendor) {
      return null;
    }

    return {
      ruleId: "COMPOSER_DEPS_NOT_INSTALLED",
      title: "Composer dependencies not installed",
      category: "dependencies",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-composer-missing-vendor",
          kind: "file_presence",
          description: "Composer vendor autoloader presence check",
          observed: "composer.json declares dependencies, but vendor/autoload.php does not exist",
          source: "vendor/autoload.php",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "Dependencies have not been installed yet after cloning or setting up the repository.",
        "The vendor directory was removed or ignored during deployment."
      ],
      recommendations: [
        {
          problem: "Composer vendor directory missing.",
          relevance: "PHP scripts and frameworks will throw fatal ClassNotFound exceptions.",
          commandOrAction: "composer install",
          expectedResult: "vendor/ directory created with autoload.php.",
          risks: "Network package download.",
          undo: "rm -rf vendor",
          verification: "test -f vendor/autoload.php"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://getcomposer.org/doc/01-basic-usage.md#installing-dependencies"]
    };
  }
};
