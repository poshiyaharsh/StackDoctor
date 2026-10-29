import { describe, it, expect } from "vitest";
import { sqliteFileNotFoundRule } from "../src/rules/sqlite-file-not-found.js";
import { sqliteFileCorruptedRule } from "../src/rules/sqlite-file-corrupted.js";
import type { RuleEvaluationContext } from "../src/types.js";

function makeBaseContext(): RuleEvaluationContext {
  return {
    dir: "/test/sqlite-project",
    files: {
      hasPackageJson: true,
      hasNodeModules: true,
      hasLockfile: true,
      hasEnvExample: false,
      hasEnv: false
    },
    technologies: [],
    evidence: []
  };
}

describe("SQLite Diagnostic Rules", () => {
  describe("SQLITE_FILE_NOT_FOUND", () => {
    it("does not trigger when no SQLite databases configured or all exist", () => {
      const ctx = makeBaseContext();
      expect(sqliteFileNotFoundRule.preconditions(ctx)).toBe(false);
      expect(sqliteFileNotFoundRule.evaluate(ctx)).toBeNull();

      ctx.database = {
        sqlite: [
          {
            filePath: "dev.db",
            resolvedPath: "/test/sqlite-project/dev.db",
            source: ".env",
            exists: true,
            dirExists: true,
            isValidSqliteHeader: true
          }
        ]
      };
      expect(sqliteFileNotFoundRule.preconditions(ctx)).toBe(false);
      expect(sqliteFileNotFoundRule.evaluate(ctx)).toBeNull();
    });

    it("triggers when SQLite database file is missing", () => {
      const ctx = makeBaseContext();
      ctx.database = {
        sqlite: [
          {
            filePath: "storage/data.db",
            resolvedPath: "/test/sqlite-project/storage/data.db",
            source: ".env (DATABASE_URL)",
            exists: false,
            dirExists: true,
            errorCategory: "file_not_found",
            error: 'SQLite database file "storage/data.db" does not exist.'
          }
        ]
      };

      expect(sqliteFileNotFoundRule.preconditions(ctx)).toBe(true);
      const finding = sqliteFileNotFoundRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("SQLITE_FILE_NOT_FOUND");
      expect(finding?.title).toContain('SQLite database file "storage/data.db" not found');
      expect(finding?.severity).toBe("high");
    });

    it("triggers when SQLite database parent directory is missing", () => {
      const ctx = makeBaseContext();
      ctx.database = {
        sqlite: [
          {
            filePath: "nonexistent/data.db",
            resolvedPath: "/test/sqlite-project/nonexistent/data.db",
            source: "prisma/schema.prisma",
            exists: false,
            dirExists: false,
            errorCategory: "directory_not_found",
            error: 'Parent directory "nonexistent" for SQLite database does not exist.'
          }
        ]
      };

      expect(sqliteFileNotFoundRule.preconditions(ctx)).toBe(true);
      const finding = sqliteFileNotFoundRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.title).toContain('SQLite parent directory for "nonexistent/data.db" not found');
    });
  });

  describe("SQLITE_FILE_CORRUPTED", () => {
    it("does not trigger when SQLite file has valid header", () => {
      const ctx = makeBaseContext();
      ctx.database = {
        sqlite: [
          {
            filePath: "valid.db",
            resolvedPath: "/test/sqlite-project/valid.db",
            source: ".env",
            exists: true,
            dirExists: true,
            isValidSqliteHeader: true
          }
        ]
      };

      expect(sqliteFileCorruptedRule.preconditions(ctx)).toBe(false);
      expect(sqliteFileCorruptedRule.evaluate(ctx)).toBeNull();
    });

    it("triggers when SQLite file is corrupted or not a valid database", () => {
      const ctx = makeBaseContext();
      ctx.database = {
        sqlite: [
          {
            filePath: "corrupted.sqlite",
            resolvedPath: "/test/sqlite-project/corrupted.sqlite",
            source: ".env (DATABASE_URL)",
            exists: true,
            dirExists: true,
            sizeBytes: 120,
            isValidSqliteHeader: false,
            errorCategory: "corrupted_file",
            error: 'SQLite database file "corrupted.sqlite" has an invalid header.'
          }
        ]
      };

      expect(sqliteFileCorruptedRule.preconditions(ctx)).toBe(true);
      const finding = sqliteFileCorruptedRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("SQLITE_FILE_CORRUPTED");
      expect(finding?.title).toContain('SQLite database file "corrupted.sqlite" is corrupted or invalid');
      expect(finding?.severity).toBe("high");
      expect(finding?.evidence[0].kind).toBe("file_stat");
    });
  });
});

