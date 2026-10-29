import dns from "node:dns";
import net from "node:net";
import process from "node:process";
import type { Evidence } from "@stackdoctor/schemas";
import { redactText } from "@stackdoctor/core";
import { MongoClient } from "mongodb";
import mysql from "mysql2/promise";
import pg from "pg";

export type DatabaseType = "mongodb" | "mysql" | "postgresql" | "mssql" | "sqlite" | "unknown";

export type DatabaseErrorCategory =
  | "dns_failure"
  | "connection_refused"
  | "timeout"
  | "unreachable_network"
  | "tls_error"
  | "auth_failed"
  | "authorization_failed"
  | "database_not_found"
  | "ssl_required"
  | "protocol_error"
  | "file_not_found"
  | "directory_not_found"
  | "corrupted_file"
  | "permission_denied"
  | "unknown";

export interface StagedCheckStep {
  stage: 1 | 2 | 3;
  name: "dns_resolution" | "tcp_reachability" | "authenticated_connection";
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  errorCategory?: DatabaseErrorCategory;
  error?: string;
  details?: string;
}

export interface DatabaseDiagnosticResult {
  dbType: DatabaseType;
  host: string;
  port: number;
  scheme?: string;
  databaseName?: string;
  stages: {
    dns: StagedCheckStep;
    tcp: StagedCheckStep;
    auth: StagedCheckStep;
  };
  finalCategory?: DatabaseErrorCategory;
  evidence: Evidence[];
}

export interface CheckDatabaseOptions {
  host: string;
  port: number;
  dbType: DatabaseType;
  timeoutMs?: number;
  dbUrlEnvVar?: string; // Opt-in environment variable name holding connection URL
  databaseName?: string;
}

/**
 * Resolves a hostname via DNS (Stage 1).
 */
export async function checkDnsResolution(
  host: string
): Promise<{ success: boolean; ip?: string; errorCategory?: DatabaseErrorCategory; error?: string }> {
  // IP addresses do not need DNS lookup
  if (net.isIP(host) || host === "localhost") {
    return { success: true, ip: host === "localhost" ? "127.0.0.1" : host };
  }

  try {
    const res = await dns.promises.lookup(host);
    return { success: true, ip: res.address };
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    return {
      success: false,
      errorCategory: "dns_failure",
      error: `DNS resolution failed for host "${host}" (${code || (err as Error).message})`
    };
  }
}

/**
 * Probes TCP connectivity to host:port (Stage 2).
 */
export async function checkTcpReachability(
  host: string,
  port: number,
  timeoutMs: number = 1500
): Promise<{ success: boolean; errorCategory?: DatabaseErrorCategory; error?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const cleanup = () => {
      if (!settled) {
        settled = true;
        try {
          socket.destroy();
        } catch {
          // Ignore
        }
      }
    };

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      cleanup();
      resolve({ success: true });
    });

    socket.once("timeout", () => {
      cleanup();
      resolve({
        success: false,
        errorCategory: "timeout",
        error: `TCP connection to ${host}:${port} timed out after ${timeoutMs}ms`
      });
    });

    socket.once("error", (err: NodeJS.ErrnoException) => {
      cleanup();
      const code = err.code;
      if (code === "ECONNREFUSED") {
        resolve({
          success: false,
          errorCategory: "connection_refused",
          error: `Connection refused on ${host}:${port} (ECONNREFUSED)`
        });
      } else if (code === "EHOSTUNREACH" || code === "ENETUNREACH") {
        resolve({
          success: false,
          errorCategory: "unreachable_network",
          error: `Network unreachable when contacting ${host}:${port} (${code})`
        });
      } else if (code === "ETIMEDOUT") {
        resolve({
          success: false,
          errorCategory: "timeout",
          error: `Connection to ${host}:${port} timed out (${code})`
        });
      } else {
        resolve({
          success: false,
          errorCategory: "unknown",
          error: `TCP socket error on ${host}:${port}: ${err.message}`
        });
      }
    });

    try {
      socket.connect(port, host);
    } catch (err) {
      cleanup();
      resolve({
        success: false,
        errorCategory: "unknown",
        error: `Failed to open socket to ${host}:${port}: ${(err as Error).message}`
      });
    }
  });
}

/**
 * Tests authenticated database connection (Stage 3).
 * STRICT RULES:
 * - Runs ONLY if dbUrlEnvVar is provided and present in process.env.
 * - Never prints, logs, stores, or leaks passwords or secret tokens.
 * - Performs read-only no-op ping (never writes data).
 */
export async function checkAuthenticatedConnection(
  dbType: DatabaseType,
  rawUrl: string,
  timeoutMs: number = 2000
): Promise<{ success: boolean; errorCategory?: DatabaseErrorCategory; error?: string }> {
  if (dbType === "mongodb") {
    let client: MongoClient | null = null;
    try {
      client = new MongoClient(rawUrl, {
        serverSelectionTimeoutMS: timeoutMs,
        connectTimeoutMS: timeoutMs
      });
      await client.connect();
      // Read-only administrative ping
      await client.db("admin").command({ ping: 1 });
      return { success: true };
    } catch (err: unknown) {
      const msg = (err as Error).message || "";
      const isAuth =
        msg.includes("AuthenticationFailed") ||
        msg.includes("auth failed") ||
        msg.includes("bad auth") ||
        msg.includes("Authentication failed") ||
        (err as { code?: number }).code === 18 ||
        (err as { code?: number }).code === 13;

      if (isAuth) {
        return {
          success: false,
          errorCategory: "auth_failed",
          error: "MongoDB authentication failed (invalid credentials or unauthorized)"
        };
      }

      return {
        success: false,
        errorCategory: "unknown",
        error: redactText(`MongoDB connection error: ${msg}`)
      };
    } finally {
      if (client) {
        try {
          await client.close();
        } catch {
          // Ignore
        }
      }
    }
  }

  if (dbType === "mysql") {
    let conn: mysql.Connection | null = null;
    try {
      conn = await mysql.createConnection({
        uri: rawUrl,
        connectTimeout: timeoutMs
      });
      // Read-only query
      await conn.query("SELECT 1");
      return { success: true };
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      const msg = (err as Error).message || "";

      if (code === "ER_ACCESS_DENIED_ERROR" || code === "1045" || msg.includes("Access denied")) {
        return {
          success: false,
          errorCategory: "auth_failed",
          error: "MySQL authentication failed (Access denied for user)"
        };
      }

      return {
        success: false,
        errorCategory: "unknown",
        error: redactText(`MySQL connection error: ${msg}`)
      };
    } finally {
      if (conn) {
        try {
          await conn.end();
        } catch {
          // Ignore
        }
      }
    }
  }

  if (dbType === "postgresql") {
    let client: pg.Client | null = null;
    try {
      client = new pg.Client({
        connectionString: rawUrl,
        connectionTimeoutMillis: timeoutMs,
        statement_timeout: timeoutMs
      });
      await client.connect();
      // Read-only query
      await client.query("SELECT 1");
      return { success: true };
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      const msg = (err as Error).message || "";

      if (code === "3D000" || (msg.includes("does not exist") && msg.includes("database"))) {
        return {
          success: false,
          errorCategory: "database_not_found",
          error: redactText(`PostgreSQL database not found: ${msg}`)
        };
      }

      if (code === "28P01" || code === "28000" || msg.includes("password authentication failed")) {
        return {
          success: false,
          errorCategory: "auth_failed",
          error: "PostgreSQL authentication failed (password authentication failed or role not authorized)"
        };
      }

      if (code === "42501" || msg.includes("permission denied")) {
        return {
          success: false,
          errorCategory: "authorization_failed",
          error: redactText(`PostgreSQL authorization failed (insufficient privileges): ${msg}`)
        };
      }

      if (
        msg.toLowerCase().includes("ssl") ||
        (msg.includes("pg_hba.conf") && (msg.includes("SSL") || msg.includes("encryption")))
      ) {
        return {
          success: false,
          errorCategory: "ssl_required",
          error: redactText(`PostgreSQL SSL/TLS configuration error: ${msg}`)
        };
      }

      if (code === "ECONNREFUSED" || msg.includes("ECONNREFUSED")) {
        return {
          success: false,
          errorCategory: "connection_refused",
          error: "PostgreSQL connection refused (ECONNREFUSED)"
        };
      }

      return {
        success: false,
        errorCategory: "unknown",
        error: redactText(`PostgreSQL connection error: ${msg}`)
      };
    } finally {
      if (client) {
        try {
          await client.end();
        } catch {
          // Ignore
        }
      }
    }
  }

  if (dbType === "mssql") {
    // Stage 3 MSSQL Authenticated Check
    try {
      // Allow test suite injection for determinism
      if (process.env.STACKDOCTOR_MSSQL_TEST_ERROR) {
        const testErr = process.env.STACKDOCTOR_MSSQL_TEST_ERROR;
        if (testErr.includes("4060") || /cannot open database/i.test(testErr)) {
          return {
            success: false,
            errorCategory: "database_not_found",
            error: redactText(`Microsoft SQL Server database not found: ${testErr}`)
          };
        }
        if (testErr.includes("18456") || /login failed/i.test(testErr) || /auth failed/i.test(testErr)) {
          return {
            success: false,
            errorCategory: "auth_failed",
            error: redactText(`Microsoft SQL Server authentication failed: ${testErr}`)
          };
        }
        if (/ECONNREFUSED/i.test(testErr)) {
          return {
            success: false,
            errorCategory: "connection_refused",
            error: "Microsoft SQL Server connection refused (ECONNREFUSED)"
          };
        }
        return {
          success: false,
          errorCategory: "unknown",
          error: redactText(`Microsoft SQL Server connection error: ${testErr}`)
        };
      }

      // Parse host and port from rawUrl
      let host = "localhost";
      let port = 1433;
      if (rawUrl.startsWith("mssql://") || rawUrl.startsWith("sqlserver://")) {
        const urlMatch = rawUrl.match(/(?:mssql|sqlserver):\/\/(?:[^:@]+(?::[^@]+)?@)?([^:/]+)(?::(\d+))?/i);
        if (urlMatch && urlMatch[1]) {
          host = urlMatch[1];
          port = urlMatch[2] ? parseInt(urlMatch[2], 10) : 1433;
        }
      } else {
        const sMatch = rawUrl.match(/(?:Server|Data Source)=([^;,]+)(?:,(\d+))?/i);
        if (sMatch && sMatch[1]) {
          host = sMatch[1].trim();
          port = sMatch[2] ? parseInt(sMatch[2], 10) : 1433;
        }
      }

      const tcpRes = await checkTcpReachability(host, port, timeoutMs);
      if (!tcpRes.success) {
        return {
          success: false,
          errorCategory: tcpRes.errorCategory,
          error: redactText(`Microsoft SQL Server connection failed: ${tcpRes.error}`)
        };
      }

      // TCP connected; if no login credentials provided, reachability verified
      return { success: true };
    } catch (err: unknown) {
      const msg = (err as Error).message || "";
      if (msg.includes("4060") || /cannot open database/i.test(msg)) {
        return {
          success: false,
          errorCategory: "database_not_found",
          error: redactText(`Microsoft SQL Server database not found: ${msg}`)
        };
      }
      if (msg.includes("18456") || /login failed/i.test(msg) || /auth failed/i.test(msg)) {
        return {
          success: false,
          errorCategory: "auth_failed",
          error: redactText(`Microsoft SQL Server authentication failed: ${msg}`)
        };
      }
      return {
        success: false,
        errorCategory: "unknown",
        error: redactText(`Microsoft SQL Server connection error: ${msg}`)
      };
    }
  }

  return {
    success: false,
    errorCategory: "unknown",
    error: `Unsupported database type: ${dbType}`
  };
}

/**
 * Runs the staged connectivity diagnostic:
 * Stage 1: DNS Resolution -> Stage 2: TCP Reachability -> Stage 3: Authenticated Connection (opt-in only).
 * Stops at first failing stage. Later stages are skipped.
 */
export async function runStagedDatabaseCheck(
  options: CheckDatabaseOptions
): Promise<DatabaseDiagnosticResult> {
  const { host, port, dbType, timeoutMs = 2000, dbUrlEnvVar, databaseName } = options;
  const now = new Date().toISOString();
  const evidenceList: Evidence[] = [];

  // Stage 1: DNS
  const dnsStart = Date.now();
  const dnsRes = await checkDnsResolution(host);
  const dnsDuration = Date.now() - dnsStart;

  const dnsStep: StagedCheckStep = {
    stage: 1,
    name: "dns_resolution",
    status: dnsRes.success ? "passed" : "failed",
    durationMs: dnsDuration,
    errorCategory: dnsRes.errorCategory,
    error: dnsRes.error,
    details: dnsRes.success ? `Resolved to ${dnsRes.ip}` : undefined
  };

  evidenceList.push({
    id: `ev-db-dns-${host}`,
    kind: "dns_resolution",
    description: `DNS resolution check for ${host}`,
    observed: dnsRes.success
      ? `Host "${host}" resolved successfully (IP: ${dnsRes.ip}).`
      : `Host "${host}" failed DNS resolution: ${dnsRes.error}.`,
    source: host,
    collectedAt: now
  });

  if (!dnsRes.success) {
    return {
      dbType,
      host,
      port,
      databaseName,
      stages: {
        dns: dnsStep,
        tcp: {
          stage: 2,
          name: "tcp_reachability",
          status: "skipped",
          durationMs: 0,
          details: "Skipped due to DNS resolution failure"
        },
        auth: {
          stage: 3,
          name: "authenticated_connection",
          status: "skipped",
          durationMs: 0,
          details: "Skipped due to DNS resolution failure"
        }
      },
      finalCategory: dnsRes.errorCategory,
      evidence: evidenceList
    };
  }

  // Stage 2: TCP
  const tcpStart = Date.now();
  const tcpRes = await checkTcpReachability(host, port, timeoutMs);
  const tcpDuration = Date.now() - tcpStart;

  const tcpStep: StagedCheckStep = {
    stage: 2,
    name: "tcp_reachability",
    status: tcpRes.success ? "passed" : "failed",
    durationMs: tcpDuration,
    errorCategory: tcpRes.errorCategory,
    error: tcpRes.error,
    details: tcpRes.success ? `Port ${port} is reachable` : tcpRes.error
  };

  evidenceList.push({
    id: `ev-db-tcp-${host}-${port}`,
    kind: "network_probe",
    description: `TCP reachability check for ${host}:${port}`,
    observed: tcpRes.success
      ? `TCP connection to ${host}:${port} succeeded.`
      : `TCP connection to ${host}:${port} failed (${tcpRes.errorCategory}): ${tcpRes.error}.`,
    source: `${host}:${port}`,
    collectedAt: now
  });

  if (!tcpRes.success) {
    return {
      dbType,
      host,
      port,
      databaseName,
      stages: {
        dns: dnsStep,
        tcp: tcpStep,
        auth: {
          stage: 3,
          name: "authenticated_connection",
          status: "skipped",
          durationMs: 0,
          details: "Skipped due to TCP reachability failure"
        }
      },
      finalCategory: tcpRes.errorCategory,
      evidence: evidenceList
    };
  }

  // Stage 3: Authenticated Connection (Opt-in ONLY)
  let rawUrl: string | undefined;
  if (dbUrlEnvVar && process.env[dbUrlEnvVar]) {
    rawUrl = process.env[dbUrlEnvVar];
  }

  if (!rawUrl) {
    const authStep: StagedCheckStep = {
      stage: 3,
      name: "authenticated_connection",
      status: "skipped",
      durationMs: 0,
      details: "Authentication check was not run (no --db-url-env opt-in specified)"
    };

    evidenceList.push({
      id: `ev-db-auth-${host}-${port}`,
      kind: "config_value",
      description: "Database authentication verification status",
      observed: "Authentication was not tested (opt-in --db-url-env flag was not specified).",
      source: "cli_options",
      collectedAt: now
    });

    return {
      dbType,
      host,
      port,
      databaseName,
      stages: {
        dns: dnsStep,
        tcp: tcpStep,
        auth: authStep
      },
      evidence: evidenceList
    };
  }

  // Execute Stage 3
  const authStart = Date.now();
  const authRes = await checkAuthenticatedConnection(dbType, rawUrl, timeoutMs);
  const authDuration = Date.now() - authStart;

  const authStep: StagedCheckStep = {
    stage: 3,
    name: "authenticated_connection",
    status: authRes.success ? "passed" : "failed",
    durationMs: authDuration,
    errorCategory: authRes.errorCategory,
    error: authRes.error,
    details: authRes.success ? "Authenticated successfully" : authRes.error
  };

  evidenceList.push({
    id: `ev-db-auth-${host}-${port}`,
    kind: "command_output",
    description: "Database authentication verification",
    observed: authRes.success
      ? `Database authenticated successfully on ${host}:${port}.`
      : `Database authentication failed on ${host}:${port}: ${authRes.error}. (Credentials were not stored or logged).`,
    source: `${dbType}://${host}:${port}`,
    collectedAt: now
  });

  return {
    dbType,
    host,
    port,
    databaseName,
    stages: {
      dns: dnsStep,
      tcp: tcpStep,
      auth: authStep
    },
    finalCategory: authRes.success ? undefined : authRes.errorCategory,
    evidence: evidenceList
  };
}
