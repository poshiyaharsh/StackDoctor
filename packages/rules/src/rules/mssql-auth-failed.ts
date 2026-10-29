import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const mssqlAuthFailedRule: Rule = {
  id: "MSSQL_AUTH_FAILED",
  title: "Microsoft SQL Server authentication failed",
  category: "database",
  description: "Authentication to Microsoft SQL Server failed (invalid username or password, disabled login, or untrusted domain).",
  technologies: ["Microsoft SQL Server"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["command_output"],
  recommendedChecks: [
    "Verify the SQL Server login username and password in your environment configuration",
    "Ensure Mixed Mode Authentication (SQL Server and Windows Authentication mode) is enabled on the server",
    "Confirm that the login account exists and is not locked or disabled"
  ],
  remediation: [
    {
      problem: "Microsoft SQL Server rejected the provided login credentials (Error 18456).",
      relevance: "Application fails to initialize database connection pools on startup.",
      commandOrAction: "Update the database credentials in your environment configuration to match an authorized SQL Server login.",
      expectedResult: "Authentication succeeds and queries execute properly.",
      risks: "Configuration update only; harmless to existing database state.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that Microsoft SQL Server accepts the configured authentication credentials.",
  docs: ["https://learn.microsoft.com/sql/relational-databases/security/authentication-access/principals-database-engine"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.diagnostics &&
      ctx.database.diagnostics.some(
        (d) => d.dbType === "mssql" && d.finalCategory === "auth_failed"
      )
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const diag = ctx.database?.diagnostics?.find(
      (d) => d.dbType === "mssql" && d.finalCategory === "auth_failed"
    );
    if (!diag) {
      return null;
    }

    const { host, port } = diag;

    return {
      ruleId: "MSSQL_AUTH_FAILED",
      title: `Microsoft SQL Server authentication failed on ${host}:${port}`,
      category: "database",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-mssql-auth-${host}-${port}`,
          kind: "command_output",
          description: `Authentication verification for ${host}:${port}`,
          observed: diag.error || "Microsoft SQL Server rejected credentials (Error 18456 / Login failed).",
          source: `mssql://${host}:${port}`,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "The configured username or password is incorrect.",
        "SQL Server is configured in Windows Authentication mode only instead of Mixed Mode Authentication.",
        "The SQL Server login account is disabled or locked.",
        "The user does not have permission to connect to the database engine."
      ],
      recommendations: [
        {
          problem: `Microsoft SQL Server login authentication failed on ${host}:${port}.`,
          relevance: "Application fails to initialize database connection pools on startup.",
          commandOrAction: "Update the database credentials in your configuration to match an authorized SQL Server login.",
          expectedResult: "Authentication succeeds and queries execute properly.",
          risks: "Configuration update only; harmless to existing database state.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://learn.microsoft.com/sql/relational-databases/security/authentication-access/principals-database-engine"]
    };
  }
};
