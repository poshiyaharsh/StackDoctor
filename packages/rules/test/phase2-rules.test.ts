import { describe, it, expect } from "vitest";
import {
  nodeVersionMismatchRule,
  lockfileMissingRule,
  pythonVenvMissingRule,
  createDefaultRuleRegistry,
  type RuleEvaluationContext
} from "@stackdoctor/rules";
import { FindingSchema } from "@stackdoctor/schemas";

describe("Phase 2 Rules", () => {
  describe("NODE_VERSION_MISMATCH", () => {
    const baseContext: RuleEvaluationContext = {
      dir: "/test/node-app",
      files: {
        hasPackageJson: true,
        hasNodeModules: true,
        hasLockfile: true,
        lockfileType: "npm",
        hasEnvExample: false,
        hasEnv: false
      },
      technologies: [{ name: "Node.js", confidence: "confirmed", evidence: [] }],
      evidence: [],
      runtime: {
        nodeVersion: "v16.14.0",
        nodeRequirement: {
          declared: true,
          rawRange: ">=18.0.0",
          sourceFile: "package.json (engines.node)"
        }
      }
    };

    it("preconditions check verifies requirement declaration and installed version", () => {
      expect(nodeVersionMismatchRule.preconditions(baseContext)).toBe(true);

      const noReqContext: RuleEvaluationContext = {
        ...baseContext,
        runtime: {
          ...baseContext.runtime,
          nodeRequirement: { declared: false }
        }
      };
      expect(nodeVersionMismatchRule.preconditions(noReqContext)).toBe(false);
    });

    it("triggers finding when installed version does not satisfy declared requirement", () => {
      const finding = nodeVersionMismatchRule.evaluate(baseContext);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("NODE_VERSION_MISMATCH");
      expect(finding?.severity).toBe("high");
      expect(finding?.status).toBe("failed");
      expect(finding?.confidence).toBe("confirmed");

      // Validate against Zod schema
      const parseResult = FindingSchema.safeParse(finding);
      expect(parseResult.success).toBe(true);

      // Verify facts vs causes separation
      expect(finding?.evidence[0]?.observed).toContain('Active Node.js version is "16.14.0"');
      expect(finding?.evidence[0]?.observed).toContain('requirement ">=18.0.0"');
      expect(finding?.possibleCauses.length).toBeGreaterThan(0);
    });

    it("does NOT trigger when installed version satisfies declared requirement", () => {
      const satisfiedContext: RuleEvaluationContext = {
        ...baseContext,
        runtime: {
          ...baseContext.runtime,
          nodeVersion: "v20.10.0"
        }
      };

      const finding = nodeVersionMismatchRule.evaluate(satisfiedContext);
      expect(finding).toBeNull();
    });

    it("does NOT trigger when requirement range is unparseable", () => {
      const unparseableContext: RuleEvaluationContext = {
        ...baseContext,
        runtime: {
          ...baseContext.runtime,
          nodeRequirement: {
            declared: true,
            rawRange: "invalid-semver-string-xyz",
            sourceFile: ".nvmrc"
          }
        }
      };

      const finding = nodeVersionMismatchRule.evaluate(unparseableContext);
      expect(finding).toBeNull();
    });

    it("does NOT trigger when requirement is not declared", () => {
      const undeclaredContext: RuleEvaluationContext = {
        ...baseContext,
        runtime: {
          ...baseContext.runtime,
          nodeRequirement: { declared: false }
        }
      };

      const finding = nodeVersionMismatchRule.evaluate(undeclaredContext);
      expect(finding).toBeNull();
    });
  });

  describe("LOCKFILE_MISSING", () => {
    const baseContext: RuleEvaluationContext = {
      dir: "/test/app",
      files: {
        hasPackageJson: true,
        hasNodeModules: false,
        hasLockfile: false,
        hasEnvExample: false,
        hasEnv: false
      },
      technologies: [{ name: "Node.js", confidence: "confirmed", evidence: [] }],
      evidence: []
    };

    it("preconditions check verifies hasPackageJson", () => {
      expect(lockfileMissingRule.preconditions(baseContext)).toBe(true);

      const noPkgContext: RuleEvaluationContext = {
        ...baseContext,
        files: { ...baseContext.files, hasPackageJson: false }
      };
      expect(lockfileMissingRule.preconditions(noPkgContext)).toBe(false);
    });

    it("triggers warning finding when package.json exists without lockfile", () => {
      const finding = lockfileMissingRule.evaluate(baseContext);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("LOCKFILE_MISSING");
      expect(finding?.severity).toBe("low");
      expect(finding?.status).toBe("warning");

      const parseResult = FindingSchema.safeParse(finding);
      expect(parseResult.success).toBe(true);

      expect(finding?.evidence[0]?.observed).toContain("no lockfile");
    });

    it("does NOT trigger when lockfile is present", () => {
      const lockfileContext: RuleEvaluationContext = {
        ...baseContext,
        files: {
          ...baseContext.files,
          hasLockfile: true,
          lockfileType: "npm"
        }
      };

      const finding = lockfileMissingRule.evaluate(lockfileContext);
      expect(finding).toBeNull();
    });
  });

  describe("PYTHON_VENV_MISSING", () => {
    const pythonContext: RuleEvaluationContext = {
      dir: "/test/python-app",
      files: {
        hasPackageJson: false,
        hasNodeModules: false,
        hasLockfile: false,
        hasEnvExample: false,
        hasEnv: false
      },
      technologies: [{ name: "Python", confidence: "confirmed", evidence: [] }],
      evidence: [],
      runtime: {
        hasActivePythonVenv: false,
        hasLocalPythonVenv: false
      }
    };

    it("preconditions check accepts Python or Django technologies", () => {
      expect(pythonVenvMissingRule.preconditions(pythonContext)).toBe(true);

      const nodeOnlyContext: RuleEvaluationContext = {
        ...pythonContext,
        technologies: [{ name: "Node.js", confidence: "confirmed", evidence: [] }]
      };
      expect(pythonVenvMissingRule.preconditions(nodeOnlyContext)).toBe(false);
    });

    it("triggers warning finding when neither active nor local venv exists", () => {
      const finding = pythonVenvMissingRule.evaluate(pythonContext);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("PYTHON_VENV_MISSING");
      expect(finding?.severity).toBe("medium");
      expect(finding?.status).toBe("warning");

      const parseResult = FindingSchema.safeParse(finding);
      expect(parseResult.success).toBe(true);

      expect(finding?.evidence[0]?.observed).toContain("VIRTUAL_ENV environment variable is not set");
    });

    it("does NOT trigger when active venv is present", () => {
      const activeVenvContext: RuleEvaluationContext = {
        ...pythonContext,
        runtime: {
          hasActivePythonVenv: true,
          hasLocalPythonVenv: false
        }
      };

      const finding = pythonVenvMissingRule.evaluate(activeVenvContext);
      expect(finding).toBeNull();
    });

    it("does NOT trigger when local venv directory is present", () => {
      const localVenvContext: RuleEvaluationContext = {
        ...pythonContext,
        runtime: {
          hasActivePythonVenv: false,
          hasLocalPythonVenv: true
        }
      };

      const finding = pythonVenvMissingRule.evaluate(localVenvContext);
      expect(finding).toBeNull();
    });
  });

  describe("Rule Registry Integration", () => {
    it("registers all default rules", () => {
      const registry = createDefaultRuleRegistry();
      const rules = registry.list();
      expect(rules.length).toBe(28);

      const ruleIds = rules.map((r) => r.id);
      expect(ruleIds).toContain("NODE_DEPS_NOT_INSTALLED");
      expect(ruleIds).toContain("ENV_EXAMPLE_PRESENT_NO_ENV");
      expect(ruleIds).toContain("NODE_VERSION_MISMATCH");
      expect(ruleIds).toContain("LOCKFILE_MISSING");
      expect(ruleIds).toContain("PYTHON_VENV_MISSING");
    });
  });
});
