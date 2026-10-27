import type { Report } from "@stackdoctor/schemas";
import { redactText, type ReportComparison } from "@stackdoctor/core";

export interface FormatOptions {
  noColor?: boolean;
}

export function formatTerminalReport(report: Report, options: FormatOptions = {}): string {
  const useColor = !options.noColor && !process.env.NO_COLOR;

  // Simple ANSI color helpers
  const c = {
    bold: (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
    dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
    green: (s: string) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
    yellow: (s: string) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
    red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
    cyan: (s: string) => (useColor ? `\x1b[36m${s}\x1b[0m` : s),
    gray: (s: string) => (useColor ? `\x1b[90m${s}\x1b[0m` : s)
  };

  const lines: string[] = [];

  // ==========================================
  // Section 1: Scan Summary
  // ==========================================
  lines.push(c.bold("=== StackDoctor Diagnostic Report ==="));
  lines.push(`Project Name : ${c.bold(report.projectName)}`);
  const statusColor =
    report.status === "completed"
      ? c.green("PASSED")
      : report.status === "completed_with_warnings"
        ? c.yellow("COMPLETED WITH WARNINGS")
        : report.status === "cancelled"
          ? c.yellow("CANCELLED")
          : c.red("FAILED");
  lines.push(`Status       : ${statusColor}`);
  lines.push(
    `Summary      : ${report.summary.totalChecks} checks run | ${report.summary.totalFindings} findings detected`
  );
  lines.push(
    c.dim(
      `               (Critical: ${report.summary.bySeverity.critical}, High: ${report.summary.bySeverity.high}, Medium: ${report.summary.bySeverity.medium}, Low: ${report.summary.bySeverity.low}, Info: ${report.summary.bySeverity.info})`
    )
  );
  lines.push("");

  // ==========================================
  // Section 2: Technologies Detected
  // ==========================================
  lines.push(c.bold("--- Technologies Detected ---"));
  if (report.technologies.length === 0) {
    lines.push(c.dim("  No specific technology signatures detected."));
  } else {
    for (const tech of report.technologies) {
      lines.push(`  • ${c.cyan(tech.name)} ${c.dim(`(${tech.confidence})`)}`);
    }
  }
  lines.push("");

  // ==========================================
  // Section 3: Environment Info
  // ==========================================
  lines.push(c.bold("--- Environment Info ---"));
  lines.push(`  Operating System : ${report.operatingSystem}`);
  lines.push(`  Node Version     : ${process.version}`);
  lines.push(`  Started At       : ${report.startedAt}`);
  lines.push(`  Completed At     : ${report.completedAt}`);
  lines.push("");

  // Categorize checks & findings
  const passedChecks = report.checks.filter((chk) => chk.status === "passed");
  const warningChecks = report.checks.filter((chk) => chk.status === "warning");
  const failedChecks = report.checks.filter((chk) => chk.status === "failed" || chk.status === "error");

  // ==========================================
  // Section 4: Passed Checks
  // ==========================================
  lines.push(c.bold("--- Passed Checks ---"));
  if (passedChecks.length === 0) {
    lines.push(c.dim("  None."));
  } else {
    for (const chk of passedChecks) {
      lines.push(`  ${c.green("[PASS]")} ${chk.title} ${c.dim(`(${chk.durationMs}ms)`)}`);
    }
  }
  lines.push("");

  // ==========================================
  // Section 5: Warnings
  // ==========================================
  lines.push(c.bold("--- Warnings ---"));
  const warningFindings = report.findings.filter(
    (f) => f.severity === "medium" || f.severity === "low" || f.severity === "info"
  );
  if (warningChecks.length === 0 && warningFindings.length === 0) {
    lines.push(c.dim("  No warnings."));
  } else {
    for (const chk of warningChecks) {
      lines.push(`  ${c.yellow("[WARN]")} Check: ${chk.title} ${c.dim(`(${chk.durationMs}ms)`)}`);
    }
    for (const finding of warningFindings) {
      lines.push(
        `  ${c.yellow("[WARN]")} [${finding.ruleId}] ${finding.title} ${c.dim(`(${finding.severity} severity, ${finding.confidence})`)}`
      );
    }
  }
  lines.push("");

  // ==========================================
  // Section 6: Failed Checks
  // ==========================================
  lines.push(c.bold("--- Failed Checks ---"));
  const highOrCriticalFindings = report.findings.filter(
    (f) => f.severity === "high" || f.severity === "critical"
  );
  if (failedChecks.length === 0 && highOrCriticalFindings.length === 0) {
    lines.push(c.dim("  No failures."));
  } else {
    for (const chk of failedChecks) {
      const errorText = chk.error ? ` - ${chk.error}` : "";
      lines.push(`  ${c.red("[FAIL]")} Check: ${chk.title} ${c.dim(`(${chk.durationMs}ms)`)}${errorText}`);
    }
    for (const finding of highOrCriticalFindings) {
      lines.push(
        `  ${c.red("[FAIL]")} [${finding.ruleId}] ${finding.title} ${c.dim(`(${finding.severity} severity, ${finding.confidence})`)}`
      );
    }
  }
  lines.push("");

  // ==========================================
  // Section 7: Evidence per Finding (OBSERVED)
  // ==========================================
  lines.push(c.bold("--- Observed Evidence (FACTS ONLY) ---"));
  if (report.findings.length === 0) {
    lines.push(c.dim("  No finding evidence to report."));
  } else {
    for (const finding of report.findings) {
      lines.push(`  Finding: ${c.bold(finding.title)} (${c.cyan(finding.ruleId)})`);
      for (const ev of finding.evidence) {
        lines.push(`    ${c.bold("OBSERVED:")} ${ev.observed}`);
        lines.push(`    ${c.dim(`Source  : ${ev.source} [${ev.kind}]`)}`);
      }
    }
  }
  lines.push("");

  // ==========================================
  // Section 8: Probable Causes (POSSIBLE)
  // ==========================================
  lines.push(c.bold("--- Probable Causes (POSSIBLE HYPOTHESES) ---"));
  if (report.findings.length === 0) {
    lines.push(c.dim("  None."));
  } else {
    for (const finding of report.findings) {
      lines.push(`  Finding: ${c.bold(finding.title)}`);
      if (finding.possibleCauses.length === 0) {
        lines.push(c.dim("    No probable causes listed."));
      } else {
        for (const cause of finding.possibleCauses) {
          lines.push(`    ${c.yellow("POSSIBLE:")} ${cause}`);
        }
      }
    }
  }
  lines.push("");

  // ==========================================
  // Section 9: Recommended Next Steps
  // ==========================================
  lines.push(c.bold("--- Recommended Next Steps ---"));
  if (report.findings.length === 0) {
    lines.push(c.green("  All clear! Environment looks ready."));
  } else {
    let stepNumber = 1;
    for (const finding of report.findings) {
      for (const rec of finding.recommendations) {
        lines.push(
          `  ${stepNumber}. ${c.bold("Action     :")} ${c.cyan(rec.commandOrAction)}`
        );
        lines.push(`     Problem    : ${rec.problem}`);
        lines.push(`     Expected   : ${rec.expectedResult}`);
        lines.push(`     Risks      : ${c.dim(rec.risks)}`);
        if (rec.undo) {
          lines.push(`     Undo       : ${c.dim(rec.undo)}`);
        }
        lines.push(`     Verify     : ${c.dim(rec.verification)}`);
        stepNumber++;
      }
    }
  }
  lines.push("");

  // ==========================================
  // Section 10: Tool Version
  // ==========================================
  lines.push(
    c.dim(`StackDoctor CLI v${report.toolVersion} | Schema v${report.schemaVersion}`)
  );

  return redactText(lines.join("\n"));
}

export interface MarkdownFormatOptions {
  projectPath?: string;
}

/**
 * Formats a diagnostic report into a compact, sanitized Markdown summary suitable
 * for CI logs and GitHub Actions step summaries ($GITHUB_STEP_SUMMARY).
 */
export function formatMarkdownReport(
  report: Report,
  options: MarkdownFormatOptions = {}
): string {
  const lines: string[] = [];
  const projectName = report.projectName || "Project";

  lines.push(`## StackDoctor Diagnostic Summary: ${projectName}`);
  lines.push("");
  lines.push(
    `> **Status:** \`${report.status}\` | **Total Checks:** ${report.summary.totalChecks} | **Total Findings:** ${report.summary.totalFindings}`
  );
  lines.push("");

  // Severity Counts Table
  lines.push("### Findings by Severity");
  lines.push("| Critical | High | Medium | Low | Info |");
  lines.push("|:---:|:---:|:---:|:---:|:---:|");
  const sev = report.summary.bySeverity || {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  };
  lines.push(
    `| ${sev.critical || 0} | ${sev.high || 0} | ${sev.medium || 0} | ${sev.low || 0} | ${sev.info || 0} |`
  );
  lines.push("");

  // Findings Table
  lines.push("### Detected Issues");
  if (report.findings.length === 0) {
    lines.push("");
    lines.push("✅ **All checks passed! No issues detected in project environment.**");
    lines.push("");
  } else {
    lines.push("| Severity | Rule ID | Category | Title |");
    lines.push("|---|---|---|---|");
    for (const f of report.findings) {
      lines.push(
        `| **${f.severity.toUpperCase()}** | \`${f.ruleId}\` | ${f.category} | ${f.title} |`
      );
    }
    lines.push("");

    // Collapsed Details
    lines.push("<details>");
    lines.push("<summary><strong>Finding Details & Recommendations</strong> (click to expand)</summary>");
    lines.push("");

    for (const f of report.findings) {
      lines.push(`#### \`${f.ruleId}\`: ${f.title}`);
      lines.push(`- **Severity**: ${f.severity.toUpperCase()}`);
      lines.push(`- **Confidence**: ${f.confidence}`);
      lines.push(`- **Category**: ${f.category}`);

      if (f.evidence && f.evidence.length > 0) {
        lines.push("- **Observed Evidence**:");
        for (const ev of f.evidence) {
          if (ev.observed) {
            lines.push("```");
            lines.push(ev.observed.trim());
            lines.push("```");
          }
        }
      }

      if (f.recommendations && f.recommendations.length > 0) {
        lines.push("- **Recommended Action**:");
        for (const rec of f.recommendations) {
          if (rec.commandOrAction) {
            lines.push("```bash");
            lines.push(rec.commandOrAction);
            lines.push("```");
          }
        }
      }
      lines.push("");
    }

    lines.push("</details>");
    lines.push("");
  }

  lines.push(
    `<sub>Generated by StackDoctor v${report.toolVersion} (100% offline). Run \`stackdoctor scan\` locally to inspect.</sub>`
  );

  let output = lines.join("\n");

  // Project-relative path sanitization
  if (options.projectPath) {
    const normProj = options.projectPath.replace(/[/\\]+$/, "");
    const winProj = normProj.replace(/\//g, "\\");
    const unixProj = normProj.replace(/\\/g, "/");
    const escWin = winProj.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escUnix = unixProj.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(new RegExp(escWin, "gi"), "<project>");
    output = output.replace(new RegExp(escUnix, "gi"), "<project>");
  }

  // Windows & Unix home path sanitization
  output = output.replace(/[a-zA-Z]:[/\\](?:Users|Documents and Settings)[/\\][^/\\\s"':`]+/gi, "~");
  output = output.replace(/\/(?:Users|home)\/[^/\\\s"':`]+/gi, "~");

  // Redact secrets
  output = redactText(output);

  return output;
}

export function formatComparisonTerminal(
  comparison: ReportComparison,
  options: FormatOptions = {}
): string {
  const useColor = !options.noColor && !process.env.NO_COLOR;

  const c = {
    bold: (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
    dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
    green: (s: string) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
    yellow: (s: string) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
    red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
    cyan: (s: string) => (useColor ? `\x1b[36m${s}\x1b[0m` : s)
  };

  const lines: string[] = [];
  lines.push(c.bold("=== StackDoctor Diagnostic Report Comparison ==="));
  lines.push(`Base: ${comparison.baseProject} (${comparison.baseTimestamp})`);
  lines.push(`Head: ${comparison.headProject} (${comparison.headTimestamp})`);
  lines.push("");

  const formatDelta = (num: number) => (num > 0 ? `+${num}` : `${num}`);

  lines.push(c.bold("--- Summary Delta ---"));
  lines.push(
    `  Findings: ${formatDelta(comparison.summaryDelta.findingsDelta)} (New: ${comparison.newFindings.length}, Resolved: ${comparison.resolvedFindings.length}, Changed: ${comparison.changedFindings.length})`
  );
  lines.push(
    c.dim(
      `  Severity Changes: Critical: ${formatDelta(comparison.summaryDelta.severityDeltas.critical)}, High: ${formatDelta(comparison.summaryDelta.severityDeltas.high)}, Medium: ${formatDelta(comparison.summaryDelta.severityDeltas.medium)}, Low: ${formatDelta(comparison.summaryDelta.severityDeltas.low)}, Info: ${formatDelta(comparison.summaryDelta.severityDeltas.info)}`
    )
  );
  lines.push("");

  lines.push(c.bold(`--- New Findings (${comparison.newFindings.length}) ---`));
  if (comparison.newFindings.length === 0) {
    lines.push(c.dim("  None."));
  } else {
    for (const f of comparison.newFindings) {
      lines.push(`  ${c.red(`[+NEW ${f.severity.toUpperCase()}]`)} ${c.bold(f.ruleId)}: ${f.title}`);
    }
  }
  lines.push("");

  lines.push(c.bold(`--- Resolved Findings (${comparison.resolvedFindings.length}) ---`));
  if (comparison.resolvedFindings.length === 0) {
    lines.push(c.dim("  None."));
  } else {
    for (const f of comparison.resolvedFindings) {
      lines.push(`  ${c.green(`[-RESOLVED ${f.severity.toUpperCase()}]`)} ${c.bold(f.ruleId)}: ${f.title}`);
    }
  }
  lines.push("");

  lines.push(c.bold(`--- Changed Findings (${comparison.changedFindings.length}) ---`));
  if (comparison.changedFindings.length === 0) {
    lines.push(c.dim("  None."));
  } else {
    for (const cf of comparison.changedFindings) {
      const details: string[] = [];
      if (cf.changes.severity) {
        details.push(`severity: ${cf.changes.severity.before.toUpperCase()} -> ${cf.changes.severity.after.toUpperCase()}`);
      }
      if (cf.changes.confidence) {
        details.push(`confidence: ${cf.changes.confidence.before} -> ${cf.changes.confidence.after}`);
      }
      if (cf.changes.status) {
        details.push(`status: ${cf.changes.status.before} -> ${cf.changes.status.after}`);
      }
      lines.push(`  ${c.yellow("[~CHANGED]")} ${c.bold(cf.finding.ruleId)}: ${cf.finding.title} (${details.join(", ")})`);
    }
  }
  lines.push("");

  const env = comparison.environmentChanges;
  const tech = comparison.technologyChanges;
  const hasEnvChanges =
    env.operatingSystem ||
    env.toolVersion ||
    env.runtimeVersions.length > 0 ||
    tech.added.length > 0 ||
    tech.removed.length > 0;

  if (hasEnvChanges) {
    lines.push(c.bold("--- Environment & Technology Changes ---"));
    if (env.operatingSystem) {
      lines.push(`  OS: ${env.operatingSystem.before} -> ${env.operatingSystem.after}`);
    }
    if (env.toolVersion) {
      lines.push(`  StackDoctor Version: ${env.toolVersion.before} -> ${env.toolVersion.after}`);
    }
    for (const rt of env.runtimeVersions) {
      lines.push(`  Runtime ${rt.runtime}: ${rt.before ?? "(none)"} -> ${rt.after ?? "(none)"}`);
    }
    for (const t of tech.added) {
      lines.push(`  ${c.green("[+TECH]")} ${t.name}`);
    }
    for (const t of tech.removed) {
      lines.push(`  ${c.yellow("[-TECH]")} ${t.name}`);
    }
    lines.push("");
  }

  return redactText(lines.join("\n"));
}

export function formatComparisonMarkdown(comparison: ReportComparison): string {
  const formatDelta = (num: number) => (num > 0 ? `+${num}` : `${num}`);

  const lines: string[] = [];
  lines.push("# 🩺 StackDoctor Report Comparison");
  lines.push("");
  lines.push("| Run | Project | Timestamp |");
  lines.push("|---|---|---|");
  lines.push(`| **Base** | ${comparison.baseProject} | ${comparison.baseTimestamp} |`);
  lines.push(`| **Head** | ${comparison.headProject} | ${comparison.headTimestamp} |`);
  lines.push("");

  lines.push("### Summary Delta");
  lines.push(
    `- **Total Findings Delta**: ${formatDelta(comparison.summaryDelta.findingsDelta)}`
  );
  lines.push(
    `- **New Findings**: ${comparison.newFindings.length} | **Resolved**: ${comparison.resolvedFindings.length} | **Changed**: ${comparison.changedFindings.length} | **Unchanged**: ${comparison.unchangedFindings.length}`
  );
  lines.push(
    `- **Severity Deltas**: Critical: \`${formatDelta(comparison.summaryDelta.severityDeltas.critical)}\`, High: \`${formatDelta(comparison.summaryDelta.severityDeltas.high)}\`, Medium: \`${formatDelta(comparison.summaryDelta.severityDeltas.medium)}\`, Low: \`${formatDelta(comparison.summaryDelta.severityDeltas.low)}\`, Info: \`${formatDelta(comparison.summaryDelta.severityDeltas.info)}\``
  );
  lines.push("");

  if (comparison.newFindings.length > 0) {
    lines.push("### 🚨 New Findings");
    lines.push("| Severity | Rule ID | Title |");
    lines.push("|---|---|---|");
    for (const f of comparison.newFindings) {
      lines.push(`| **${f.severity.toUpperCase()}** | \`${f.ruleId}\` | ${f.title} |`);
    }
    lines.push("");
  }

  if (comparison.resolvedFindings.length > 0) {
    lines.push("### ✅ Resolved Findings");
    lines.push("| Severity | Rule ID | Title |");
    lines.push("|---|---|---|");
    for (const f of comparison.resolvedFindings) {
      lines.push(`| **${f.severity.toUpperCase()}** | \`${f.ruleId}\` | ${f.title} |`);
    }
    lines.push("");
  }

  if (comparison.changedFindings.length > 0) {
    lines.push("### ⚠️ Changed Findings");
    lines.push("| Rule ID | Title | Changes |");
    lines.push("|---|---|---|");
    for (const cf of comparison.changedFindings) {
      const details: string[] = [];
      if (cf.changes.severity) {
        details.push(`Severity: ${cf.changes.severity.before.toUpperCase()} -> ${cf.changes.severity.after.toUpperCase()}`);
      }
      if (cf.changes.confidence) {
        details.push(`Confidence: ${cf.changes.confidence.before} -> ${cf.changes.confidence.after}`);
      }
      if (cf.changes.status) {
        details.push(`Status: ${cf.changes.status.before} -> ${cf.changes.status.after}`);
      }
      lines.push(`| \`${cf.finding.ruleId}\` | ${cf.finding.title} | ${details.join(", ")} |`);
    }
    lines.push("");
  }

  const env = comparison.environmentChanges;
  const tech = comparison.technologyChanges;
  const hasEnvChanges =
    env.operatingSystem ||
    env.toolVersion ||
    env.runtimeVersions.length > 0 ||
    tech.added.length > 0 ||
    tech.removed.length > 0;

  if (hasEnvChanges) {
    lines.push("### 🌐 Environment & Technology Changes");
    if (env.operatingSystem) {
      lines.push(`- **OS**: \`${env.operatingSystem.before}\` -> \`${env.operatingSystem.after}\``);
    }
    if (env.toolVersion) {
      lines.push(`- **Tool Version**: \`${env.toolVersion.before}\` -> \`${env.toolVersion.after}\``);
    }
    for (const rt of env.runtimeVersions) {
      lines.push(`- **Runtime ${rt.runtime}**: \`${rt.before ?? "(none)"}\` -> \`${rt.after ?? "(none)"}\``);
    }
    for (const t of tech.added) {
      lines.push(`- **Added Technology**: \`${t.name}\``);
    }
    for (const t of tech.removed) {
      lines.push(`- **Removed Technology**: \`${t.name}\``);
    }
    lines.push("");
  }

  lines.push("<sub>Generated by StackDoctor (100% offline). Run `stackdoctor compare <base.json> <head.json>` to inspect diffs locally.</sub>");

  let output = lines.join("\n");
  output = redactText(output);
  return output;
}


