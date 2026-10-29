import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const postgresAuthFailedRule: Rule = {
  id: "POSTGRES_AUTH_FAILED",
  title: "PostgreSQL authentication failed",
  category: "database",
  description: "Network connection to PostgreSQL succeeded, but user authentication was rejected (password authentication failed or role not authorized).",
  technologies: ["PostgreSQL"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["command_output"],
  recommendedChecks: [
    "Verify the database username and password in your environment variable or connection URL",
    "Verify pg_hba.conf client authentication records for the host and user",
    "Verify that the user role exists and has LOGIN privileges"
  ],
  remediation: [
    {
      problem: "PostgreSQL rejected the provided user credentials.",
      relevance: "Application cannot execute queries or initialize schemas without successful authentication.",
      commandOrAction: "Update the database credentials in your environment variable with a valid username and password.",
      expectedResult: "PostgreSQL accepts authentication and authorizes access.",
      risks: "Update credentials in local environment variable; never commit secrets to git.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify PostgreSQL authentication succeeds.",
  docs: ["https://www.postgresql.org/docs/current/auth-pg-hba-conf.html"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.diagnostics &&
      ctx.database.diagnostics.some(
        (d) =>
          d.dbType === "postgresql" &&
          (d.finalCategory === "auth_failed" || d.finalCategory === "authorization_failed")
      )
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const diag = ctx.database?.diagnostics?.find(
      (d) =>
        d.dbType === "postgresql" &&
        (d.finalCategory === "auth_failed" || d.finalCategory === "authorization_failed")
    );
    if (!diag) {
      return null;
    }

    const { host, port } = diag;

    return {
      ruleId: "POSTGRES_AUTH_FAILED",
      title: `PostgreSQL authentication failed on ${host}:${port}`,
      category: "database",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-postgres-auth-${host}-${port}`,
          kind: "command_output",
          description: "PostgreSQL authentication attempt",
          observed: `Network connection to ${host}:${port} succeeded, but PostgreSQL rejected authentication. (Secret values were not stored or logged).`,
          source: `${host}:${port}`,
          collectedAt: new Date().toISOString()
        }
      ],
      // MUST NOT suggest changing network settings!
      possibleCauses: [
        "Username or password specified in connection URL is incorrect.",
        "The user role does not exist in PostgreSQL or lacks LOGIN permissions.",
        "The server's pg_hba.conf rejects the authentication method (e.g., md5 vs scram-sha-256 vs trust)."
      ],
      recommendations: [
        {
          problem: "Invalid PostgreSQL credentials or unauthorized role.",
          relevance: "Authentication rejection prevents application initialization.",
          commandOrAction: "Update the database credentials in your environment variable to match an authorized PostgreSQL role.",
          expectedResult: "Authentication succeeds.",
          risks: "Credential update in environment only.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://www.postgresql.org/docs/current/auth-pg-hba-conf.html"]
    };
  }
};

