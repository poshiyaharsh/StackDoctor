import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const sqliteFileCorruptedRule: Rule = {
  id: "SQLITE_FILE_CORRUPTED",
  title: "SQLite database file is corrupted or not a valid database",
  category: "database",
  description: "The SQLite database file exists with non-zero size, but does not start with the standard SQLite 3 header magic string ('SQLite format 3\\0').",
  technologies: ["SQLite"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_stat"],
  recommendedChecks: [
    "Inspect the database file with `file <path>` or a text viewer to check for HTML errors or JSON payloads",
    "Check whether git conflict markers or download failure pages were written to the database path",
    "Restore the database from a valid backup or recreate it with your migration tool"
  ],
  remediation: [
    {
      problem: "The file at the SQLite path contains invalid data or corrupt headers instead of SQLite 3 database format.",
      relevance: "Application crashes immediately with `SQLITE_NOTADB: file is not a database` or equivalent driver exception.",
      commandOrAction: "Move the corrupted file aside and recreate the database with migration commands.",
      expectedResult: "A clean SQLite database with valid headers is generated.",
      risks: "Back up the corrupted file before deletion or overwrite to prevent data loss.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that the SQLite database file contains the standard 'SQLite format 3' header.",
  docs: ["https://sqlite.org/fileformat.html"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.sqlite &&
      ctx.database.sqlite.some((s) => s.errorCategory === "corrupted_file")
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const corrupted = ctx.database?.sqlite?.find((s) => s.errorCategory === "corrupted_file");
    if (!corrupted) {
      return null;
    }

    return {
      ruleId: "SQLITE_FILE_CORRUPTED",
      title: `SQLite database file "${corrupted.filePath}" is corrupted or invalid`,
      category: "database",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-sqlite-corrupt-${corrupted.filePath.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
          kind: "file_stat",
          description: `SQLite header verification for ${corrupted.filePath}`,
          observed: corrupted.error || `File exists (${corrupted.sizeBytes} bytes) but lacks valid SQLite 3 header magic bytes.`,
          source: corrupted.source,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        `The file at "${corrupted.filePath}" is not an authentic SQLite database.`,
        "An HTML error page or JSON payload was written to the database path during a failed download or build script.",
        "Git merge conflict markers or textual edits damaged the binary file header."
      ],
      recommendations: [
        {
          problem: `The SQLite database file "${corrupted.filePath}" has an invalid header.`,
          relevance: "Application crashes with `SQLITE_NOTADB: file is not a database` on connection initialization.",
          commandOrAction: "Backup the damaged file and recreate the database with migration commands.",
          expectedResult: `A valid SQLite 3 database file is created at "${corrupted.filePath}".`,
          risks: "Back up the corrupted file before removing to preserve any salvageable data.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://sqlite.org/fileformat.html"]
    };
  }
};
