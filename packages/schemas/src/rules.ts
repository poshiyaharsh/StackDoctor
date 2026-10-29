import { z } from "zod";
import { SeveritySchema, ConfidenceSchema } from "./enums.js";

export const ALLOWED_DOC_DOMAINS = [
  "nodejs.org",
  "python.org",
  "pip.pypa.io",
  "pypa.io",
  "djangoproject.com",
  "mongodb.com",
  "mysql.com",
  "postgresql.org",
  "spring.io",
  "openjdk.org",
  "oracle.com",
  "docker.com",
  "npmjs.com",
  "12factor.net",
  "github.com",
  "stackdoctor.dev"
] as const;

export function isAllowedDocUrl(urlStr: string): boolean {
  if (typeof urlStr !== "string" || !urlStr.startsWith("https://")) {
    return false;
  }
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_DOC_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export const DocUrlSchema = z.string().refine(isAllowedDocUrl, {
  message:
    "Documentation link must be a valid https URL from an allowlisted domain (nodejs.org, python.org, djangoproject.com, mongodb.com, mysql.com, docker.com, npmjs.com, 12factor.net, github.com)"
});

export const RuleMetadataSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(256),
  description: z.string().min(1).max(2000),
  technologies: z.array(z.string().min(1).max(128)).min(1),
  severity: SeveritySchema,
  confidence: ConfidenceSchema,
  docs: z.array(DocUrlSchema).default([])
});
export type RuleMetadata = z.infer<typeof RuleMetadataSchema>;

