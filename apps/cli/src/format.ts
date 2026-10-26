import type { Report } from "@stackdoctor/schemas";

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

  return lines.join("\n");
}
