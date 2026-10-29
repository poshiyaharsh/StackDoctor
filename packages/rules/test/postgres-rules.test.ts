import { describe, it, expect } from "vitest";
import {
  postgresConnectionRefusedRule,
  postgresAuthFailedRule,
  postgresDatabaseNotFoundRule,
  postgresSslRequiredRule
} from "../src/index.js";
import type { RuleEvaluationContext } from "../src/types.js";

describe("PostgreSQL Rules", () => {
  const baseContext: RuleEvaluationContext = {
    dir: "/mock/postgres-project",
    files: {
      hasPackageJson: true,
      hasNodeModules: true,
      hasLockfile: true,
      hasEnvExample: false,
      hasEnv: false
    },
    technologies: [],
    evidence: []
  };

  describe("POSTGRES_CONNECTION_REFUSED", () => {
    it("matches precondition and produces finding when connection is refused", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        database: {
          diagnostics: [
            {
              dbType: "postgresql",
              host: "localhost",
              port: 5432,
              finalCategory: "connection_refused"
            }
          ]
        }
      };

      expect(postgresConnectionRefusedRule.preconditions(ctx)).toBe(true);
      const finding = postgresConnectionRefusedRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("POSTGRES_CONNECTION_REFUSED");
      expect(finding?.severity).toBe("high");
      expect(finding?.status).toBe("failed");
      expect(finding?.title).toContain("5432");

      // Verify zero false-positive policy: NEVER claim not installed
      const causesStr = JSON.stringify(finding?.possibleCauses || []);
      expect(causesStr.toLowerCase()).not.toContain("not installed");
    });

    it("evaluates to null when no postgres connection_refused is present", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        database: {
          diagnostics: [
            {
              dbType: "mysql",
              host: "localhost",
              port: 3306,
              finalCategory: "connection_refused"
            }
          ]
        }
      };

      expect(postgresConnectionRefusedRule.preconditions(ctx)).toBe(false);
      expect(postgresConnectionRefusedRule.evaluate(ctx)).toBeNull();
    });
  });

  describe("POSTGRES_AUTH_FAILED", () => {
    it("matches precondition and produces finding when auth fails", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        database: {
          diagnostics: [
            {
              dbType: "postgresql",
              host: "127.0.0.1",
              port: 5432,
              finalCategory: "auth_failed"
            }
          ]
        }
      };

      expect(postgresAuthFailedRule.preconditions(ctx)).toBe(true);
      const finding = postgresAuthFailedRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("POSTGRES_AUTH_FAILED");
      expect(finding?.severity).toBe("high");
      expect(finding?.possibleCauses.some((c) => c.toLowerCase().includes("role") || c.toLowerCase().includes("password"))).toBe(true);
    });

    it("evaluates to null when dbType is not postgresql", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        database: {
          diagnostics: [
            {
              dbType: "mongodb",
              host: "127.0.0.1",
              port: 27017,
              finalCategory: "auth_failed"
            }
          ]
        }
      };

      expect(postgresAuthFailedRule.preconditions(ctx)).toBe(false);
      expect(postgresAuthFailedRule.evaluate(ctx)).toBeNull();
    });
  });

  describe("POSTGRES_DATABASE_NOT_FOUND", () => {
    it("matches precondition and produces finding when database catalog is not found (3D000)", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        database: {
          diagnostics: [
            {
              dbType: "postgresql",
              host: "localhost",
              port: 5432,
              databaseName: "my_app_production",
              finalCategory: "database_not_found"
            }
          ]
        }
      };

      expect(postgresDatabaseNotFoundRule.preconditions(ctx)).toBe(true);
      const finding = postgresDatabaseNotFoundRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("POSTGRES_DATABASE_NOT_FOUND");
      expect(finding?.title).toContain("my_app_production");
      expect(finding?.recommendations[0]?.commandOrAction).toContain("createdb");
    });

    it("evaluates to null when category is not database_not_found", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        database: {
          diagnostics: [
            {
              dbType: "postgresql",
              host: "localhost",
              port: 5432,
              finalCategory: "connection_refused"
            }
          ]
        }
      };

      expect(postgresDatabaseNotFoundRule.preconditions(ctx)).toBe(false);
      expect(postgresDatabaseNotFoundRule.evaluate(ctx)).toBeNull();
    });
  });

  describe("POSTGRES_SSL_REQUIRED", () => {
    it("matches precondition and produces finding when SSL is required", () => {
      const ctx: RuleEvaluationContext = {
        ...baseContext,
        database: {
          diagnostics: [
            {
              dbType: "postgresql",
              host: "db.example.com",
              port: 5432,
              finalCategory: "ssl_required"
            }
          ]
        }
      };

      expect(postgresSslRequiredRule.preconditions(ctx)).toBe(true);
      const finding = postgresSslRequiredRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("POSTGRES_SSL_REQUIRED");
      expect(finding?.severity).toBe("medium");
      expect(finding?.recommendations[0]?.commandOrAction).toContain("sslmode=require");
    });

    it("evaluates to null when category is not ssl_required", () => {
      const ctx: RuleEvaluationContext = {
        baseContext,
        dir: "/mock/postgres-project",
        files: baseContext.files,
        technologies: [],
        evidence: [],
        database: {
          diagnostics: [
            {
              dbType: "postgresql",
              host: "db.example.com",
              port: 5432,
              finalCategory: "connection_refused"
            }
          ]
        }
      };

      expect(postgresSslRequiredRule.preconditions(ctx)).toBe(false);
      expect(postgresSslRequiredRule.evaluate(ctx)).toBeNull();
    });
  });
});
