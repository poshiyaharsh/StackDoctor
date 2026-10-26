import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

describe("API Configuration (config.ts)", () => {
  it("loads valid configuration with defaults", () => {
    const config = loadConfig({
      MONGODB_URI: "mongodb://127.0.0.1:27017/test_db",
      SESSION_SECRET: "this_is_a_secure_session_secret_at_least_32_chars_long"
    });

    expect(config.PORT).toBe(3001);
    expect(config.NODE_ENV).toBe("development");
    expect(config.MONGODB_URI).toBe("mongodb://127.0.0.1:27017/test_db");
    expect(config.COOKIE_SECURE).toBe(false);
  });

  it("fails fast with error when MONGODB_URI is missing", () => {
    expect(() =>
      loadConfig({
        SESSION_SECRET: "this_is_a_secure_session_secret_at_least_32_chars_long"
      })
    ).toThrow(/MONGODB_URI is required/);
  });

  it("fails fast when SESSION_SECRET is shorter than 32 characters", () => {
    expect(() =>
      loadConfig({
        MONGODB_URI: "mongodb://127.0.0.1:27017/test_db",
        SESSION_SECRET: "short_secret"
      })
    ).toThrow(/SESSION_SECRET must be at least 32 characters long/);
  });
});
