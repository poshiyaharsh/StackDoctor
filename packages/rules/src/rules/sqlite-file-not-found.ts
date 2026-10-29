import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const sqliteFileNotFoundRule: Rule = {
  id: "SQLITE_FILE_NOT_FOUND",
  title: "SQLite database file or target directory not found",
  category: "database",
  description: "The configured SQLite database file path or its parent directory does not exist on disk.",
  technologies: ["SQLite"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_stat"],
  recommendedChecks: [
    "Verify the SQLite database path in your environment file or database configuration",
    "Ensure the parent directory exists before starting the application",
    "Run database migrations or seed scripts to initialize the SQLite database file"
  ],
  remediation: [
    {
      problem: "The configured SQLite database file or parent directory is missing.",
      relevance: "Applications attempting to connect to a SQLite database in a non-existent directory fail with SQLITE_CANTOPEN.",
      commandOrAction: "Create the target directory or run migrations (`npx prisma db push` or `python manage.py migrate`).",
      expectedResult: "Target directory exists and SQLite database file is created.",
      risks: "Creating directories does not alter existing data.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that the SQLite database file or its parent directory exists on disk.",
  docs: ["https://sqlite.org/quickstart.html"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.sqlite &&
      ctx.database.sqlite.some(
        (s) => s.errorCategory === "file_not_found" || s.errorCategory === "directory_not_found"
      )
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const broken = ctx.database?.sqlite?.find(
      (s) => s.errorCategory === "file_not_found" || s.errorCategory === "directory_not_found"
    );
    if (!broken) {
      return null;
    }

    const isDir = broken.errorCategory === "directory_not_found";

    return {
      ruleId: "SQLITE_FILE_NOT_FOUND",
      title: isDir
        ? `SQLite parent directory for "${broken.filePath}" not found`
        : `SQLite database file "${broken.filePath}" not found`,
      category: "database",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-sqlite-missing-${broken.filePath.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
          kind: "file_stat",
          description: `SQLite file inspection for ${broken.filePath}`,
          observed: broken.error || `SQLite database target is missing at ${broken.filePath}`,
          source: broken.source,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        isDir
          ? `Parent directory for "${broken.filePath}" does not exist on disk.`
          : `SQLite database file "${broken.filePath}" has not been created or migrated.`,
        "Database path in environment variable or ORM configuration has a typo.",
        "Migrations or seed commands have not been executed yet."
      ],
      recommendations: [
        {
          problem: isDir
            ? `Parent directory for "${broken.filePath}" is missing.`
            : `SQLite database file "${broken.filePath}" is missing.`,
          relevance: "Application crashes on startup with SQLITE_CANTOPEN when the database target cannot be opened.",
          commandOrAction: isDir
            ? "Create the parent directory before starting the application."
            : "Run framework migrations or initialize the SQLite database file.",
          expectedResult: `SQLite database file at "${broken.filePath}" exists and can be opened.`,
          risks: "Creating directories or running migrations initializes the database; harmless to code.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://sqlite.org/quickstart.html"]
    };
  }
};
