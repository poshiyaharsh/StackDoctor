import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const mysqlAuthFailedRule: Rule = {
  id: "MYSQL_AUTH_FAILED",
  title: "MySQL authentication failed",
  category: "database",
  description: "Network connection to MySQL succeeded, but user authentication was rejected (Access denied for user).",
  technologies: ["MySQL"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["command_output"],
  recommendedChecks: [
    "Verify the database username and password in your environment variable",
    "Verify host access privileges (e.g. 'user'@'localhost' vs 'user'@'%')",
    "Verify default database permissions for the user"
  ],
  remediation: [
    {
      problem: "MySQL server rejected the provided credentials.",
      relevance: "Application cannot execute queries or initialize schemas without successful authentication.",
      commandOrAction: "Update the database credentials in your environment variable with a valid username and password.",
      expectedResult: "MySQL accepts authentication and authorizes access.",
      risks: "Update credentials in local environment variable; never commit secrets to git.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify MySQL authentication succeeds.",
  docs: ["https://dev.mysql.com/doc/refman/8.0/en/access-denied.html"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.diagnostics &&
      ctx.database.diagnostics.some(
        (d) => d.dbType === "mysql" && d.finalCategory === "auth_failed"
      )
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const diag = ctx.database?.diagnostics?.find(
      (d) => d.dbType === "mysql" && d.finalCategory === "auth_failed"
    );
    if (!diag) {
      return null;
    }

    const { host, port } = diag;

    return {
      ruleId: "MYSQL_AUTH_FAILED",
      title: `MySQL authentication failed on ${host}:${port}`,
      category: "database",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-mysql-auth-${host}-${port}`,
          kind: "command_output",
          description: "MySQL authentication attempt",
          observed: `Network connection to ${host}:${port} succeeded, but MySQL rejected the provided credentials (Access denied). (Secret values were not stored or logged).`,
          source: `${host}:${port}`,
          collectedAt: new Date().toISOString()
        }
      ],
      // MUST NOT suggest changing network settings!
      possibleCauses: [
        "Username or password specified in connection URL is incorrect.",
        "The user account is restricted to a specific host (e.g. 'root'@'localhost' but connection originated from another host).",
        "The user account does not have GRANT privileges on the requested database."
      ],
      recommendations: [
        {
          problem: "Invalid MySQL credentials.",
          relevance: "Authentication rejection prevents application initialization.",
          commandOrAction: "Update the database credentials in your environment variable to match an authorized MySQL user.",
          expectedResult: "Authentication succeeds.",
          risks: "Credential update in environment only.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://dev.mysql.com/doc/refman/8.0/en/access-denied.html"]
    };
  }
};
