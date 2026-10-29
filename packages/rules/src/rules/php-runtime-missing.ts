import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const phpRuntimeMissingRule: Rule = {
  id: "PHP_RUNTIME_MISSING",
  title: "PHP CLI runtime is not installed or not in PATH",
  category: "runtime",
  description: "PHP project files or composer.json are present, but the 'php' binary cannot be located in PATH.",
  technologies: ["PHP", "Composer"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Run 'which php' or 'where php' in your terminal.",
    "Verify your PATH environment variable includes the directory where PHP is installed.",
    "If using Docker, check if running inside the container via 'docker compose exec app php -v' is expected."
  ],
  remediation: [
    {
      problem: "PHP CLI runtime is not installed or not found in system PATH.",
      relevance: "Cannot run Composer, Artisan, or execute local PHP scripts.",
      commandOrAction: "Install PHP 8.x and ensure 'php' is accessible in your system PATH.",
      expectedResult: "'php -v' executes successfully in your terminal.",
      risks: "None.",
      verification: "php -v"
    }
  ],
  verification: "Verify 'php -v' runs and prints PHP version information.",
  docs: ["https://www.php.net/manual/en/install.php"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    const isPhp = ctx.technologies.some(
      (t) => t.name === "PHP" || t.name === "Composer" || t.name === "Laravel"
    );
    return isPhp && ctx.php !== undefined && !ctx.php.installed;
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const isPhp = ctx.technologies.some(
      (t) => t.name === "PHP" || t.name === "Composer" || t.name === "Laravel"
    );

    if (!isPhp || !ctx.php || ctx.php.installed) {
      return null;
    }

    return {
      ruleId: "PHP_RUNTIME_MISSING",
      title: "PHP CLI runtime is not installed or not in PATH",
      category: "runtime",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-php-binary-missing",
          kind: "file_presence",
          description: "PHP CLI binary check",
          observed: "Executable 'php' was not found in PATH or returned command-not-found error",
          source: "PATH",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "PHP is not installed on this system.",
        "PHP is installed in a non-standard directory that is not in the system PATH.",
        "The project is intended to run inside Docker and local runtime is not configured."
      ],
      recommendations: [
        {
          problem: "PHP executable not available.",
          relevance: "Local development commands like composer and artisan require a PHP CLI binary.",
          commandOrAction: "Install PHP 8.x via your system package manager (e.g. apt install php, brew install php, or chocolatey).",
          expectedResult: "'php -v' outputs the active version.",
          risks: "None.",
          verification: "php -v && stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://www.php.net/manual/en/install.php"]
    };
  }
};
