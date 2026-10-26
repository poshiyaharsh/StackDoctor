import net from "node:net";
import process from "node:process";
import { describe, it, expect } from "vitest";
import {
  checkDnsResolution,
  checkTcpReachability,
  checkAuthenticatedConnection,
  runStagedDatabaseCheck
} from "@stackdoctor/adapters";

describe("Database Diagnostics Adapter (database.ts)", () => {
  it("Stage 1: flags dns_failure on non-existent RFC 2606 .invalid domains", async () => {
    const res = await checkDnsResolution("non-existent-mongo-host.invalid");
    expect(res.success).toBe(false);
    expect(res.errorCategory).toBe("dns_failure");
    expect(res.error).toBeDefined();
  });

  it("Stage 1: passes DNS check for localhost and valid IP addresses", async () => {
    const localhostRes = await checkDnsResolution("localhost");
    expect(localhostRes.success).toBe(true);

    const ipRes = await checkDnsResolution("127.0.0.1");
    expect(ipRes.success).toBe(true);
  });

  it("Stage 2: flags connection_refused when port is not listening", async () => {
    // Acquire a free port and close it
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address() as net.AddressInfo;
    const freePort = address.port;
    await new Promise<void>((resolve) => server.close(() => resolve()));

    const res = await checkTcpReachability("127.0.0.1", freePort, 200);
    expect(res.success).toBe(false);
    expect(res.errorCategory).toBe("connection_refused");
    expect(res.error).toContain("ECONNREFUSED");
  });

  it("Stage 2: flags timeout when endpoint does not respond within timeout window", async () => {
    // Non-routable blackhole IP address from TEST-NET (RFC 5737)
    const blackholeIp = "192.0.2.1";
    const res = await checkTcpReachability(blackholeIp, 27017, 100);
    expect(res.success).toBe(false);
    expect(["timeout", "unreachable_network"]).toContain(res.errorCategory);
  });

  it("Stage 3: skips authentication check when opt-in dbUrlEnvVar is not set", async () => {
    const diag = await runStagedDatabaseCheck({
      host: "localhost",
      port: 27017,
      dbType: "mongodb"
    });

    expect(diag.stages.auth.status).toBe("skipped");
    expect(diag.stages.auth.details).toContain("no --db-url-env opt-in specified");
  });

  it("CRITICAL RULE: Canary secret password NEVER appears in any output, evidence, or error", async () => {
    const canaryPassword = "CANARY_SECRET_PASSWORD_998877";
    const envVarName = "TEST_CANARY_DB_URL";
    process.env[envVarName] = `mongodb://admin:${canaryPassword}@127.0.0.1:27017/testdb`;

    try {
      // Find a free port so stage 2 fails, or run against free port
      const server = net.createServer();
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
      const address = server.address() as net.AddressInfo;
      const freePort = address.port;
      await new Promise<void>((resolve) => server.close(() => resolve()));

      const diag = await runStagedDatabaseCheck({
        host: "127.0.0.1",
        port: freePort,
        dbType: "mongodb",
        dbUrlEnvVar: envVarName
      });

      // Serialize entire diagnostic result to string
      const serialized = JSON.stringify(diag);
      expect(serialized).not.toContain(canaryPassword);

      // Even if stage 3 auth connection check is called directly with invalid credentials
      const authDirect = await checkAuthenticatedConnection(
        "mongodb",
        `mongodb://admin:${canaryPassword}@127.0.0.1:${freePort}/testdb`,
        300
      );
      const authSerialized = JSON.stringify(authDirect);
      expect(authSerialized).not.toContain(canaryPassword);
    } finally {
      delete process.env[envVarName];
    }
  });

  it("stops at first failing stage (DNS failure skips TCP and Auth)", async () => {
    const diag = await runStagedDatabaseCheck({
      host: "unresolvable-db.invalid",
      port: 3306,
      dbType: "mysql"
    });

    expect(diag.stages.dns.status).toBe("failed");
    expect(diag.stages.dns.errorCategory).toBe("dns_failure");
    expect(diag.stages.tcp.status).toBe("skipped");
    expect(diag.stages.auth.status).toBe("skipped");
    expect(diag.finalCategory).toBe("dns_failure");
  });
});
