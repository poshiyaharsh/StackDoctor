import { describe, it, expect } from "vitest";
import {
  pythonPackagesMissingRule,
  pythonPackageVersionMismatchRule,
  djangoSettingsNotFoundRule,
  djangoMigrationsPendingRule,
  createDefaultRuleRegistry,
  type RuleEvaluationContext
} from "@stackdoctor/rules";
import { FindingSchema } from "@stackdoctor/schemas";

describe("Phase 2 Run 2D Python & Django Rules", () => {
  const baseContext: RuleEvaluationContext = {
    dir: "/test/python-project",
    files: {
      hasPackageJson: false,
      hasNodeModules: false,
      hasLockfile: false,
      hasEnvExample: false,
      hasEnv: false
    },
    technologies: [
      { name: "Python", confidence: "confirmed", evidence: [] },
      { name: "Django", confidence: "confirmed", evidence: [] }
    ],
    evidence: []
  };

  describe("PYTHON_PACKAGES_MISSING", () => {
    it("triggers when declared packages are missing from environment", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        python: {
          missingPackages: [
            { name: "django", specifier: "==4.2.11", source: "requirements.txt" },
            { name: "psycopg2-binary", source: "requirements.txt" }
          ]
        }
      };

      expect(pythonPackagesMissingRule.preconditions(ctx)).toBe(true);
      const finding = pythonPackagesMissingRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("PYTHON_PACKAGES_MISSING");
      expect(finding?.severity).toBe("high");
      expect(finding?.evidence[0]?.observed).toContain("django, psycopg2-binary");
      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });

    it("does NOT trigger when no packages are missing", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        python: { missingPackages: [] }
      };

      expect(pythonPackagesMissingRule.preconditions(ctx)).toBe(false);
      expect(pythonPackagesMissingRule.evaluate(ctx)).toBeNull();
    });
  });

  describe("PYTHON_PACKAGE_VERSION_MISMATCH", () => {
    it("triggers when an installed package does not satisfy declared requirement", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        python: {
          mismatchedPackages: [
            {
              name: "django",
              installedVersion: "3.2.19",
              expectedSpecifier: ">=4.2.0"
            }
          ]
        }
      };

      expect(pythonPackageVersionMismatchRule.preconditions(ctx)).toBe(true);
      const finding = pythonPackageVersionMismatchRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("PYTHON_PACKAGE_VERSION_MISMATCH");
      expect(finding?.evidence[0]?.observed).toContain('installed version "3.2.19"');
      expect(finding?.evidence[0]?.observed).toContain('requires ">=4.2.0"');
      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });
  });

  describe("DJANGO_SETTINGS_NOT_FOUND", () => {
    it("triggers when DJANGO_SETTINGS_MODULE points to a non-existent file", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        django: {
          isDjangoProject: true,
          settings: {
            discovered: true,
            moduleName: "myproject.settings",
            expectedFilePath: "/test/python-project/myproject/settings.py",
            fileExists: false
          }
        }
      };

      expect(djangoSettingsNotFoundRule.preconditions(ctx)).toBe(true);
      const finding = djangoSettingsNotFoundRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("DJANGO_SETTINGS_NOT_FOUND");
      expect(finding?.evidence[0]?.observed).toContain("myproject.settings");
      expect(finding?.evidence[0]?.observed).toContain("no corresponding file was found");
      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });

    it("does NOT trigger when settings file exists", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        django: {
          isDjangoProject: true,
          settings: {
            discovered: true,
            moduleName: "myproject.settings",
            expectedFilePath: "/test/python-project/myproject/settings.py",
            fileExists: true
          }
        }
      };

      expect(djangoSettingsNotFoundRule.preconditions(ctx)).toBe(false);
      expect(djangoSettingsNotFoundRule.evaluate(ctx)).toBeNull();
    });
  });

  describe("DJANGO_MIGRATIONS_PENDING", () => {
    it("triggers when unapplied database schema changes exist (with --allow-project-code)", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        django: {
          isDjangoProject: true,
          migrations: {
            status: "pending",
            pendingCount: 2,
            unappliedList: ["0002_user_profile", "0003_add_avatar"]
          }
        }
      };

      expect(djangoMigrationsPendingRule.preconditions(ctx)).toBe(true);
      const finding = djangoMigrationsPendingRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("DJANGO_MIGRATIONS_PENDING");
      expect(finding?.severity).toBe("medium");
      expect(finding?.evidence[0]?.observed).toContain("0002_user_profile, 0003_add_avatar");

      // CRITICAL CHECKLIST RULE: The word 'migrate' must not appear in the finding!
      const serialized = JSON.stringify(finding);
      expect(serialized.toLowerCase()).not.toContain("migrate");

      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });
  });

  describe("Default Rule Registry has 40 rules", () => {
    it("registers all 40 rules", () => {
      const registry = createDefaultRuleRegistry();
      const rules = registry.list();
      expect(rules.length).toBe(40);

      const ids = rules.map((r) => r.id);
      expect(ids).toContain("PYTHON_PACKAGES_MISSING");
      expect(ids).toContain("PYTHON_PACKAGE_VERSION_MISMATCH");
      expect(ids).toContain("DJANGO_SETTINGS_NOT_FOUND");
      expect(ids).toContain("DJANGO_MIGRATIONS_PENDING");
    });
  });
});
