import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const dbConnectionTimeoutRule: Rule = {
  id: "DB_CONNECTION_TIMEOUT",
  title: "Database connection timed out",
  category: "database",
  description: "TCP connection to the database endpoint timed out before establishing a socket connection.",
  technologies: ["MongoDB", "MySQL"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["network_probe"],
  recommendedChecks: [
    "Check network connectivity and routing to target host",
    "Check cloud database IP access list / security group rules (e.g. MongoDB Atlas, AWS RDS)",
    "Verify firewall rules permitting outbound connection on target port"
  ],
  remediation: [
    {
      problem: "Network connection to database host timed out.",
      relevance: "Application hangs or crashes after driver connection timeout expires.",
      commandOrAction: "Add your current IP address to the cloud database IP access list, or check firewall routing.",
      expectedResult: "TCP connection establishes within the timeout window.",
      risks: "Network and security group configuration.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that TCP connection completes before timeout.",
  docs: ["https://en.wikipedia.org/wiki/Connection_timeout"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.diagnostics &&
      ctx.database.diagnostics.some((d) => d.finalCategory === "timeout")
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const diag = ctx.database?.diagnostics?.find((d) => d.finalCategory === "timeout");
    if (!diag) {
      return null;
    }

    const { host, port } = diag;

    return {
      ruleId: "DB_CONNECTION_TIMEOUT",
      title: `Database connection to ${host}:${port} timed out`,
      category: "database",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-db-timeout-${host}-${port}`,
          kind: "network_probe",
          description: "Database TCP connection timeout",
          observed: `TCP connection to database endpoint at ${host}:${port} timed out without receiving a response.`,
          source: `${host}:${port}`,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "A cloud database firewall or IP whitelist (e.g. MongoDB Atlas Network Access) is blocking your current IP address.",
        "A local or corporate firewall is dropping outbound packets to port " + port + ".",
        "The target host is offline, sleeping, or experiencing extreme latency.",
        "Network routing or VPN connection between client and database server is disrupted."
      ],
      recommendations: [
        {
          problem: "Database endpoint is not responding to connection requests.",
          relevance: "Causes application timeouts and unavailable database sessions.",
          commandOrAction: "Whitelist your current public IP address in your database management console (Atlas / AWS RDS) or inspect firewall rules.",
          expectedResult: `Packets reach ${host}:${port} and connection handshakes succeed.`,
          risks: "Security group rules update.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://en.wikipedia.org/wiki/Connection_timeout"]
    };
  }
};
