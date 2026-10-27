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
    expect(config.AI_ENABLED).toBe(false);
    expect(config.AI_PROVIDER).toBe("anthropic");
    expect(config.AI_ENCRYPTION_MASTER_KEY).toBe("stackdoctor-default-master-key-32b-min");
  });

  it("loads custom AI configuration", () => {
    const config = loadConfig({
      MONGODB_URI: "mongodb://127.0.0.1:27017/test_db",
      SESSION_SECRET: "this_is_a_secure_session_secret_at_least_32_chars_long",
      AI_ENABLED: "true",
      AI_PROVIDER: "openai",
      AI_MODEL: "gpt-4o",
      AI_BASE_URL: "https://api.openai.com/v1",
      AI_API_KEY: "sk-test-canary-key",
      AI_ENCRYPTION_MASTER_KEY: "custom-master-encryption-key-for-test-32b"
    });

    expect(config.AI_ENABLED).toBe(true);
    expect(config.AI_PROVIDER).toBe("openai");
    expect(config.AI_MODEL).toBe("gpt-4o");
    expect(config.AI_BASE_URL).toBe("https://api.openai.com/v1");
    expect(config.AI_API_KEY).toBe("sk-test-canary-key");
    expect(config.AI_ENCRYPTION_MASTER_KEY).toBe("custom-master-encryption-key-for-test-32b");
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
