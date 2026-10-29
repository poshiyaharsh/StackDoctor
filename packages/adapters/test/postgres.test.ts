import { describe, it, expect, vi } from "vitest";
import pg from "pg";
import {
  checkAuthenticatedConnection
} from "../src/database.js";

describe("PostgreSQL Adapter Unit & Error Categorization", () => {
  it("categorizes error 3D000 as database_not_found", async () => {
    vi.spyOn(pg.Client.prototype, "connect").mockRejectedValueOnce(
      Object.assign(new Error('database "prod_db" does not exist'), { code: "3D000" })
    );

    const res = await checkAuthenticatedConnection(
      "postgresql",
      "postgresql://user:pass@localhost:5432/prod_db",
      500
    );

    expect(res.success).toBe(false);
    expect(res.errorCategory).toBe("database_not_found");
    expect(res.error).toContain("PostgreSQL database not found");
  });

  it("categorizes error 28P01 as auth_failed", async () => {
    vi.spyOn(pg.Client.prototype, "connect").mockRejectedValueOnce(
      Object.assign(new Error('password authentication failed for user "appuser"'), {
        code: "28P01"
      })
    );

    const res = await checkAuthenticatedConnection(
      "postgresql",
      "postgresql://appuser:wrongpass@localhost:5432/mydb",
      500
    );

    expect(res.success).toBe(false);
    expect(res.errorCategory).toBe("auth_failed");
    expect(res.error).toContain("PostgreSQL authentication failed");
  });

  it("categorizes error 42501 as authorization_failed", async () => {
    vi.spyOn(pg.Client.prototype, "connect").mockResolvedValueOnce();
    vi.spyOn(pg.Client.prototype, "query").mockRejectedValueOnce(
      Object.assign(new Error('permission denied for table dummy'), { code: "42501" })
    );
    vi.spyOn(pg.Client.prototype, "end").mockResolvedValueOnce();

    const res = await checkAuthenticatedConnection(
      "postgresql",
      "postgresql://appuser:secret@localhost:5432/mydb",
      500
    );

    expect(res.success).toBe(false);
    expect(res.errorCategory).toBe("authorization_failed");
    expect(res.error).toContain("PostgreSQL authorization failed");
  });

  it("categorizes SSL required errors as ssl_required", async () => {
    vi.spyOn(pg.Client.prototype, "connect").mockRejectedValueOnce(
      new Error('no pg_hba.conf entry for host "1.2.3.4", user "postgres", database "db", no encryption')
    );

    const res = await checkAuthenticatedConnection(
      "postgresql",
      "postgresql://postgres:secret@1.2.3.4:5432/db",
      500
    );

    expect(res.success).toBe(false);
    expect(res.errorCategory).toBe("ssl_required");
    expect(res.error).toContain("PostgreSQL SSL/TLS configuration error");
  });

  it("CRITICAL CANARY TEST: Never leaks canary password in error message", async () => {
    const canarySecret = "SUPER_SECRET_CANARY_PW_123456!";
    vi.spyOn(pg.Client.prototype, "connect").mockRejectedValueOnce(
      new Error(`connection failed with password=${canarySecret}`)
    );

    const res = await checkAuthenticatedConnection(
      "postgresql",
      `postgresql://app:${canarySecret}@127.0.0.1:5432/db`,
      500
    );

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error).not.toContain(canarySecret);
  });
});
