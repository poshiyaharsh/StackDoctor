import { describe, it, expect } from "vitest";
import { mssqlConnectionRefusedRule } from "../src/rules/mssql-connection-refused.js";
import { mssqlAuthFailedRule } from "../src/rules/mssql-auth-failed.js";
import type { RuleEvaluationContext } from "../src/types.js";

function makeBaseContext(): RuleEvaluationContext {
  return {
    dir: "/test/mssql-project",
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
}

describe("Microsoft SQL Server Diagnostic Rules", () => {
  describe("MSSQL_CONNECTION_REFUSED", () => {
    it("does not trigger when no mssql diagnostics or connection succeeds", () => {
      const ctx = makeBaseContext();
      expect(mssqlConnectionRefusedRule.preconditions(ctx)).toBe(false);
      expect(mssqlConnectionRefusedRule.evaluate(ctx)).toBeNull();

      ctx.database = {
        diagnostics: [
          {
            dbType: "mssql",
            host: "localhost",
            port: 1433
          }
        ]
      };
      expect(mssqlConnectionRefusedRule.preconditions(ctx)).toBe(false);
      expect(mssqlConnectionRefusedRule.evaluate(ctx)).toBeNull();
    });

    it("triggers when TCP connection to MSSQL endpoint is refused", () => {
      const ctx = makeBaseContext();
      ctx.database = {
        diagnostics: [
          {
            dbType: "mssql",
            host: "127.0.0.1",
            port: 1433,
            finalCategory: "connection_refused"
          }
        ]
      };

      expect(mssqlConnectionRefusedRule.preconditions(ctx)).toBe(true);
      const finding = mssqlConnectionRefusedRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("MSSQL_CONNECTION_REFUSED");
      expect(finding?.title).toContain("Microsoft SQL Server connection refused on 127.0.0.1:1433");
      expect(finding?.severity).toBe("high");
      expect(finding?.evidence[0].kind).toBe("network_probe");
    });
  });

  describe("MSSQL_AUTH_FAILED", () => {
    it("does not trigger when authentication succeeds or not tested", () => {
      const ctx = makeBaseContext();
      expect(mssqlAuthFailedRule.preconditions(ctx)).toBe(false);
      expect(mssqlAuthFailedRule.evaluate(ctx)).toBeNull();
    });

    it("triggers when MSSQL login authentication fails", () => {
      const ctx = makeBaseContext();
      ctx.database = {
        diagnostics: [
          {
            dbType: "mssql",
            host: "db.internal",
            port: 1433,
            finalCategory: "auth_failed",
            error: "Microsoft SQL Server authentication failed: Login failed for user 'sa'"
          }
        ]
      };

      expect(mssqlAuthFailedRule.preconditions(ctx)).toBe(true);
      const finding = mssqlAuthFailedRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("MSSQL_AUTH_FAILED");
      expect(finding?.title).toContain("Microsoft SQL Server authentication failed on db.internal:1433");
      expect(finding?.severity).toBe("high");
      expect(finding?.evidence[0].kind).toBe("command_output");
    });
  });
});
