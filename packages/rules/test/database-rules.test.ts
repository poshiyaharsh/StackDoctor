import { describe, it, expect } from "vitest";
import {
  mongoConnectionRefusedRule,
  mongoAuthFailedRule,
  mysqlConnectionRefusedRule,
  mysqlAuthFailedRule,
  dbHostNotResolvedRule,
  dbConnectionTimeoutRule,
  createDefaultRuleRegistry,
  type RuleEvaluationContext
} from "@stackdoctor/rules";
import { FindingSchema } from "@stackdoctor/schemas";

describe("Phase 2 Run 2C Database Rules", () => {
  const baseContext: RuleEvaluationContext = {
    dir: "/test/project",
    files: {
      hasPackageJson: true,
      hasNodeModules: true,
      hasLockfile: true,
      lockfileType: "npm",
      hasEnvExample: false,
      hasEnv: false
    },
    technologies: [
      { name: "Node.js", confidence: "confirmed", evidence: [] },
      { name: "MongoDB", confidence: "confirmed", evidence: [] },
      { name: "MySQL", confidence: "confirmed", evidence: [] }
    ],
    evidence: []
  };

  describe("MONGO_CONNECTION_REFUSED", () => {
    it("triggers when MongoDB connection is refused and NEVER claims uninstalled", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        database: {
          diagnostics: [
            {
              dbType: "mongodb",
              host: "127.0.0.1",
              port: 27017,
              finalCategory: "connection_refused",
              error: "Connection refused (ECONNREFUSED)"
            }
          ]
        }
      };

      expect(mongoConnectionRefusedRule.preconditions(ctx)).toBe(true);
      const finding = mongoConnectionRefusedRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("MONGO_CONNECTION_REFUSED");
      expect(finding?.severity).toBe("high");
      expect(finding?.evidence[0]?.observed).toContain("refused (ECONNREFUSED)");

      // CRITICAL NON-NEGOTIABLE RULE: Must NOT claim MongoDB is uninstalled!
      const allCauses = finding?.possibleCauses.join(" ") || "";
      expect(allCauses.toLowerCase()).not.toContain("uninstalled");
      expect(allCauses.toLowerCase()).not.toContain("not installed");

      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });
  });

  describe("MONGO_AUTH_FAILED", () => {
    it("triggers on MongoDB auth failure and separates auth from network settings", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        database: {
          diagnostics: [
            {
              dbType: "mongodb",
              host: "127.0.0.1",
              port: 27017,
              finalCategory: "auth_failed",
              error: "Authentication failed"
            }
          ]
        }
      };

      expect(mongoAuthFailedRule.preconditions(ctx)).toBe(true);
      const finding = mongoAuthFailedRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("MONGO_AUTH_FAILED");
      expect(finding?.severity).toBe("high");

      // Verify causes focus on credentials and permissions, not network issues
      const causes = finding?.possibleCauses.join(" ") || "";
      expect(causes.toLowerCase()).toContain("password");
      expect(causes).not.toContain("ECONNREFUSED");

      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });
  });

  describe("MYSQL_CONNECTION_REFUSED", () => {
    it("triggers when MySQL connection is refused and NEVER claims uninstalled", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        database: {
          diagnostics: [
            {
              dbType: "mysql",
              host: "127.0.0.1",
              port: 3306,
              finalCategory: "connection_refused",
              error: "Connection refused (ECONNREFUSED)"
            }
          ]
        }
      };

      expect(mysqlConnectionRefusedRule.preconditions(ctx)).toBe(true);
      const finding = mysqlConnectionRefusedRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("MYSQL_CONNECTION_REFUSED");

      const allCauses = finding?.possibleCauses.join(" ") || "";
      expect(allCauses.toLowerCase()).not.toContain("uninstalled");
      expect(allCauses.toLowerCase()).not.toContain("not installed");

      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });
  });

  describe("MYSQL_AUTH_FAILED", () => {
    it("triggers on MySQL auth failure", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        database: {
          diagnostics: [
            {
              dbType: "mysql",
              host: "127.0.0.1",
              port: 3306,
              finalCategory: "auth_failed",
              error: "Access denied"
            }
          ]
        }
      };

      expect(mysqlAuthFailedRule.preconditions(ctx)).toBe(true);
      const finding = mysqlAuthFailedRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("MYSQL_AUTH_FAILED");
      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });
  });

  describe("DB_HOST_NOT_RESOLVED", () => {
    it("triggers when database hostname cannot be resolved via DNS", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        database: {
          diagnostics: [
            {
              dbType: "mongodb",
              host: "unresolvable-cloud-db.internal",
              port: 27017,
              finalCategory: "dns_failure",
              error: "ENOTFOUND"
            }
          ]
        }
      };

      expect(dbHostNotResolvedRule.preconditions(ctx)).toBe(true);
      const finding = dbHostNotResolvedRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("DB_HOST_NOT_RESOLVED");
      expect(finding?.severity).toBe("high");
      expect(finding?.evidence[0]?.observed).toContain("DNS lookup failed");
      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });
  });

  describe("DB_CONNECTION_TIMEOUT", () => {
    it("triggers when database connection times out", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        database: {
          diagnostics: [
            {
              dbType: "mongodb",
              host: "cluster0.mongodb.net",
              port: 27017,
              finalCategory: "timeout",
              error: "ETIMEDOUT"
            }
          ]
        }
      };

      expect(dbConnectionTimeoutRule.preconditions(ctx)).toBe(true);
      const finding = dbConnectionTimeoutRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("DB_CONNECTION_TIMEOUT");
      expect(finding?.severity).toBe("high");
      expect(finding?.evidence[0]?.observed).toContain("timed out");
      expect(finding?.possibleCauses.some((c) => c.includes("IP whitelist") || c.includes("firewall"))).toBe(true);
      expect(FindingSchema.safeParse(finding).success).toBe(true);
    });
  });

  describe("Distinct findings for failure categories", () => {
    it("produces four distinct findings for refused, DNS failure, timeout, and auth failure", () => {
      const baseDiag = { dbType: "mongodb" as const, host: "db.local", port: 27017 };

      const refusedFinding = mongoConnectionRefusedRule.evaluate({
        ...baseContext,
        database: { diagnostics: [{ ...baseDiag, finalCategory: "connection_refused" }] }
      });

      const dnsFinding = dbHostNotResolvedRule.evaluate({
        ...baseContext,
        database: { diagnostics: [{ ...baseDiag, finalCategory: "dns_failure" }] }
      });

      const timeoutFinding = dbConnectionTimeoutRule.evaluate({
        ...baseContext,
        database: { diagnostics: [{ ...baseDiag, finalCategory: "timeout" }] }
      });

      const authFinding = mongoAuthFailedRule.evaluate({
        ...baseContext,
        database: { diagnostics: [{ ...baseDiag, finalCategory: "auth_failed" }] }
      });

      const ruleIds = [
        refusedFinding?.ruleId,
        dnsFinding?.ruleId,
        timeoutFinding?.ruleId,
        authFinding?.ruleId
      ];

      // All 4 rule IDs must be unique
      expect(new Set(ruleIds).size).toBe(4);
    });
  });

  describe("Default Rule Registry has 20 rules", () => {
    it("registers all 20 rules", () => {
      const registry = createDefaultRuleRegistry();
      const rules = registry.list();
      expect(rules.length).toBe(20);

      const ids = rules.map((r) => r.id);
      expect(ids).toContain("MONGO_CONNECTION_REFUSED");
      expect(ids).toContain("MONGO_AUTH_FAILED");
      expect(ids).toContain("MYSQL_CONNECTION_REFUSED");
      expect(ids).toContain("MYSQL_AUTH_FAILED");
      expect(ids).toContain("DB_HOST_NOT_RESOLVED");
      expect(ids).toContain("DB_CONNECTION_TIMEOUT");
    });
  });
});
