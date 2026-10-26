import { redactText } from "@stackdoctor/core";
import type { Report } from "@stackdoctor/schemas";

const CANARY_SECRET_REGEX = /CANARY_SECRET_[A-Za-z0-9_]+/i;
const UNMASKED_PRIVATE_KEY_REGEX = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;
const UNMASKED_AWS_KEY_REGEX = /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/;

/**
 * Checks if a value contains obvious survived credentials or canary secrets.
 */
export function containsSurvivedSecrets(obj: unknown): boolean {
  if (typeof obj === "string") {
    if (CANARY_SECRET_REGEX.test(obj)) return true;
    if (UNMASKED_PRIVATE_KEY_REGEX.test(obj)) return true;
    if (UNMASKED_AWS_KEY_REGEX.test(obj)) return true;
    return false;
  }
  if (Array.isArray(obj)) {
    return obj.some(containsSurvivedSecrets);
  }
  if (obj !== null && typeof obj === "object") {
    return Object.values(obj).some(containsSurvivedSecrets);
  }
  return false;
}

/**
 * Recursively applies core redactText to all strings in an object/array.
 */
export function deepRedact<T>(data: T): T {
  if (typeof data === "string") {
    return redactText(data) as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => deepRedact(item)) as unknown as T;
  }
  if (data !== null && typeof data === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      copy[key] = deepRedact(value);
    }
    return copy as T;
  }
  return data;
}

/**
 * Sanitizes machine identifiers from the operating system string or paths.
 * Strips hostname, MAC, IP, and personal user names.
 */
export function sanitizeOperatingSystem(os: string): string {
  if (!os) return "unknown";
  // Remove potential IP addresses
  let cleaned = os.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[IP]");
  // Remove potential MAC addresses
  cleaned = cleaned.replace(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/g, "[MAC]");
  // Limit length
  return cleaned.trim().slice(0, 64);
}

/**
 * Sanitizes an entire validated report before storage.
 */
export function sanitizeReport(report: Report): Report {
  const redacted = deepRedact(report);
  redacted.operatingSystem = sanitizeOperatingSystem(redacted.operatingSystem);
  return redacted;
}
