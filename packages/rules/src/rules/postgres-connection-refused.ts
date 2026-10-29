import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const postgresConnectionRefusedRule: Rule = {
  id: "POSTGRES_CONNECTION_REFUSED",
  title: "PostgreSQL connection refused on target endpoint",
  category: "database",
  description: "TCP connection to the configured PostgreSQL endpoint was actively refused (ECONNREFUSED).",
  technologies: ["PostgreSQL"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["network_probe"],
  recommendedChecks: [
    "Check if PostgreSQL service or daemon is currently running",
    "Verify target hostname and port in database configuration",
    "If using Docker, verify PostgreSQL container status with `docker compose ps`"
  ],
  remediation: [
    {
      problem: "PostgreSQL service is not listening on the configured address and port.",
      relevance: "Application crashes on startup when unable to establish connection to PostgreSQL.",
      commandOrAction: "Start PostgreSQL service locally or start the database container (`docker compose up -d <service>`).",
      expectedResult: "PostgreSQL starts listening on target port and accepts TCP connections.",
      risks: "Starts database process or container; harmless to project code.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that TCP connection to PostgreSQL endpoint succeeds.",
  docs: ["https://www.postgresql.org/docs/current/server-start.html"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.diagnostics &&
      ctx.database.diagnostics.some(
        (d) => d.dbType === "postgresql" && d.finalCategory === "connection_refused"
      )
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const diag = ctx.database?.diagnostics?.find(
      (d) => d.dbType === "postgresql" && d.finalCategory === "connection_refused"
    );
    if (!diag) {
      return null;
    }

    const { host, port } = diag;

    return {
      ruleId: "POSTGRES_CONNECTION_REFUSED",
      title: `PostgreSQL connection refused on ${host}:${port}`,
      category: "database",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-postgres-refused-${host}-${port}`,
          kind: "network_probe",
          description: "PostgreSQL TCP connection probe",
          observed: `Connection to PostgreSQL at ${host}:${port} was refused (ECONNREFUSED).`,
          source: `${host}:${port}`,
          collectedAt: new Date().toISOString()
        }
      ],
      // CRITICAL NON-NEGOTIABLE RULE: NEVER claim something is uninstalled just because connection failed!
      possibleCauses: [
        "PostgreSQL service or daemon is not currently running.",
        "The configured host or port is incorrect.",
        `PostgreSQL is running inside a Docker container that is stopped or has not forwarded port ${port}.`,
        `Local firewall or network configuration is blocking connection to port ${port}.`
      ],
      recommendations: [
        {
          problem: "PostgreSQL service is unreachable.",
          relevance: "Applications fail to initialize data layers without a running database.",
          commandOrAction: "Start PostgreSQL locally, or run `docker compose up -d` if using containers.",
          expectedResult: `PostgreSQL accepts connections on ${host}:${port}.`,
          risks: "Starts database service.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://www.postgresql.org/docs/current/server-start.html"]
    };
  }
};
