import { describe, it, expect } from "vitest";
import { redactText, redactEnv } from "@stackdoctor/core";

describe("Secret Redaction (redact.ts)", () => {
  it("masks URL credentials for various protocols", () => {
    const mongoUrl = "mongodb://adminUser:superSecretPassword123@cluster0.mongodb.net/prod_db";
    const postgresUrl = "postgres://postgres:myPostgresPassword@localhost:5432/main";
    const httpUrl = "https://apiKey:secretToken@api.github.com/repos";

    expect(redactText(mongoUrl)).toBe("mongodb://***:***@cluster0.mongodb.net/prod_db");
    expect(redactText(postgresUrl)).toBe("postgres://***:***@localhost:5432/main");
    expect(redactText(httpUrl)).toBe("https://***:***@api.github.com/repos");
  });

  it("masks Authorization Bearer and Basic headers", () => {
    const bearerHeader = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummyPayload.dummySig";
    const basicHeader = "Authorization: Basic dXNlcjpwYXNzd29yZA==";

    expect(redactText(bearerHeader)).toContain("Authorization: Bearer [REDACTED]");
    expect(redactText(basicHeader)).toContain("Authorization: Basic [REDACTED]");
  });

  it("masks AWS Access Key IDs", () => {
    const awsLog = "Connected using AWS access key AKIAIOSFODNN7EXAMPLE in region us-east-1";
    expect(redactText(awsLog)).toBe("Connected using AWS access key [REDACTED_AWS_KEY] in region us-east-1");
  });

  it("masks JWT tokens", () => {
    const sampleJwt = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    expect(redactText(sampleJwt)).not.toContain("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
    expect(redactText(sampleJwt)).toContain("[REDACTED_JWT]");
  });

  it("masks private key blocks", () => {
    const rsaKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Yh...
dummyPrivateKeyData...
-----END RSA PRIVATE KEY-----`;

    expect(redactText(rsaKey)).toBe("[REDACTED_PRIVATE_KEY]");
  });

  it("masks key-value pairs with secret keywords", () => {
    const log1 = "Starting with password=superSecretPassword and port=3000";
    const log2 = "Config: token: 'ghp_secretTokenHere' and api_key=\"my-secret-key\"";
    const jsonStr = '{"user": "alice", "password": "hiddenPassword123", "secret": "topSecret"}';

    expect(redactText(log1)).toBe("Starting with password=[REDACTED] and port=3000");
    expect(redactText(log2)).toBe("Config: token: '[REDACTED]' and api_key=\"[REDACTED]\"");
    expect(redactText(jsonStr)).toContain('"password": "[REDACTED]"');
    expect(redactText(jsonStr)).toContain('"secret": "[REDACTED]"');
  });

  it("does not modify normal text (false positive prevention)", () => {
    const normalText1 = "The NLP tokenizer tokenized 42 tokens from the input stream.";
    const normalText2 = "The agent secretly whispered hello to the client.";
    const normalUrl = "https://localhost:8080/api/v1/health?check=true";
    const normalNumber = "port=8080 timeout=5000 count=10";

    expect(redactText(normalText1)).toBe(normalText1);
    expect(redactText(normalText2)).toBe(normalText2);
    expect(redactText(normalUrl)).toBe(normalUrl);
    expect(redactText(normalNumber)).toBe(normalNumber);
  });

  it("redactEnv keeps variable names and redacts all values", () => {
    const env = {
      DATABASE_URL: "mongodb://user:pass@localhost:27017/db",
      PORT: "3000",
      NODE_ENV: "development",
      API_KEY: "supersecret"
    };

    const redacted = redactEnv(env);
    expect(redacted).toEqual({
      DATABASE_URL: "[REDACTED]",
      PORT: "[REDACTED]",
      NODE_ENV: "[REDACTED]",
      API_KEY: "[REDACTED]"
    });
  });
});
