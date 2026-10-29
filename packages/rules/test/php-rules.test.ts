import { describe, it, expect } from "vitest";
import { phpVersionMismatchRule } from "../src/rules/php-version-mismatch.js";
import { phpRuntimeMissingRule } from "../src/rules/php-runtime-missing.js";
import { composerDepsNotInstalledRule } from "../src/rules/composer-deps-not-installed.js";
import { laravelAppKeyMissingRule } from "../src/rules/laravel-app-key-missing.js";
import type { RuleEvaluationContext } from "../src/types.js";

function createMockContext(overrides: Partial<RuleEvaluationContext> = {}): RuleEvaluationContext {
  return {
    dir: "/mock/project",
    files: {
      packageJson: false,
      packageLock: false,
      pnpmLock: false,
      yarnLock: false,
      env: false,
      envExample: false,
      dockerCompose: false,
      envExampleVarNames: []
    },
    technologies: [],
    evidence: [],
    runtime: {
      nodeVersion: "v20.0.0",
      hasActivePythonVenv: false,
      hasLocalPythonVenv: false
    },
    ports: {
      declaredPorts: [],
      portChecks: []
    },
    config: {
      missingEnvVarNames: [],
      runtimeConflict: {
        hasConflict: false
      },
      compose: {
        hasCompose: false,
        services: [],
        missingReferencedServices: []
      }
    },
    database: {
      diagnostics: []
    },
    ...overrides
  };
}

describe("PHP & Laravel Diagnostic Rules (FB-DRAFT-002)", () => {
  describe("PHP_VERSION_MISMATCH", () => {
    it("flags when active PHP version does not satisfy composer requirement", () => {
      const ctx = createMockContext({
        technologies: [{ name: "PHP", confidence: "confirmed", evidence: [] }],
        php: {
          installed: true,
          version: "8.0.28",
          requirement: {
            declared: true,
            requiredVersion: "^8.2",
            sourceFile: "composer.json"
          }
        }
      });

      const finding = phpVersionMismatchRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("PHP_VERSION_MISMATCH");
      expect(finding?.severity).toBe("high");
      expect(finding?.title).toContain("Installed PHP 8.0.28 does not satisfy requirement ^8.2");
    });

    it("passes when active PHP version satisfies constraint", () => {
      const ctx = createMockContext({
        technologies: [{ name: "PHP", confidence: "confirmed", evidence: [] }],
        php: {
          installed: true,
          version: "8.2.14",
          requirement: {
            declared: true,
            requiredVersion: "^8.1",
            sourceFile: "composer.json"
          }
        }
      });

      const finding = phpVersionMismatchRule.evaluate(ctx);
      expect(finding).toBeNull();
    });

    it("passes when no PHP requirement is declared", () => {
      const ctx = createMockContext({
        technologies: [{ name: "PHP", confidence: "confirmed", evidence: [] }],
        php: {
          installed: true,
          version: "8.2.14"
        }
      });

      const finding = phpVersionMismatchRule.evaluate(ctx);
      expect(finding).toBeNull();
    });
  });

  describe("PHP_RUNTIME_MISSING", () => {
    it("flags when PHP project is detected but runtime is missing", () => {
      const ctx = createMockContext({
        technologies: [{ name: "PHP", confidence: "confirmed", evidence: [] }],
        php: {
          installed: false
        }
      });

      const finding = phpRuntimeMissingRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("PHP_RUNTIME_MISSING");
      expect(finding?.severity).toBe("high");
    });

    it("passes when PHP runtime is installed", () => {
      const ctx = createMockContext({
        technologies: [{ name: "PHP", confidence: "confirmed", evidence: [] }],
        php: {
          installed: true,
          version: "8.2.14"
        }
      });

      const finding = phpRuntimeMissingRule.evaluate(ctx);
      expect(finding).toBeNull();
    });

    it("passes when not a PHP project", () => {
      const ctx = createMockContext({
        technologies: [{ name: "Node.js", confidence: "confirmed", evidence: [] }]
      });

      const finding = phpRuntimeMissingRule.evaluate(ctx);
      expect(finding).toBeNull();
    });
  });

  describe("COMPOSER_DEPS_NOT_INSTALLED", () => {
    it("flags when composer.json has dependencies but vendor is missing", () => {
      const ctx = createMockContext({
        technologies: [{ name: "Composer", confidence: "confirmed", evidence: [] }],
        composer: {
          hasComposerJson: true,
          hasVendor: false,
          hasAutoload: false,
          declaredDepsCount: 5,
          missingVendor: true
        }
      });

      const finding = composerDepsNotInstalledRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("COMPOSER_DEPS_NOT_INSTALLED");
      expect(finding?.severity).toBe("high");
      expect(finding?.recommendations[0]?.commandOrAction).toContain("composer install");
    });

    it("passes when vendor directory and autoload are present", () => {
      const ctx = createMockContext({
        technologies: [{ name: "Composer", confidence: "confirmed", evidence: [] }],
        composer: {
          hasComposerJson: true,
          hasVendor: true,
          hasAutoload: true,
          declaredDepsCount: 5,
          missingVendor: false
        }
      });

      const finding = composerDepsNotInstalledRule.evaluate(ctx);
      expect(finding).toBeNull();
    });
  });

  describe("LARAVEL_APP_KEY_MISSING", () => {
    it("flags when Laravel project has missing or empty APP_KEY", () => {
      const ctx = createMockContext({
        technologies: [
          { name: "PHP", confidence: "confirmed", evidence: [] },
          { name: "Laravel", confidence: "confirmed", evidence: [] }
        ],
        laravel: {
          isLaravel: true,
          hasArtisan: true,
          hasAppKey: false,
          keyIsMissingOrEmpty: true
        }
      });

      const finding = laravelAppKeyMissingRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("LARAVEL_APP_KEY_MISSING");
      expect(finding?.severity).toBe("high");
      expect(finding?.recommendations[0]?.commandOrAction).toContain("php artisan key:generate");
    });

    it("passes when APP_KEY is populated", () => {
      const ctx = createMockContext({
        technologies: [
          { name: "PHP", confidence: "confirmed", evidence: [] },
          { name: "Laravel", confidence: "confirmed", evidence: [] }
        ],
        laravel: {
          isLaravel: true,
          hasArtisan: true,
          hasAppKey: true,
          keyIsMissingOrEmpty: false
        }
      });

      const finding = laravelAppKeyMissingRule.evaluate(ctx);
      expect(finding).toBeNull();
    });
  });
});
