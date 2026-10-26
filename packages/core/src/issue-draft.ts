import {
  type Report,
  type Finding,
  type Severity,
  type Evidence,
  type Recommendation,
  type TechnologyDetection
} from "@stackdoctor/schemas";
import { redactText } from "./redact.js";

export interface IssueDraftOptions {
  minSeverity?: Severity;
  includeEvidence?: boolean;
  projectPath?: string;
  homeDir?: string;
  username?: string;
  hostname?: string;
  maxBodyLength?: number;
}

export interface IssueDraft {
  title: string;
  body: string;
  labels: string[];
}

const SEVERITY_LEVELS: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const GITHUB_MAX_BODY_LIMIT = 60_000;

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Sanitizes sensitive identifiers, absolute paths, hostnames, usernames, IPs, and secrets.
 */
export function sanitizeDraftContent(text: string, options?: IssueDraftOptions): string {
  if (!text) return "";

  let result = text;

  // 1. Project path normalization (if provided)
  if (options?.projectPath) {
    const normProj = options.projectPath.replace(/[/\\]+$/, "");
    const winProj = normProj.replace(/\//g, "\\");
    const unixProj = normProj.replace(/\\/g, "/");

    result = result.replace(new RegExp(escapeRegex(winProj), "gi"), "<project>");
    result = result.replace(new RegExp(escapeRegex(unixProj), "gi"), "<project>");
  }

  // 2. Home directory normalization (if provided)
  if (options?.homeDir) {
    const normHome = options.homeDir.replace(/[/\\]+$/, "");
    const winHome = normHome.replace(/\//g, "\\");
    const unixHome = normHome.replace(/\\/g, "/");

    result = result.replace(new RegExp(escapeRegex(winHome), "gi"), "~");
    result = result.replace(new RegExp(escapeRegex(unixHome), "gi"), "~");
  }

  // 3. Username normalization
  if (options?.username && options.username.trim().length > 2) {
    result = result.replace(new RegExp(escapeRegex(options.username.trim()), "gi"), "<user>");
  }
  if (typeof process !== "undefined" && process?.env) {
    const envUser = process.env.USERNAME || process.env.USER;
    if (envUser && envUser.trim().length > 2) {
      result = result.replace(new RegExp(escapeRegex(envUser.trim()), "gi"), "<user>");
    }
  }

  // 4. Hostname normalization
  if (options?.hostname && options.hostname.trim().length > 2) {
    result = result.replace(new RegExp(escapeRegex(options.hostname.trim()), "gi"), "<host>");
  }

  // 5. Windows user directory pattern (e.g. C:\Users\john_doe\...) -> ~\...
  result = result.replace(/[a-zA-Z]:[/\\](?:Users|Documents and Settings)[/\\][^/\\\s"':`]+/gi, "~");

  // 6. Unix user directory pattern (e.g. /home/john_doe/... or /Users/john_doe/...) -> ~\...
  result = result.replace(/\/(?:Users|home)\/[^/\\\s"':`]+/gi, "~");

  // 7. General Windows absolute paths (e.g. C:\workspace\foo -> <project>\foo)
  result = result.replace(/\b[a-zA-Z]:\\[^ \t\r\n"'>`)]+/g, (match) => {
    // If it already starts with ~, leave it
    if (match.startsWith("~")) return match;
    const parts = match.split(/\\/);
    if (parts.length > 2) {
      return `<project>\\${parts.slice(2).join("\\")}`;
    }
    return "<project>";
  });

  // 8. General Unix system absolute paths (/tmp/..., /var/..., /etc/..., /opt/...)
  result = result.replace(/\b\/(?:tmp|var|private|etc|opt)\/[^ \t\r\n"'>`)]+/gi, "<path>");

  // 9. IP addresses (IPv4 and IPv6)
  const IPV4_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
  const IPV6_REGEX = /\b(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}\b/g;
  result = result.replace(IPV4_REGEX, "[REDACTED_IP]");
  result = result.replace(IPV6_REGEX, "[REDACTED_IP]");

  // 10. Core secrets redaction (keys, tokens, credentials, JWTs, AWS keys)
  result = redactText(result);

  return result;
}

/**
 * Extracts any observed runtime versions from technology and check evidence.
 */
function extractRuntimeVersions(report: Report): string[] {
  const versions: string[] = [];

  if (report.technologies) {
    for (const tech of report.technologies) {
      for (const ev of tech.evidence || []) {
        if (ev.observed && /version|v\d+\.\d+/i.test(ev.observed)) {
          versions.push(`${tech.name}: ${ev.observed.trim()}`);
        }
      }
    }
  }

  if (report.checks) {
    for (const chk of report.checks) {
      if (chk.id?.includes("version") || chk.title?.toLowerCase().includes("version")) {
        for (const ev of chk.evidence || []) {
          if (ev.observed) {
            versions.push(`${chk.title || chk.id}: ${ev.observed.trim()}`);
          }
        }
      }
    }
  }

  return Array.from(new Set(versions));
}

/**
 * Builds a sanitized, GitHub-flavored markdown issue draft from a DiagnosticReport.
 * Never makes any network calls.
 */
export function buildIssueDraft(
  report: Report,
  options: IssueDraftOptions = {}
): IssueDraft {
  const minSeverity = options.minSeverity;
  const includeEvidence = options.includeEvidence !== false;
  const maxBodyLength = options.maxBodyLength || GITHUB_MAX_BODY_LIMIT;

  // 1. Filter findings by minimum severity
  const allFindings = (report.findings || []) as Finding[];
  const findings = minSeverity
    ? allFindings.filter((f) => SEVERITY_LEVELS[f.severity] >= SEVERITY_LEVELS[minSeverity])
    : allFindings;

  // 2. Build Title
  const projectName = report.projectName || "Project";
  let title = `[Environment Issue] ${projectName}`;
  if (findings.length === 1) {
    title += `: ${findings[0].title}`;
  } else if (findings.length > 1) {
    title += `: ${findings[0].title} (+${findings.length - 1} more)`;
  } else {
    title += `: Diagnostics report (0 issues)`;
  }
  title = sanitizeDraftContent(title, options);

  // 3. Build Labels
  const labels: string[] = ["environment", "stackdoctor"];
  if (findings.some((f) => f.severity === "critical" || f.severity === "high")) {
    labels.push("bug");
  }

  // 4. Build Sections
  const sections: string[] = [];

  // Summary Section
  const severityCounts = report.summary?.bySeverity || {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  };
  const breakdownStr = `critical: ${severityCounts.critical || 0}, high: ${severityCounts.high || 0}, medium: ${severityCounts.medium || 0}, low: ${severityCounts.low || 0}, info: ${severityCounts.info || 0}`;

  sections.push(`## Summary
- **Project**: ${projectName}
- **Status**: \`${report.status || "completed"}\`
- **Total Checks**: ${report.summary?.totalChecks ?? report.checks?.length ?? 0}
- **Total Findings**: ${report.summary?.totalFindings ?? allFindings.length} (${breakdownStr})
${minSeverity ? `- **Filter**: Minimum severity \`${minSeverity}\` (${findings.length} findings displayed)\n` : ""}- **Timestamp**: ${report.completedAt || report.startedAt || new Date().toISOString()}`);

  // Environment Section
  const runtimeVersions = extractRuntimeVersions(report);
  const runtimeStr = runtimeVersions.length > 0 ? runtimeVersions.join(", ") : "Not specified in report";

  sections.push(`## Environment
- **Operating System**: ${report.operatingSystem || "unknown"}
- **Tool Version**: StackDoctor v${report.toolVersion || "0.1.0"}
- **Runtime Versions**: ${runtimeStr}
- **Schema Version**: ${report.schemaVersion || "1.0.0"}`);

  // Detected Technologies Section
  const technologies = (report.technologies || []) as TechnologyDetection[];
  if (technologies.length > 0) {
    const techList = technologies
      .map((t) => `- **${t.name}** (Confidence: \`${t.confidence}\`)`)
      .join("\n");
    sections.push(`## Detected Technologies\n${techList}`);
  } else {
    sections.push(`## Detected Technologies\nNone detected`);
  }

  // Findings Section
  if (findings.length > 0) {
    const tableHeader = `| Rule ID | Severity | Category | Title |\n|---|---|---|---|`;
    const tableRows = findings
      .map((f) => `| \`${f.ruleId}\` | **${f.severity.toUpperCase()}** | ${f.category} | ${f.title} |`)
      .join("\n");
    sections.push(`## Findings\n${tableHeader}\n${tableRows}`);
  } else {
    sections.push(
      `## Findings\nNo findings reported${minSeverity ? ` matching minimum severity "${minSeverity}"` : ""}.`
    );
  }

  // Observed Evidence Section (OBSERVED only)
  if (!includeEvidence) {
    sections.push(`## Observed Evidence\n> [!NOTE]\n> Observed evidence omitted via options.`);
  } else {
    const evidenceBlocks: string[] = [];
    for (const f of findings) {
      if (f.evidence && f.evidence.length > 0) {
        const evLines: string[] = [];
        evLines.push(`### ${f.title} (\`${f.ruleId}\`)`);
        for (const ev of f.evidence as Evidence[]) {
          evLines.push(`- **Source**: \`${ev.source || "probe"}\``);
          evLines.push(`- **Kind**: \`${ev.kind || "diagnostic"}\``);
          if (ev.description) {
            evLines.push(`- **Description**: ${ev.description}`);
          }
          if (ev.observed) {
            evLines.push(`- **Observed**:\n\`\`\`\n${ev.observed.trim()}\n\`\`\``);
          }
        }
        evidenceBlocks.push(evLines.join("\n"));
      }
    }

    if (evidenceBlocks.length > 0) {
      sections.push(
        `## Observed Evidence\n> [!NOTE]\n> **Observed Only:** The following details were directly observed by StackDoctor diagnostic probes during environment inspection. No speculation is included in this section.\n\n${evidenceBlocks.join("\n\n")}`
      );
    } else {
      sections.push(
        `## Observed Evidence\n> [!NOTE]\n> **Observed Only:** No observed evidence items attached to matching findings.`
      );
    }
  }

  // Possible Causes Section (labeled as hypotheses)
  const causesBlocks: string[] = [];
  for (const f of findings) {
    const causes = (f.possibleCauses || []) as (string | { description?: string })[];
    if (causes.length > 0) {
      const causeItems = causes
        .map((c) => {
          const desc = typeof c === "string" ? c : c?.description || "";
          return `- ${desc}`;
        })
        .filter((line) => line.length > 2);

      if (causeItems.length > 0) {
        causesBlocks.push(`### ${f.title} (\`${f.ruleId}\`)\n${causeItems.join("\n")}`);
      }
    }
  }

  if (causesBlocks.length > 0) {
    sections.push(
      `## Possible Causes (Hypotheses)\n> [!IMPORTANT]\n> **Hypotheses Only:** The following are automated hypotheses based on diagnostic heuristics. They are possible explanations, not verified facts.\n\n${causesBlocks.join("\n\n")}`
    );
  } else {
    sections.push(
      `## Possible Causes (Hypotheses)\n> [!IMPORTANT]\n> **Hypotheses Only:** No automated hypotheses were generated for matching findings.`
    );
  }

  // Steps Already Suggested Section
  const recBlocks: string[] = [];
  for (const f of findings) {
    const recs = (f.recommendations || (f as unknown as { remediation?: unknown[] }).remediation || []) as (
      | Recommendation
      | { commandOrAction?: string; problem?: string; expectedResult?: string; undo?: string }
    )[];
    if (recs.length > 0) {
      const recLines: string[] = [];
      recLines.push(`### ${f.title} (\`${f.ruleId}\`)`);
      for (const r of recs) {
        if (r.problem) recLines.push(`- **Problem**: ${r.problem}`);
        if (r.commandOrAction) {
          recLines.push(`- **Suggested Action**:\n  \`\`\`bash\n  ${r.commandOrAction}\n  \`\`\``);
        }
        if (r.expectedResult) recLines.push(`- **Expected Result**: ${r.expectedResult}`);
        if (r.undo) recLines.push(`- **Undo Action**: \`${r.undo}\``);
      }
      recBlocks.push(recLines.join("\n"));
    }
  }

  if (recBlocks.length > 0) {
    sections.push(`## Steps Already Suggested\n${recBlocks.join("\n\n")}`);
  }

  // Steps to Reproduce Section (placeholder for user to fill)
  sections.push(`## Steps to Reproduce
<!-- Please describe the steps to reproduce this environment state: -->
1. 
2. 
3. `);

  // Additional Context Section (placeholder)
  sections.push(`## Additional Context
<!-- Add any other context, recent changes to configuration, or error logs here: -->`);

  // Assemble and sanitize full body
  const rawBody = sections.join("\n\n");
  let sanitizedBody = sanitizeDraftContent(rawBody, options);

  // Truncation if body exceeds maxBodyLength
  if (sanitizedBody.length > maxBodyLength) {
    const truncationNotice = `\n\n---\n> [!WARNING]\n> **Note:** This diagnostic report was truncated to fit within GitHub's issue body size limit (65,536 characters). Run \`stackdoctor scan\` locally or inspect the full report on the StackDoctor dashboard for complete details.`;
    const targetCut = maxBodyLength - truncationNotice.length;
    const lastNewline = sanitizedBody.lastIndexOf("\n", targetCut);
    const cutIndex = lastNewline > targetCut - 500 ? lastNewline : targetCut;
    sanitizedBody = sanitizedBody.slice(0, cutIndex) + truncationNotice;
  }

  return {
    title,
    body: sanitizedBody,
    labels
  };
}
