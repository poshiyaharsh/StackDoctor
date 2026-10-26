import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const mongoAuthFailedRule: Rule = {
  id: "MONGO_AUTH_FAILED",
  title: "MongoDB authentication failed",
  category: "database",
  description: "Network connection to MongoDB succeeded, but user authentication failed (invalid username, password, or authSource).",
  technologies: ["MongoDB"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["command_output"],
  recommendedChecks: [
    "Verify the database username and password in your environment variable",
    "Verify the authentication database (authSource, default is 'admin')",
    "Verify user permissions on target database"
  ],
  remediation: [
    {
      problem: "MongoDB rejected the provided credentials.",
      relevance: "Application cannot access collections or execute queries without successful authentication.",
      commandOrAction: "Verify and update the database username, password, and authSource in your environment variable.",
      expectedResult: "MongoDB accepts authentication and authorizes access.",
      risks: "Update credentials in local environment variable; never commit secrets to git.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify MongoDB authentication succeeds.",
  docs: ["https://www.mongodb.com/docs/manual/core/security-users/"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.diagnostics &&
      ctx.database.diagnostics.some(
        (d) => d.dbType === "mongodb" && d.finalCategory === "auth_failed"
      )
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const diag = ctx.database?.diagnostics?.find(
      (d) => d.dbType === "mongodb" && d.finalCategory === "auth_failed"
    );
    if (!diag) {
      return null;
    }

    const { host, port } = diag;

    return {
      ruleId: "MONGO_AUTH_FAILED",
      title: `MongoDB authentication failed on ${host}:${port}`,
      category: "database",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-mongo-auth-${host}-${port}`,
          kind: "command_output",
          description: "MongoDB authentication attempt",
          observed: `Network connection to ${host}:${port} succeeded, but MongoDB rejected the provided credentials. (Secret values were not stored or logged).`,
          source: `${host}:${port}`,
          collectedAt: new Date().toISOString()
        }
      ],
      // MUST NOT suggest changing network settings, as network connection already succeeded!
      possibleCauses: [
        "Username or password specified in connection URL is incorrect.",
        "The user was created on a different authentication database (authSource, e.g. 'admin' vs target db).",
        "The user lacks permissions or roles for the requested database."
      ],
      recommendations: [
        {
          problem: "Invalid MongoDB credentials.",
          relevance: "Authentication rejection prevents application initialization.",
          commandOrAction: "Update the database credentials in your environment variable to match an authorized MongoDB user.",
          expectedResult: "Authentication succeeds.",
          risks: "Credential update in environment only.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://www.mongodb.com/docs/manual/core/security-users/"]
    };
  }
};
