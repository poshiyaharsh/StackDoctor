/**
 * Secret redaction utility for StackDoctor.
 * Strictly ensures no credentials, tokens, or private keys leak into logs or reports.
 */

// Private key blocks: RSA, EC, OPENSSH, PGP, etc.
const PRIVATE_KEY_REGEX = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;

// Standard JWT regex: eyJ...
const JWT_REGEX = /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g;

// AWS Access Key ID (AKIA...)
const AWS_KEY_REGEX = /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g;

// Authorization headers
const AUTH_BEARER_REGEX = /(Authorization\s*:\s*Bearer\s+)[^\r\n,;]+/gi;
const AUTH_BASIC_REGEX = /(Authorization\s*:\s*Basic\s+)[^\r\n,;]+/gi;

// URL credentials: proto://username:password@host...
const URL_CREDENTIALS_REGEX = /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^:\s/@]+):([^@\s/]+)@/g;

// Key-value pairs for secret assignments (e.g. password=..., DB_PASSWORD=..., "token": "...", api_key=...)
// Uses lookahead/word-boundaries to avoid false positives like "tokenizer" or "tokenized"
const SECRET_KV_REGEX = /\b((?:[a-zA-Z0-9_]*[_-])?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|secret[_-]?key|password|passwd|secret|token))(\s*[:=]\s*["']?)([^"'\s\r\n,;]+)(["']?)/gi;

// JSON formatted secrets (e.g. "password": "value")
const JSON_SECRET_REGEX = /("(?:\w*[_-])?(?:password|passwd|secret|token|api[_-]?key)"\s*:\s*")([^"\\]*(?:\\.[^"\\]*)*)(")/gi;

/**
 * Masks secrets from any raw string.
 * Leaves normal, non-secret text intact.
 */
export function redactText(input: string): string {
  if (!input) return input;

  let redacted = input;

  // 1. Private keys
  redacted = redacted.replace(PRIVATE_KEY_REGEX, "[REDACTED_PRIVATE_KEY]");

  // 2. JWT tokens
  redacted = redacted.replace(JWT_REGEX, "[REDACTED_JWT]");

  // 3. AWS keys
  redacted = redacted.replace(AWS_KEY_REGEX, "[REDACTED_AWS_KEY]");

  // 4. URL credentials: mongodb://user:pass@host -> mongodb://***:***@host
  redacted = redacted.replace(URL_CREDENTIALS_REGEX, (_match, proto) => `${proto}***:***@`);

  // 5. Authorization headers
  redacted = redacted.replace(AUTH_BEARER_REGEX, "$1[REDACTED]");
  redacted = redacted.replace(AUTH_BASIC_REGEX, "$1[REDACTED]");

  // 6. JSON secret fields
  redacted = redacted.replace(JSON_SECRET_REGEX, "$1[REDACTED]$3");

  // 7. Generic key-value secret fields
  redacted = redacted.replace(SECRET_KV_REGEX, (_match, key, sep, _val, quote) => {
    return `${key}${sep}[REDACTED]${quote}`;
  });

  return redacted;
}

/**
 * Keeps environment variable names, replaces every value with "[REDACTED]".
 */
export function redactEnv(obj: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(obj)) {
    result[key] = "[REDACTED]";
  }
  return result;
}
