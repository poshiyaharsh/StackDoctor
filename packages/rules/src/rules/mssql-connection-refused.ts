import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const mssqlConnectionRefusedRule: Rule = {
  id: "MSSQL_CONNECTION_REFUSED",
  title: "Microsoft SQL Server connection refused on target endpoint",
  category: "database",
  description: "TCP connection to the configured Microsoft SQL Server endpoint was actively refused (ECONNREFUSED).",
  technologies: ["Microsoft SQL Server"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["network_probe"],
  recommendedChecks: [
    "Check if Microsoft SQL Server service (MSSQLSERVER or SQL Express) or container is currently running",
    "Verify that TCP/IP protocol is enabled in SQL Server Configuration Manager",
    "Verify target hostname and port (default 1433) in database connection string"
  ],
  remediation: [
    {
      problem: "Microsoft SQL Server is not accepting TCP connections on the configured address and port.",
      relevance: "Application crashes on startup when unable to establish connection to Microsoft SQL Server.",
      commandOrAction: "Start SQL Server service locally or start the database container (`docker compose up -d <service>`).",
      expectedResult: "Microsoft SQL Server accepts TCP connections on target port.",
      risks: "Starts database process or container; harmless to project code.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that TCP connection to Microsoft SQL Server endpoint succeeds.",
  docs: ["https://learn.microsoft.com/sql/database-engine/configure-windows/troubleshoot-connecting-to-the-sql-server-database-engine"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.diagnostics &&
      ctx.database.diagnostics.some(
        (d) => d.dbType === "mssql" && d.finalCategory === "connection_refused"
      )
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const diag = ctx.database?.diagnostics?.find(
      (d) => d.dbType === "mssql" && d.finalCategory === "connection_refused"
    );
    if (!diag) {
      return null;
    }

    const { host, port } = diag;

    return {
      ruleId: "MSSQL_CONNECTION_REFUSED",
      title: `Microsoft SQL Server connection refused on ${host}:${port}`,
      category: "database",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-mssql-refused-${host}-${port}`,
          kind: "network_probe",
          description: `TCP connection probe to ${host}:${port}`,
          observed: `Connection actively refused on ${host}:${port} (ECONNREFUSED). Microsoft SQL Server is not listening.`,
          source: `${host}:${port}`,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "Microsoft SQL Server service (MSSQLSERVER or SQL Express) is not running.",
        "TCP/IP protocol is disabled in SQL Server Configuration Manager.",
        "Target hostname or port in database connection string is misconfigured.",
        "SQL Server is running in a Docker container that has not started or port 1433 is not mapped."
      ],
      recommendations: [
        {
          problem: `Microsoft SQL Server on ${host}:${port} is unreachable.`,
          relevance: "Application crashes on startup when unable to establish connection to Microsoft SQL Server.",
          commandOrAction: "Start the SQL Server service locally or run `docker compose up -d` if using containers.",
          expectedResult: `Microsoft SQL Server accepts TCP connections on ${host}:${port}.`,
          risks: "Starts database service.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://learn.microsoft.com/sql/database-engine/configure-windows/troubleshoot-connecting-to-the-sql-server-database-engine"]
    };
  }
};
