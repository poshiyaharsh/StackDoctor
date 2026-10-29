import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseSqlitePath,
  inspectSqliteDatabase,
  findSqliteConfigurations,
  SQLITE_MAGIC_HEADER
} from "../src/sqlite.js";

describe("SQLite Adapter Unit Tests", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-sqlite-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses different SQLite URL formats", () => {
    expect(parseSqlitePath("file:./dev.db", tmpDir).relativePath).toBe("dev.db");
    expect(parseSqlitePath("file:./prisma/dev.db?connection_limit=1", tmpDir).relativePath).toBe("prisma/dev.db");
    expect(parseSqlitePath("sqlite:./data.sqlite3", tmpDir).relativePath).toBe("data.sqlite3");
    expect(parseSqlitePath("sqlite:///absolute/path/db.sqlite", tmpDir).relativePath).toBeDefined();
  });

  it("detects when parent directory does not exist (directory_not_found)", () => {
    const res = inspectSqliteDatabase("missing-dir/app.db", tmpDir, "test");
    expect(res.exists).toBe(false);
    expect(res.dirExists).toBe(false);
    expect(res.errorCategory).toBe("directory_not_found");
    expect(res.error).toContain("Parent directory");
  });

  it("detects when database file does not exist (file_not_found)", () => {
    const res = inspectSqliteDatabase("app.db", tmpDir, "test");
    expect(res.exists).toBe(false);
    expect(res.dirExists).toBe(true);
    expect(res.errorCategory).toBe("file_not_found");
    expect(res.error).toContain("does not exist");
  });

  it("detects corrupted header when file has invalid content", () => {
    const dbPath = path.join(tmpDir, "corrupted.db");
    fs.writeFileSync(dbPath, "<html><body>502 Bad Gateway</body></html>");

    const res = inspectSqliteDatabase("corrupted.db", tmpDir, "test");
    expect(res.exists).toBe(true);
    expect(res.dirExists).toBe(true);
    expect(res.isValidSqliteHeader).toBe(false);
    expect(res.errorCategory).toBe("corrupted_file");
  });

  it("validates a healthy SQLite database file with magic header", () => {
    const dbPath = path.join(tmpDir, "healthy.db");
    const buf = Buffer.alloc(100);
    buf.write(SQLITE_MAGIC_HEADER, 0, 16, "utf8");
    fs.writeFileSync(dbPath, buf);

    const res = inspectSqliteDatabase("healthy.db", tmpDir, "test");
    expect(res.exists).toBe(true);
    expect(res.dirExists).toBe(true);
    expect(res.isValidSqliteHeader).toBe(true);
    expect(res.errorCategory).toBeUndefined();
  });

  it("finds SQLite database configurations in prisma schema and .env", () => {
    fs.writeFileSync(path.join(tmpDir, ".env"), 'DATABASE_URL="file:./storage/dev.db"\n');
    const storageDir = path.join(tmpDir, "storage");
    fs.mkdirSync(storageDir);
    const dbPath = path.join(storageDir, "dev.db");
    const buf = Buffer.alloc(32);
    buf.write(SQLITE_MAGIC_HEADER, 0, 16, "utf8");
    fs.writeFileSync(dbPath, buf);

    const configs = findSqliteConfigurations(tmpDir);
    expect(configs.length).toBe(1);
    expect(configs[0].filePath).toBe("storage/dev.db");
    expect(configs[0].isValidSqliteHeader).toBe(true);
  });
});
