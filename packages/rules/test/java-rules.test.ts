import { describe, it, expect } from "vitest";
import {
  javaVersionMismatchRule,
  javaRuntimeMissingRule,
  springBootDatasourceMissingRule,
  springBootPortInUseRule
} from "../src/index.js";
import type { RuleEvaluationContext } from "../src/types.js";

describe("Java & Spring Boot Rules", () => {
  const baseContext: RuleEvaluationContext = {
    dir: "/mock/java-project",
    files: {
      hasPackageJson: false,
      hasNodeModules: false,
      hasLockfile: false,
      hasEnvExample: false,
      hasEnv: false
    },
    technologies: [{ name: "Java", confidence: "confirmed", evidence: [] }],
    evidence: []
  };

  describe("JAVA_VERSION_MISMATCH", () => {
    it("flags when installed Java version is lower than declared requirement", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        java: {
          installed: true,
          rawVersion: "1.8.0_401",
          majorVersion: 8,
          requirement: {
            declared: true,
            requiredVersion: "17",
            requiredMajor: 17,
            sourceFile: "pom.xml",
            sourceProperty: "<java.version>"
          }
        }
      };

      expect(javaVersionMismatchRule.preconditions(ctx)).toBe(true);
      const finding = javaVersionMismatchRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("JAVA_VERSION_MISMATCH");
      expect(finding?.severity).toBe("high");
      expect(finding?.title).toContain("17");
      expect(finding?.evidence[0]?.observed).toContain("major: 8");
    });

    it("evaluates to null when installed Java version satisfies requirement", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        java: {
          installed: true,
          rawVersion: "17.0.2",
          majorVersion: 17,
          requirement: {
            declared: true,
            requiredVersion: "17",
            requiredMajor: 17,
            sourceFile: "pom.xml"
          }
        }
      };

      expect(javaVersionMismatchRule.preconditions(ctx)).toBe(false);
      expect(javaVersionMismatchRule.evaluate(ctx)).toBeNull();
    });
  });

  describe("JAVA_RUNTIME_MISSING", () => {
    it("flags when Java project is detected but java executable is missing", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        java: {
          installed: false,
          error: "java not found"
        }
      };

      expect(javaRuntimeMissingRule.preconditions(ctx)).toBe(true);
      const finding = javaRuntimeMissingRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("JAVA_RUNTIME_MISSING");
      expect(finding?.severity).toBe("high");
    });

    it("evaluates to null when Java is installed", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        java: {
          installed: true,
          majorVersion: 17
        }
      };

      expect(javaRuntimeMissingRule.preconditions(ctx)).toBe(false);
      expect(javaRuntimeMissingRule.evaluate(ctx)).toBeNull();
    });
  });

  describe("SPRING_BOOT_DATASOURCE_MISSING", () => {
    it("flags when Spring Data dependency is present without datasource url or embedded db", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        technologies: [
          { name: "Java", confidence: "confirmed", evidence: [] },
          { name: "Spring Boot", confidence: "confirmed", evidence: [] }
        ],
        springBoot: {
          isSpringBoot: true,
          hasDataDependency: true,
          hasEmbeddedDatabase: false,
          datasourceUrlConfigured: false,
          serverPortDeclared: false
        }
      };

      expect(springBootDatasourceMissingRule.preconditions(ctx)).toBe(true);
      const finding = springBootDatasourceMissingRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("SPRING_BOOT_DATASOURCE_MISSING");
      expect(finding?.severity).toBe("high");
      expect(finding?.recommendations[0]?.commandOrAction).toContain("spring.datasource.url");
    });

    it("evaluates to null when datasource url is configured", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        springBoot: {
          isSpringBoot: true,
          hasDataDependency: true,
          hasEmbeddedDatabase: false,
          datasourceUrlConfigured: true,
          serverPortDeclared: false
        }
      };

      expect(springBootDatasourceMissingRule.preconditions(ctx)).toBe(false);
      expect(springBootDatasourceMissingRule.evaluate(ctx)).toBeNull();
    });

    it("evaluates to null when an embedded database (e.g. H2) is used", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        springBoot: {
          isSpringBoot: true,
          hasDataDependency: true,
          hasEmbeddedDatabase: true,
          datasourceUrlConfigured: false,
          serverPortDeclared: false
        }
      };

      expect(springBootDatasourceMissingRule.preconditions(ctx)).toBe(false);
      expect(springBootDatasourceMissingRule.evaluate(ctx)).toBeNull();
    });
  });

  describe("SPRING_BOOT_PORT_IN_USE", () => {
    it("flags when configured server port is in use", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        springBoot: {
          isSpringBoot: true,
          hasDataDependency: false,
          hasEmbeddedDatabase: false,
          datasourceUrlConfigured: false,
          serverPort: 8080,
          serverPortDeclared: true
        },
        ports: {
          portChecks: [
            {
              port: 8080,
              host: "127.0.0.1",
              status: "in_use",
              conclusive: true,
              processInfo: { pid: 4567, name: "java" }
            }
          ]
        }
      };

      expect(springBootPortInUseRule.preconditions(ctx)).toBe(true);
      const finding = springBootPortInUseRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("SPRING_BOOT_PORT_IN_USE");
      expect(finding?.severity).toBe("high");
      expect(finding?.evidence[0]?.observed).toContain("8080");
    });

    it("evaluates to null when port is available", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        springBoot: {
          isSpringBoot: true,
          hasDataDependency: false,
          hasEmbeddedDatabase: false,
          datasourceUrlConfigured: false,
          serverPort: 8080,
          serverPortDeclared: true
        },
        ports: {
          portChecks: [
            {
              port: 8080,
              host: "127.0.0.1",
              status: "available",
              conclusive: true
            }
          ]
        }
      };

      expect(springBootPortInUseRule.preconditions(ctx)).toBe(false);
      expect(springBootPortInUseRule.evaluate(ctx)).toBeNull();
    });
  });
});

