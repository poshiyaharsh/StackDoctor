import { describe, it, expect } from "vitest";
import { encryptApiKey, decryptApiKey } from "../src/lib/ai-crypto.js";

describe("AI Key Encryption at Rest (ai-crypto.ts)", () => {
  const masterKey = "this_is_a_secure_master_key_for_testing_32chars!";
  const canaryKey = "sk-ant-api03-canary_secret_token_1234567890_stackdoctor";

  it("encrypts and decrypts API key accurately (roundtrip)", () => {
    const encrypted = encryptApiKey(canaryKey, masterKey);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();

    // Verify ciphertext does NOT contain the canary key plaintext
    expect(encrypted.ciphertext).not.toContain(canaryKey);
    expect(encrypted.iv).not.toContain(canaryKey);
    expect(encrypted.tag).not.toContain(canaryKey);

    const decrypted = decryptApiKey(encrypted, masterKey);
    expect(decrypted).toBe(canaryKey);
  });

  it("generates unique random IVs on subsequent encryptions of the same key", () => {
    const enc1 = encryptApiKey(canaryKey, masterKey);
    const enc2 = encryptApiKey(canaryKey, masterKey);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });

  it("fails to decrypt if ciphertext is tampered with", () => {
    const encrypted = encryptApiKey(canaryKey, masterKey);
    const tampered = {
      ...encrypted,
      ciphertext: encrypted.ciphertext.slice(0, -2) + (encrypted.ciphertext.endsWith("aa") ? "bb" : "aa")
    };

    expect(() => decryptApiKey(tampered, masterKey)).toThrow();
  });

  it("fails to decrypt if authentication tag is invalid or tampered", () => {
    const encrypted = encryptApiKey(canaryKey, masterKey);
    const tampered = {
      ...encrypted,
      tag: "00".repeat(16)
    };

    expect(() => decryptApiKey(tampered, masterKey)).toThrow();
  });

  it("fails to decrypt with a different master key", () => {
    const encrypted = encryptApiKey(canaryKey, masterKey);
    const wrongMasterKey = "completely_different_master_encryption_key_32chars";

    expect(() => decryptApiKey(encrypted, wrongMasterKey)).toThrow();
  });

  it("fails fast if master key is too short (< 32 chars)", () => {
    expect(() => encryptApiKey(canaryKey, "short_key")).toThrow(
      /at least 32 characters long/
    );
  });
});
