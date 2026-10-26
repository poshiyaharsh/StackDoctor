import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const mysqlConnectionRefusedRule: Rule = {
  id: "MYSQL_CONNECTION_REFUSED",
  title: "MySQL connection refused on target endpoint",
  category: "database",
  description: "TCP connection to the configured MySQL endpoint was actively refused (ECONNREFUSED).",
  technologies: ["MySQL"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["network_probe"],
  recommendedChecks: [
    "Check if MySQL service or daemon is currently running",
    "Verify target hostname and port in database configuration",
    "If using Docker, check container status with `docker compose ps`"
  ],
  remediation: [
    {
      problem: "MySQL service is not listening on the configured address and port.",
      relevance: "Application crashes on startup when unable to establish connection to MySQL.",
      commandOrAction: "Start MySQL service or start the database container (`docker compose up -d <service>`).",
      expectedResult: "MySQL starts listening on target port and accepts TCP connections.",
      risks: "Starts database process or container; harmless to project code.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that TCP connection to MySQL endpoint succeeds.",
  docs: ["https://dev.mysql.com/doc/refman/8.0/en/can-not-connect-to-server.html"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.diagnostics &&
      ctx.database.diagnostics.some(
        (d) => d.dbType === "mysql" && d.finalCategory === "connection_refused"
      )
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const diag = ctx.database?.diagnostics?.find(
      (d) => d.dbType === "mysql" && d.finalCategory === "connection_refused"
    );
    if (!diag) {
      return null;
    }

    const { host, port } = diag;

    return {
      ruleId: "MYSQL_CONNECTION_REFUSED",
      title: `MySQL connection refused on ${host}:${port}`,
      category: "database",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-mysql-refused-${host}-${port}`,
          kind: "network_probe",
          description: "MySQL TCP connection probe",
          observed: `Connection to MySQL at ${host}:${port} was refused (ECONNREFUSED).`,
          source: `${host}:${port}`,
          collectedAt: new Date().toISOString()
        }
      ],
      // CRITICAL NON-NEGOTIABLE RULE: NEVER claim something is uninstalled just because connection failed!
      possibleCauses: [
        "MySQL service (mysqld) is not currently running.",
        "The configured host or port is incorrect.",
        "MySQL is running inside a Docker container that is stopped or has not mapped port " + port + ".",
        "Local firewall or network configuration is blocking connection to port " + port + "."
      ],
      recommendations: [
        {
          problem: "MySQL service is unreachable.",
          relevance: "Applications fail to initialize data layers without a running database.",
          commandOrAction: "Start MySQL locally or run `docker compose up -d` if using containers.",
          expectedResult: `MySQL accepts connections on ${host}:${port}.`,
          risks: "Starts database service.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://dev.mysql.com/doc/refman/8.0/en/can-not-connect-to-server.html"]
    };
  }
};
