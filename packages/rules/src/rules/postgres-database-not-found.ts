import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const postgresDatabaseNotFoundRule: Rule = {
  id: "POSTGRES_DATABASE_NOT_FOUND",
  title: "PostgreSQL database does not exist",
  category: "database",
  description: "Connected to PostgreSQL and authenticated successfully, but the specified database was not found (error code 3D000: invalid_catalog_name).",
  technologies: ["PostgreSQL"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["command_output"],
  recommendedChecks: [
    "Verify the database name in your connection URL or environment variables",
    "Check available databases on the PostgreSQL server using `\\l` or `SELECT datname FROM pg_database;`",
    "Ensure database migration or provisioning scripts have been executed"
  ],
  remediation: [
    {
      problem: "Target PostgreSQL database does not exist on the server.",
      relevance: "Application cannot connect or execute schema migrations without the target database.",
      commandOrAction: "Create the missing database using `createdb <database_name>` or `CREATE DATABASE <database_name>;`.",
      expectedResult: "Target database is created and ready for connection.",
      risks: "Database creation does not affect existing databases.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that PostgreSQL target database exists and accepts connections.",
  docs: ["https://www.postgresql.org/docs/current/manage-ag-createdb.html"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.diagnostics &&
      ctx.database.diagnostics.some(
        (d) => d.dbType === "postgresql" && d.finalCategory === "database_not_found"
      )
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const diag = ctx.database?.diagnostics?.find(
      (d) => d.dbType === "postgresql" && d.finalCategory === "database_not_found"
    );
    if (!diag) {
      return null;
    }

    const { host, port, databaseName } = diag;
    const dbDisplay = databaseName ? `"${databaseName}" ` : "";

    return {
      ruleId: "POSTGRES_DATABASE_NOT_FOUND",
      title: `PostgreSQL database ${dbDisplay}does not exist on ${host}:${port}`,
      category: "database",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-postgres-db-not-found-${host}-${port}`,
          kind: "command_output",
          description: "PostgreSQL database existence check",
          observed: `PostgreSQL server at ${host}:${port} responded with error code 3D000: database does not exist.`,
          source: `${host}:${port}`,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "The database specified in the connection string has not been created yet.",
        "There is a typo in the database name within configuration or environment variables.",
        "Docker container was initialized without `POSTGRES_DB` parameter."
      ],
      recommendations: [
        {
          problem: "Missing target PostgreSQL database.",
          relevance: "Applications fail to start when target catalog does not exist.",
          commandOrAction: databaseName
            ? `Run \`createdb ${databaseName}\` or execute \`CREATE DATABASE "${databaseName}";\` on the PostgreSQL server.`
            : "Create the target database or verify the database name in your connection configuration.",
          expectedResult: "PostgreSQL accepts connections to the target database.",
          risks: "Creates a new empty database.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://www.postgresql.org/docs/current/manage-ag-createdb.html"]
    };
  }
};

