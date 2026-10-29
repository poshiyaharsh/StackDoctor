import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkAuthenticatedConnection } from "../src/database.js";

describe("Microsoft SQL Server (MSSQL) Adapter Unit Tests", () => {
  const originalEnv = process.env.STACKDOCTOR_MSSQL_TEST_ERROR;

  beforeEach(() => {
    delete process.env.STACKDOCTOR_MSSQL_TEST_ERROR;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.STACKDOCTOR_MSSQL_TEST_ERROR = originalEnv;
    } else {
      delete process.env.STACKDOCTOR_MSSQL_TEST_ERROR;
    }
  });

  it("categorizes error 18456 / Login failed as auth_failed", async () => {
    process.env.STACKDOCTOR_MSSQL_TEST_ERROR = "Login failed for user 'sa'. Reason: Password did not match that for the login provided. (Error 18456)";

    const res = await checkAuthenticatedConnection(
      "mssql",
      "Server=localhost,1433;Database=TestDb;User Id=sa;Password=secret;",
      500
    );

    expect(res.success).toBe(false);
    expect(res.errorCategory).toBe("auth_failed");
    expect(res.error).toContain("Microsoft SQL Server authentication failed");
  });

  it("categorizes error 4060 as database_not_found", async () => {
    process.env.STACKDOCTOR_MSSQL_TEST_ERROR = "Cannot open database 'MissingDatabase' requested by the login. The login failed. (Error 4060)";

    const res = await checkAuthenticatedConnection(
      "mssql",
      "mssql://sa:password@localhost:1433/MissingDatabase",
      500
    );

    expect(res.success).toBe(false);
    expect(res.errorCategory).toBe("database_not_found");
    expect(res.error).toContain("Microsoft SQL Server database not found");
  });

  it("categorizes ECONNREFUSED as connection_refused", async () => {
    process.env.STACKDOCTOR_MSSQL_TEST_ERROR = "connect ECONNREFUSED 127.0.0.1:1433";

    const res = await checkAuthenticatedConnection(
      "mssql",
      "Server=127.0.0.1,1433;Database=TestDb;",
      500
    );

    expect(res.success).toBe(false);
    expect(res.errorCategory).toBe("connection_refused");
    expect(res.error).toContain("connection refused");
  });

  it("CRITICAL CANARY TEST: Never leaks canary password in error message", async () => {
    const canary = "CANARY_MSSQL_SECRET_PW_998877!";
    process.env.STACKDOCTOR_MSSQL_TEST_ERROR = `Login failed for user 'sa' with password=${canary}`;

    const res = await checkAuthenticatedConnection(
      "mssql",
      `Server=127.0.0.1,1433;Database=TestDb;Password=${canary};`,
      500
    );

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error).not.toContain(canary);
  });
});
