import { describe, it, expect } from "vitest";
import {
  portInUseRule,
  envVarNamesMissingRule,
  portInvalidRule,
  runtimeDeclarationsConflictRule,
  composeServiceNotFoundRule,
  createDefaultRuleRegistry,
  type RuleEvaluationContext
} from "@stackdoctor/rules";
import { FindingSchema } from "@stackdoctor/schemas";

describe("Phase 2 Run 2B Rules (Ports & Config)", () => {
  const baseContext: RuleEvaluationContext = {
    dir: "/test/project",
    files: {
      hasPackageJson: true,
      hasNodeModules: true,
      hasLockfile: true,
      lockfileType: "npm",
      hasEnvExample: true,
      hasEnv: true
    },
    technologies: [{ name: "Node.js", confidence: "confirmed", evidence: [] }],
    evidence: []
  };

  describe("PORT_IN_USE", () => {
    it("triggers with confirmed confidence when owning process is identified (conclusive)", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        ports: {
          portChecks: [
            {
              port: 3000,
              host: "127.0.0.1",
              status: "in_use",
              conclusive: true,
              processInfo: { pid: 1234, name: "node" }
            }
          ]
        }
      };

      expect(portInUseRule.preconditions(ctx)).toBe(true);
      const finding = portInUseRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("PORT_IN_USE");
      expect(finding?.confidence).toBe("confirmed");
      expect(finding?.evidence[0]?.observed).toContain("Evidence is conclusive: the owning process was identified");
      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });

    it("triggers with likely confidence and states not conclusive when owning process is unidentified", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        ports: {
          portChecks: [
            {
              port: 8080,
              host: "127.0.0.1",
              status: "in_use",
              conclusive: false
            }
          ]
        }
      };

      const finding = portInUseRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.confidence).toBe("likely");
      expect(finding?.evidence[0]?.observed).toContain("Evidence is not conclusive: the owning process could not be determined");
    });

    it("does NOT trigger when port is available", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        ports: {
          portChecks: [
            {
              port: 3000,
              host: "127.0.0.1",
              status: "available",
              conclusive: true
            }
          ]
        }
      };

      expect(portInUseRule.preconditions(ctx)).toBe(false);
      expect(portInUseRule.evaluate(ctx)).toBeNull();
    });
  });

  describe("ENV_VAR_NAMES_MISSING", () => {
    it("triggers when .env is present but lacks variable names from .env.example", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        config: {
          missingEnvVarNames: ["DATABASE_URL", "JWT_SECRET"]
        }
      };

      expect(envVarNamesMissingRule.preconditions(ctx)).toBe(true);
      const finding = envVarNamesMissingRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("ENV_VAR_NAMES_MISSING");
      expect(finding?.severity).toBe("high");
      expect(finding?.evidence[0]?.observed).toContain("DATABASE_URL, JWT_SECRET");
      expect(finding?.evidence[0]?.observed).toContain("Secret values were not read or stored");
      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });

    it("does NOT trigger when no variable names are missing", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        config: {
          missingEnvVarNames: []
        }
      };

      expect(envVarNamesMissingRule.preconditions(ctx)).toBe(false);
      expect(envVarNamesMissingRule.evaluate(ctx)).toBeNull();
    });
  });

  describe("PORT_INVALID", () => {
    it("triggers when an invalid or out-of-range port is declared", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        ports: {
          declaredPorts: [
            {
              port: 999999,
              source: "package.json (script \"dev\")",
              rawValue: "999999",
              valid: false,
              error: "Declared port is not a valid TCP port number"
            }
          ]
        }
      };

      expect(portInvalidRule.preconditions(ctx)).toBe(true);
      const finding = portInvalidRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("PORT_INVALID");
      expect(finding?.severity).toBe("high");
      expect(finding?.evidence[0]?.observed).toContain('Declared port "999999"');
      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });

    it("does NOT trigger when all declared ports are valid", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        ports: {
          declaredPorts: [
            {
              port: 3000,
              source: "package.json",
              rawValue: "3000",
              valid: true
            }
          ]
        }
      };

      expect(portInvalidRule.preconditions(ctx)).toBe(false);
      expect(portInvalidRule.evaluate(ctx)).toBeNull();
    });
  });

  describe("RUNTIME_DECLARATIONS_CONFLICT", () => {
    it("triggers when .nvmrc and engines.node conflict", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        config: {
          runtimeConflict: {
            hasConflict: true,
            nodeEngines: ">=20.0.0",
            nvmrc: "18.19.0",
            reason: ".nvmrc specifies Node.js \"18.19.0\" which does not satisfy engines.node requirement \">=20.0.0\"."
          }
        }
      };

      expect(runtimeDeclarationsConflictRule.preconditions(ctx)).toBe(true);
      const finding = runtimeDeclarationsConflictRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("RUNTIME_DECLARATIONS_CONFLICT");
      expect(finding?.severity).toBe("medium");
      expect(finding?.status).toBe("warning");
      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });

    it("does NOT trigger when there is no conflict", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        config: {
          runtimeConflict: {
            hasConflict: false
          }
        }
      };

      expect(runtimeDeclarationsConflictRule.preconditions(ctx)).toBe(false);
      expect(runtimeDeclarationsConflictRule.evaluate(ctx)).toBeNull();
    });
  });

  describe("COMPOSE_SERVICE_NOT_FOUND", () => {
    it("triggers when an app config references an undefined Docker Compose service", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        config: {
          compose: {
            hasCompose: true,
            services: ["database", "cache"],
            missingReferencedServices: [
              {
                serviceName: "auth-service",
                source: ".env.example"
              }
            ]
          }
        }
      };

      expect(composeServiceNotFoundRule.preconditions(ctx)).toBe(true);
      const finding = composeServiceNotFoundRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("COMPOSE_SERVICE_NOT_FOUND");
      expect(finding?.severity).toBe("high");
      expect(finding?.evidence[0]?.observed).toContain('Service name "auth-service" referenced in .env.example is not defined');
      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });

    it("does NOT trigger when all referenced services exist", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        config: {
          compose: {
            hasCompose: true,
            services: ["database"],
            missingReferencedServices: []
          }
        }
      };

      expect(composeServiceNotFoundRule.preconditions(ctx)).toBe(false);
      expect(composeServiceNotFoundRule.evaluate(ctx)).toBeNull();
    });
  });

  describe("Default Rule Registry has rules", () => {
    it("contains all registered rules", () => {
      const registry = createDefaultRuleRegistry();
      const rules = registry.list();
      expect(rules.length).toBe(40);

      const ids = rules.map((r) => r.id);
      expect(ids).toContain("NODE_DEPS_NOT_INSTALLED");
      expect(ids).toContain("ENV_EXAMPLE_PRESENT_NO_ENV");
      expect(ids).toContain("NODE_VERSION_MISMATCH");
      expect(ids).toContain("LOCKFILE_MISSING");
      expect(ids).toContain("PYTHON_VENV_MISSING");
      expect(ids).toContain("PORT_IN_USE");
      expect(ids).toContain("ENV_VAR_NAMES_MISSING");
      expect(ids).toContain("PORT_INVALID");
      expect(ids).toContain("RUNTIME_DECLARATIONS_CONFLICT");
      expect(ids).toContain("COMPOSE_SERVICE_NOT_FOUND");
    });
  });
});
