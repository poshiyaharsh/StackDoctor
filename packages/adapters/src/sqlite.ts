import fs from "node:fs";
import path from "node:path";
import type { DatabaseErrorCategory } from "./database.js";

export const SQLITE_MAGIC_HEADER = "SQLite format 3\0";

export interface SqliteInspectionResult {
  filePath: string;
  resolvedPath: string;
  source: string;
  exists: boolean;
  dirExists: boolean;
  sizeBytes?: number;
  isValidSqliteHeader?: boolean;
  isReadable?: boolean;
  isWritable?: boolean;
  error?: string;
  errorCategory?: DatabaseErrorCategory;
}

/**
 * Extracts and normalizes the target file path from a SQLite URI or file path string.
 */
export function parseSqlitePath(rawPath: string, projectDir: string): { relativePath: string; absolutePath: string } {
  let clean = rawPath.trim();

  // Strip query parameters e.g. ?connection_limit=1
  const qIdx = clean.indexOf("?");
  if (qIdx !== -1) {
    clean = clean.substring(0, qIdx);
  }

  // Strip surrounding quotes
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1);
  }

  // Strip sqlite:/// or sqlite:// or sqlite:
  if (clean.startsWith("sqlite://")) {
    clean = clean.substring(clean.startsWith("sqlite:///") ? 9 : 8);
  } else if (clean.startsWith("sqlite:")) {
    clean = clean.substring(7);
  } else if (clean.startsWith("file://")) {
    clean = clean.substring(clean.startsWith("file:///") ? 7 : 6);
  } else if (clean.startsWith("file:")) {
    clean = clean.substring(5);
  }

  const absPath = path.isAbsolute(clean) ? clean : path.resolve(projectDir, clean);
  const relPath = path.relative(projectDir, absPath).replace(/\\/g, "/");

  return {
    relativePath: relPath,
    absolutePath: absPath
  };
}

/**
 * Statically inspects a SQLite database file path, verifying directory existence,
 * file presence, valid SQLite 3 header magic bytes, and permissions.
 */
export function inspectSqliteDatabase(
  rawPath: string,
  projectDir: string,
  source: string
): SqliteInspectionResult {
  const { relativePath, absolutePath } = parseSqlitePath(rawPath, projectDir);
  const dirPath = path.dirname(absolutePath);
  const dirExists = fs.existsSync(dirPath);

  if (!dirExists) {
    return {
      filePath: relativePath,
      resolvedPath: absolutePath,
      source,
      exists: false,
      dirExists: false,
      errorCategory: "directory_not_found",
      error: `Parent directory "${path.relative(projectDir, dirPath).replace(/\\/g, "/")}" for SQLite database does not exist.`
    };
  }

  const fileExists = fs.existsSync(absolutePath);
  if (!fileExists) {
    return {
      filePath: relativePath,
      resolvedPath: absolutePath,
      source,
      exists: false,
      dirExists: true,
      errorCategory: "file_not_found",
      error: `SQLite database file "${relativePath}" does not exist.`
    };
  }

  try {
    const stats = fs.statSync(absolutePath);
    const sizeBytes = stats.size;

    // Check read/write accessibility
    let isReadable = true;
    let isWritable = true;
    try {
      fs.accessSync(absolutePath, fs.constants.R_OK);
    } catch {
      isReadable = false;
    }
    try {
      fs.accessSync(absolutePath, fs.constants.W_OK);
    } catch {
      isWritable = false;
    }

    if (!isReadable || !isWritable) {
      return {
        filePath: relativePath,
        resolvedPath: absolutePath,
        source,
        exists: true,
        dirExists: true,
        sizeBytes,
        isReadable,
        isWritable,
        errorCategory: "permission_denied",
        error: `Insufficient permissions to read/write SQLite database file "${relativePath}".`
      };
    }

    // A 0-byte file is created initially by some drivers/touch, valid until first write
    if (sizeBytes === 0) {
      return {
        filePath: relativePath,
        resolvedPath: absolutePath,
        source,
        exists: true,
        dirExists: true,
        sizeBytes: 0,
        isValidSqliteHeader: true,
        isReadable: true,
        isWritable: true
      };
    }

    // Inspect header magic string (first 16 bytes: "SQLite format 3\0")
    const fd = fs.openSync(absolutePath, "r");
    const headerBuf = Buffer.alloc(16);
    fs.readSync(fd, headerBuf, 0, 16, 0);
    fs.closeSync(fd);

    const headerStr = headerBuf.toString("utf8");
    const isValidSqliteHeader = headerStr === SQLITE_MAGIC_HEADER;

    if (!isValidSqliteHeader) {
      return {
        filePath: relativePath,
        resolvedPath: absolutePath,
        source,
        exists: true,
        dirExists: true,
        sizeBytes,
        isValidSqliteHeader: false,
        isReadable: true,
        isWritable: true,
        errorCategory: "corrupted_file",
        error: `SQLite database file "${relativePath}" has an invalid header (expected "${SQLITE_MAGIC_HEADER}").`
      };
    }

    return {
      filePath: relativePath,
      resolvedPath: absolutePath,
      source,
      exists: true,
      dirExists: true,
      sizeBytes,
      isValidSqliteHeader: true,
      isReadable: true,
      isWritable: true
    };
  } catch (err: unknown) {
    return {
      filePath: relativePath,
      resolvedPath: absolutePath,
      source,
      exists: true,
      dirExists: true,
      errorCategory: "unknown",
      error: `Failed to inspect SQLite database file "${relativePath}": ${(err as Error).message}`
    };
  }
}

/**
 * Scans project environment and configuration files to locate configured SQLite databases.
 */
export function findSqliteConfigurations(projectDir: string): SqliteInspectionResult[] {
  const results: SqliteInspectionResult[] = [];
  const checkedPaths = new Set<string>();

  // 1. Prisma schema
  const prismaPath = path.join(projectDir, "prisma", "schema.prisma");
  if (fs.existsSync(prismaPath)) {
    try {
      const prismaContent = fs.readFileSync(prismaPath, "utf-8");
      if (/provider\s*=\s*["']sqlite["']/i.test(prismaContent)) {
        const urlMatch = prismaContent.match(/url\s*=\s*["']([^"']+)["']/i);
        if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith("env(")) {
          const inspected = inspectSqliteDatabase(urlMatch[1], projectDir, "prisma/schema.prisma");
          checkedPaths.add(inspected.resolvedPath);
          results.push(inspected);
        }
      }
    } catch {
      // Ignore
    }
  }

  // 2. Env files (.env, .env.example, .env.local)
  const envFiles = [".env", ".env.example", ".env.local"];
  for (const envName of envFiles) {
    const envFile = path.join(projectDir, envName);
    if (!fs.existsSync(envFile)) continue;
    try {
      const content = fs.readFileSync(envFile, "utf-8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [k, ...vParts] = trimmed.split("=");
        const key = k.trim();
        const val = vParts.join("=").trim().replace(/^["']|["']$/g, "");

        if (
          key === "SQLITE_DB_PATH" ||
          key === "SQLITE_DATABASE" ||
          (key === "DB_DATABASE" && /sqlite/i.test(content)) ||
          ((key === "DATABASE_URL" || key === "DB_URL") && (/sqlite/i.test(val) || val.endsWith(".db") || val.endsWith(".sqlite") || val.endsWith(".sqlite3")))
        ) {
          const inspected = inspectSqliteDatabase(val, projectDir, `${envName} (${key})`);
          if (!checkedPaths.has(inspected.resolvedPath)) {
            checkedPaths.add(inspected.resolvedPath);
            results.push(inspected);
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return results;
}
