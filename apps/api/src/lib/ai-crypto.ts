import crypto from "node:crypto";

export interface EncryptedApiKey {
  ciphertext: string;
  iv: string;
  tag: string;
}

/**
 * Derives a 32-byte AES key from the master secret using SHA-256.
 */
function deriveKey(masterKey: string): Buffer {
  if (!masterKey || masterKey.length < 32) {
    throw new Error("AI master encryption key must be at least 32 characters long");
  }
  return crypto.createHash("sha256").update(masterKey, "utf8").digest();
}

/**
 * Encrypts an API key at rest using AES-256-GCM with a unique 12-byte IV per record.
 */
export function encryptApiKey(plaintext: string, masterKey: string): EncryptedApiKey {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("API key plaintext must be a non-empty string");
  }
  const key = deriveKey(masterKey);
  const iv = crypto.randomBytes(12); // NIST recommended 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return {
    ciphertext,
    iv: iv.toString("hex"),
    tag
  };
}

/**
 * Decrypts an encrypted API key in memory using AES-256-GCM.
 * Validates the authentication tag to guarantee integrity and authenticity.
 */
export function decryptApiKey(encrypted: EncryptedApiKey, masterKey: string): string {
  if (!encrypted || !encrypted.ciphertext || !encrypted.iv || !encrypted.tag) {
    throw new Error("Invalid encrypted API key payload: missing ciphertext, iv, or tag");
  }

  const key = deriveKey(masterKey);
  const ivBuffer = Buffer.from(encrypted.iv, "hex");
  const tagBuffer = Buffer.from(encrypted.tag, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBuffer);
  decipher.setAuthTag(tagBuffer);

  let decrypted = decipher.update(encrypted.ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
