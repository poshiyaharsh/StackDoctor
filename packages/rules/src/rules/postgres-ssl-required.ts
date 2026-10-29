import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const postgresSslRequiredRule: Rule = {
  id: "POSTGRES_SSL_REQUIRED",
  title: "PostgreSQL requires SSL/TLS connection",
  category: "database",
  description: "PostgreSQL server rejected unencrypted connection because SSL/TLS encryption is enforced by server configuration.",
  technologies: ["PostgreSQL"],
  severity: "medium",
  confidence: "confirmed",
  requiredEvidence: ["command_output"],
  recommendedChecks: [
    "Verify whether the PostgreSQL server requires SSL/TLS (e.g. hostssl in pg_hba.conf or cloud database requirement)",
    "Check if your connection string or client configuration has sslmode specified (e.g., sslmode=require)"
  ],
  remediation: [
    {
      problem: "PostgreSQL connection rejected due to missing SSL/TLS encryption.",
      relevance: "Application cannot communicate with the database when the server requires encrypted connections.",
      commandOrAction: "Enable SSL in your PostgreSQL connection string by appending `?sslmode=require` or configure SSL options in your database client.",
      expectedResult: "PostgreSQL establishes an encrypted TLS connection and accepts commands.",
      risks: "Requires valid SSL/TLS certificates or appropriate sslmode setting.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that encrypted SSL/TLS connection to PostgreSQL succeeds.",
  docs: ["https://www.postgresql.org/docs/current/ssl-tcp.html"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.diagnostics &&
      ctx.database.diagnostics.some(
        (d) => d.dbType === "postgresql" && d.finalCategory === "ssl_required"
      )
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const diag = ctx.database?.diagnostics?.find(
      (d) => d.dbType === "postgresql" && d.finalCategory === "ssl_required"
    );
    if (!diag) {
      return null;
    }

    const { host, port } = diag;

    return {
      ruleId: "POSTGRES_SSL_REQUIRED",
      title: `PostgreSQL requires SSL/TLS connection on ${host}:${port}`,
      category: "database",
      severity: "medium",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-postgres-ssl-${host}-${port}`,
          kind: "command_output",
          description: "PostgreSQL SSL connection probe",
          observed: `PostgreSQL connection to ${host}:${port} was rejected because SSL encryption is required by server configuration.`,
          source: `${host}:${port}`,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "The server pg_hba.conf contains a `hostssl` line requiring encryption for incoming connections.",
        "A managed cloud PostgreSQL instance (e.g., Supabase, Neon, AWS RDS, GCP Cloud SQL) requires SSL by default.",
        "The client connection string lacks `sslmode=require` or SSL certificates."
      ],
      recommendations: [
        {
          problem: "Missing SSL configuration for PostgreSQL connection.",
          relevance: "Server rejects unencrypted connection attempts.",
          commandOrAction: "Append `?sslmode=require` to your PostgreSQL connection string or configure `ssl: true` in your client options.",
          expectedResult: "Connection establishes successfully with SSL encryption enabled.",
          risks: "Client configuration change only.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://www.postgresql.org/docs/current/ssl-tcp.html"]
    };
  }
};

