import os from "node:os";
import { redactText } from "@stackdoctor/core";
import type { Report, Finding } from "@stackdoctor/schemas";
import type {
  AiInput,
  AiInputEnvironment,
  AiInputEvidenceItem,
  AiInputFinding
} from "./types.js";

export interface BuildAiInputOptions {
  maxInputBytes?: number;
  projectPath?: string;
  homeDir?: string;
  hostnames?: string[];
  environment?: {
    osFamily?: string;
    runtimeVersions?: string[];
  };
}

interface SanitizationContext {
  projectPath?: string;
  homeDir?: string;
  hostnames: string[];
  usernames: string[];
}

function getSanitizationContext(options: BuildAiInputOptions = {}): SanitizationContext {
  const hostnames: string[] = [];
  if (options.hostnames) {
    hostnames.push(...options.hostnames);
  }
  const osHost = os.hostname();
  if (osHost && !hostnames.includes(osHost)) {
    hostnames.push(osHost);
  }
  if (process.env.COMPUTERNAME && !hostnames.includes(process.env.COMPUTERNAME)) {
    hostnames.push(process.env.COMPUTERNAME);
  }

  const usernames: string[] = [];
  const currentUsername = process.env.USERNAME || process.env.USER;
  if (currentUsername && currentUsername.length >= 3) {
    usernames.push(currentUsername);
  }

  let homeDir = options.homeDir || process.env.USERPROFILE || process.env.HOME || "";
  // Strip trailing slashes
  homeDir = homeDir.replace(/[\\/]+$/, "");

  let projectPath = options.projectPath || "";
  projectPath = projectPath.replace(/[\\/]+$/, "");

  return {
    projectPath,
    homeDir,
    hostnames,
    usernames
  };
}

/**
 * Sanitizes a single string by stripping absolute paths, home directories,
 * usernames, hostnames, and applying core secret redaction.
 */
export function sanitizeString(val: string, ctx: SanitizationContext): string {
  if (!val || typeof val !== "string") {
    return "";
  }

  let text = val;

  // 1. Strip project path if defined
  if (ctx.projectPath) {
    const escapedProj = ctx.projectPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const projRegex = new RegExp(escapedProj.replace(/\\\\|\\\//g, "[\\\\/]"), "gi");
    text = text.replace(projRegex, "[PROJECT_ROOT]");
  }

  // 2. Strip explicit home directory if defined
  if (ctx.homeDir) {
    const escapedHome = ctx.homeDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const homeRegex = new RegExp(escapedHome.replace(/\\\\|\\\//g, "[\\\\/]"), "gi");
    text = text.replace(homeRegex, "[HOME]");
  }

  // 3. Generic User Home paths (Windows C:\Users\<user>, macOS /Users/<user>, Linux /home/<user>)
  text = text.replace(new RegExp("(?:[A-Za-z]:)?(?:\\\\|/)Users(?:\\\\|/)[^\\\\/]+(?=(?:\\\\|/)|$)", "gi"), "[HOME]");
  text = text.replace(new RegExp("/home/[^/]+(?=/|$)", "gi"), "[HOME]");

  // 4. Strip hostnames
  for (const host of ctx.hostnames) {
    if (host && host.length >= 3) {
      const escaped = host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "[HOSTNAME]");
    }
  }

  // 5. Strip usernames if they appear in path or words
  for (const username of ctx.usernames) {
    if (username && username.length >= 3) {
      const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "[USER]");
    }
  }

  // 6. Apply core secret / token / canary redaction
  text = redactText(text);

  return text;
}

/**
 * Type guard for Report
 */
function isReport(input: unknown): input is Report {
  return (
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input &&
    "findings" in input &&
    "operatingSystem" in input
  );
}

/**
 * Builds a sanitized, allowlist-filtered AiInput object from a Report or Finding array.
 */
export function buildAiInput(
  reportOrFindings: Report | Finding[] | { findings: Finding[]; environment?: Partial<AiInputEnvironment> },
  options: BuildAiInputOptions = {}
): AiInput {
  const maxBytes = options.maxInputBytes ?? 16000;
  const ctx = getSanitizationContext(options);

  let rawFindings: Finding[] = [];
  let osFamily = options.environment?.osFamily || "unknown";
  let runtimeVersions: string[] = options.environment?.runtimeVersions || [];

  if (isReport(reportOrFindings)) {
    rawFindings = reportOrFindings.findings || [];
    osFamily = options.environment?.osFamily || reportOrFindings.operatingSystem || "unknown";
    if (runtimeVersions.length === 0 && Array.isArray(reportOrFindings.technologies)) {
      runtimeVersions = reportOrFindings.technologies.map((t) => t.name);
    }
  } else if (Array.isArray(reportOrFindings)) {
    rawFindings = reportOrFindings;
  } else if (reportOrFindings && typeof reportOrFindings === "object" && "findings" in reportOrFindings) {
    rawFindings = reportOrFindings.findings || [];
    if (reportOrFindings.environment) {
      osFamily = options.environment?.osFamily || reportOrFindings.environment.osFamily || osFamily;
      runtimeVersions = options.environment?.runtimeVersions || reportOrFindings.environment.runtimeVersions || runtimeVersions;
    }
  }

  // Sanitize environment
  const environment: AiInputEnvironment = {
    osFamily: sanitizeString(osFamily, ctx),
    runtimeVersions: runtimeVersions.map((v) => sanitizeString(v, ctx))
  };

  // Allowlist and sanitize findings
  const sanitizedFindings: AiInputFinding[] = rawFindings.map((f) => {
    const evidenceItems: AiInputEvidenceItem[] = (f.evidence || []).map((e) => ({
      id: sanitizeString(e.id, ctx),
      kind: sanitizeString(e.kind, ctx),
      observed: sanitizeString(e.observed || "", ctx)
    }));

    return {
      ruleId: sanitizeString(f.ruleId, ctx),
      title: sanitizeString(f.title, ctx),
      severity: f.severity,
      confidence: f.confidence,
      category: sanitizeString(f.category || "general", ctx),
      evidence: evidenceItems,
      possibleCauses: (f.possibleCauses || []).map((c) => sanitizeString(c, ctx))
    };
  });

  const result: AiInput = {
    findings: sanitizedFindings,
    environment,
    isTruncated: false
  };

  // Byte capping check
  let jsonStr = JSON.stringify(result);
  let byteLen = Buffer.byteLength(jsonStr, "utf-8");

  if (byteLen <= maxBytes) {
    return result;
  }

  // Need truncation: mark as truncated
  result.isTruncated = true;

  // Step 1: Truncate large evidence observed fields to max 256 characters
  for (const finding of result.findings) {
    for (const ev of finding.evidence) {
      if (ev.observed.length > 256) {
        ev.observed = ev.observed.slice(0, 256) + "... [TRUNCATED]";
      }
    }
  }

  jsonStr = JSON.stringify(result);
  byteLen = Buffer.byteLength(jsonStr, "utf-8");
  if (byteLen <= maxBytes) {
    return result;
  }

  // Step 2: Reduce number of findings until it fits within maxBytes
  while (result.findings.length > 0 && byteLen > maxBytes) {
    result.findings.pop();
    jsonStr = JSON.stringify(result);
    byteLen = Buffer.byteLength(jsonStr, "utf-8");
  }

  return result;
}
