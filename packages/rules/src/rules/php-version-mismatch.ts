import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";
import { checkPhpVersionSatisfies } from "@stackdoctor/adapters";

export const phpVersionMismatchRule: Rule = {
  id: "PHP_VERSION_MISMATCH",
  title: "Installed PHP version does not satisfy project requirement",
  category: "runtime",
  description: "The active PHP CLI runtime does not satisfy the PHP version constraint declared in composer.json or .php-version.",
  technologies: ["PHP", "Composer"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["command_output"],
  recommendedChecks: [
    "Run 'php -v' in your terminal to inspect the active PHP runtime.",
    "Check the 'require.php' constraint declared in composer.json or .php-version.",
    "If using a PHP version manager (e.g., brew, phpbrew, phpenv), switch to an active version satisfying the constraint."
  ],
  remediation: [
    {
      problem: "Installed PHP CLI runtime does not satisfy project requirements.",
      relevance: "PHP frameworks and dependencies will refuse to run or fail with syntax and runtime compatibility errors.",
      commandOrAction: "Switch to a matching PHP runtime version or update your system PATH.",
      expectedResult: "Active PHP version satisfies the project constraint.",
      risks: "Environment variable change; does not modify source code.",
      verification: "php -v && stackdoctor scan"
    }
  ],
  verification: "Verify active PHP version satisfies project build configuration.",
  docs: ["https://www.php.net/supported-versions.php"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    if (!ctx.php?.installed || !ctx.php.version || !ctx.php.requirement?.declared || !ctx.php.requirement.requiredVersion) {
      return false;
    }
    return !checkPhpVersionSatisfies(ctx.php.version, ctx.php.requirement.requiredVersion);
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    if (!ctx.php?.installed || !ctx.php.version || !ctx.php.requirement?.declared || !ctx.php.requirement.requiredVersion) {
      return null;
    }

    const { version } = ctx.php;
    const { requiredVersion, sourceFile = "composer.json" } = ctx.php.requirement;

    if (checkPhpVersionSatisfies(version, requiredVersion)) {
      return null;
    }

    return {
      ruleId: "PHP_VERSION_MISMATCH",
      title: `Installed PHP ${version} does not satisfy requirement ${requiredVersion}`,
      category: "runtime",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-php-version-mismatch",
          kind: "command_output",
          description: "Active PHP version versus declared requirement",
          observed: `Active PHP runtime is version ${version}, but ${sourceFile} requires "${requiredVersion}".`,
          source: sourceFile,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        `The project requires PHP "${requiredVersion}", but PATH points to PHP ${version}.`,
        "Multiple PHP versions are installed and PATH or shell alias points to an older or newer version.",
        "A version manager like brew or phpbrew has not set the active version for this terminal session."
      ],
      recommendations: [
        {
          problem: "PHP version mismatch.",
          relevance: "Composer dependencies and framework bootstrap will fail immediately.",
          commandOrAction: `Switch to a PHP version satisfying "${requiredVersion}".`,
          expectedResult: `\`php -v\` satisfies "${requiredVersion}".`,
          risks: "Environment configuration change only.",
          verification: "php -v && stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://www.php.net/supported-versions.php"]
    };
  }
};
