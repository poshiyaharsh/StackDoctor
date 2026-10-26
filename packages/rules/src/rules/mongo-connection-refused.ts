import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const mongoConnectionRefusedRule: Rule = {
  id: "MONGO_CONNECTION_REFUSED",
  title: "MongoDB connection refused on target endpoint",
  category: "database",
  description: "TCP connection to the configured MongoDB endpoint was actively refused (ECONNREFUSED).",
  technologies: ["MongoDB"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["network_probe"],
  recommendedChecks: [
    "Check if MongoDB server or daemon is currently running",
    "Verify target hostname and port in database configuration",
    "If using Docker, verify MongoDB container status with `docker compose ps`"
  ],
  remediation: [
    {
      problem: "MongoDB service is not listening on the configured address and port.",
      relevance: "Application crashes on startup when unable to establish connection to MongoDB.",
      commandOrAction: "Start MongoDB daemon (`mongod`) or start the database container (`docker compose up -d <service>`).",
      expectedResult: "MongoDB starts listening on target port and accepts TCP connections.",
      risks: "Starts database process or container; harmless to project code.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that TCP connection to MongoDB endpoint succeeds.",
  docs: ["https://www.mongodb.com/docs/manual/administration/monitoring/"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.diagnostics &&
      ctx.database.diagnostics.some(
        (d) => d.dbType === "mongodb" && d.finalCategory === "connection_refused"
      )
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const diag = ctx.database?.diagnostics?.find(
      (d) => d.dbType === "mongodb" && d.finalCategory === "connection_refused"
    );
    if (!diag) {
      return null;
    }

    const { host, port } = diag;

    return {
      ruleId: "MONGO_CONNECTION_REFUSED",
      title: `MongoDB connection refused on ${host}:${port}`,
      category: "database",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-mongo-refused-${host}-${port}`,
          kind: "network_probe",
          description: "MongoDB TCP connection probe",
          observed: `Connection to MongoDB at ${host}:${port} was refused (ECONNREFUSED).`,
          source: `${host}:${port}`,
          collectedAt: new Date().toISOString()
        }
      ],
      // CRITICAL NON-NEGOTIABLE RULE: NEVER claim something is uninstalled just because connection failed!
      possibleCauses: [
        "MongoDB service or daemon (mongod) is not currently running.",
        "The configured host or port is incorrect.",
        "MongoDB is running inside a Docker container that is stopped or has not forwarded port " + port + ".",
        "Local firewall or network configuration is blocking connection to port " + port + "."
      ],
      recommendations: [
        {
          problem: "MongoDB service is unreachable.",
          relevance: "Applications fail to initialize data layers without a running database.",
          commandOrAction: "Start MongoDB locally, or run `docker compose up -d` if using containers.",
          expectedResult: `MongoDB accepts connections on ${host}:${port}.`,
          risks: "Starts database service.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://www.mongodb.com/docs/manual/administration/monitoring/"]
    };
  }
};
