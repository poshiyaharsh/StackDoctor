import process from "node:process";
import {
  type Report,
  type Finding,
  type CheckResult,
  type Evidence,
  type CheckStatus,
  type Severity,
  type Confidence,
  type TechnologyDetection,
  type ReportStatus,
  CURRENT_SCHEMA_VERSION,
  CURRENT_TOOL_VERSION,
  validateReport
} from "@stackdoctor/schemas";
import { scanProject, type ScanResult } from "./scanner.js";
import { redactText } from "./redact.js";
import { type Logger, SafeLogger } from "./logger.js";

export interface DiagnosticContext {
  dir: string;
  scanResult: ScanResult;
  technologies: TechnologyDetection[];
  signal?: AbortSignal;
}

export interface DiagnosticCheck {
  id: string;
  title: string;
  category: string;
  timeoutMs?: number;
  execute: (ctx: DiagnosticContext) => Promise<{
    status: CheckStatus;
    evidence: Evidence[];
    error?: string;
  }>;
}

export interface DiagnosticRule {
  id: string;
  title: string;
  category?: string;
  description: string;
  technologies: string[];
  severity: Severity;
  confidence: Confidence;
  docs: string[];
  preconditions?: (ctx: DiagnosticContext) => boolean;
  checks?: DiagnosticCheck[];
  evaluate?: (ctx: DiagnosticContext, checkResults: CheckResult[]) => Finding | null;
}

export interface RunnerOptions {
  dir: string;
  rules?: DiagnosticRule[];
  checks?: DiagnosticCheck[];
  signal?: AbortSignal;
  defaultTimeoutMs?: number;
  logger?: Logger;
}

/**
 * Runs a single diagnostic check with strict timeout, cancellation, and error safety.
 * Never throws; returns a CheckResult with status "error" on failure.
 */
async function executeCheckSafely(
  check: DiagnosticCheck,
  ctx: DiagnosticContext,
  timeoutMs: number,
  logger: Logger
): Promise<CheckResult> {
  const startTime = Date.now();

  if (ctx.signal?.aborted) {
    return {
      id: check.id,
      title: check.title,
      category: check.category,
      status: "skipped",
      durationMs: 0,
      evidence: [],
      error: "Run was cancelled before check started"
    };
  }

  logger.debug(`Executing check: ${check.id}`);

  try {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<{ status: CheckStatus; evidence: Evidence[]; error: string }>(
      (resolve) => {
        timer = setTimeout(() => {
          resolve({
            status: "error",
            evidence: [],
            error: `Check timed out after ${timeoutMs}ms`
          });
        }, timeoutMs);
      }
    );

    const checkPromise = (async () => {
      try {
        return await check.execute(ctx);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          status: "error" as CheckStatus,
          evidence: [],
          error: redactText(errorMsg)
        };
      }
    })();

    const result = await Promise.race([checkPromise, timeoutPromise]);
    if (timer) clearTimeout(timer);

    const durationMs = Date.now() - startTime;
    return {
      id: check.id,
      title: check.title,
      category: check.category,
      status: result.status,
      durationMs,
      evidence: result.evidence,
      error: result.error
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      id: check.id,
      title: check.title,
      category: check.category,
      status: "error",
      durationMs,
      evidence: [],
      error: redactText(errorMsg)
    };
  }
}

/**
 * Executes the diagnostic lifecycle runner.
 * Follows: validate dir -> apply ignore rules -> detect technologies ->
 * load applicable rules -> run checks with timeouts -> normalize -> match rules -> build report.
 */
export async function runDiagnostics(options: RunnerOptions): Promise<Report> {
  const startedAt = new Date().toISOString();
  const logger = options.logger ?? new SafeLogger("silent");
  const defaultTimeout = options.defaultTimeoutMs ?? 5_000;
  const rules = options.rules ?? [];
  const extraChecks = options.checks ?? [];

  logger.info(`Starting StackDoctor diagnostics for: ${options.dir}`);

  // Check initial cancellation
  if (options.signal?.aborted) {
    return buildReport({
      status: "cancelled",
      projectName: "unknown",
      operatingSystem: process.platform,
      startedAt,
      completedAt: new Date().toISOString(),
      technologies: [],
      checks: [],
      findings: []
    });
  }

  // 1. Scan project directory and detect technologies
  let scanResult: ScanResult;
  try {
    scanResult = await scanProject(options.dir);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`Project scan failed: ${errorMsg}`);
    const completedAt = new Date().toISOString();
    return buildReport({
      status: "failed",
      projectName: "unknown",
      operatingSystem: process.platform,
      startedAt,
      completedAt,
      technologies: [],
      checks: [
        {
          id: "project_scan",
          title: "Scan Project Directory",
          category: "scanner",
          status: "error",
          durationMs: 0,
          evidence: [],
          error: redactText(errorMsg)
        }
      ],
      findings: []
    });
  }

  const ctx: DiagnosticContext = {
    dir: scanResult.projectDir,
    scanResult,
    technologies: scanResult.technologies,
    signal: options.signal
  };

  // 2. Select applicable rules
  const detectedTechNames = new Set(scanResult.technologies.map((t) => t.name.toLowerCase()));
  const applicableRules: DiagnosticRule[] = [];

  for (const rule of rules) {
    // If rule specifies technologies, match at least one (or if wildcard "*")
    const matchesTech =
      rule.technologies.length === 0 ||
      rule.technologies.includes("*") ||
      rule.technologies.some((tech) => detectedTechNames.has(tech.toLowerCase()));

    if (!matchesTech) continue;

    // Check custom preconditions if provided
    if (rule.preconditions && !rule.preconditions(ctx)) {
      continue;
    }

    applicableRules.push(rule);
  }

  // 3. Collect checks to run
  const checksToRun: DiagnosticCheck[] = [...extraChecks];
  for (const rule of applicableRules) {
    if (rule.checks) {
      for (const chk of rule.checks) {
        // Prevent duplicate checks by ID
        if (!checksToRun.some((existing) => existing.id === chk.id)) {
          checksToRun.push(chk);
        }
      }
    }
  }

  // 4. Run checks sequentially or with cancellation checks
  const checkResults: CheckResult[] = [];
  let wasCancelled = false;

  for (const check of checksToRun) {
    if (options.signal?.aborted) {
      wasCancelled = true;
      checkResults.push({
        id: check.id,
        title: check.title,
        category: check.category,
        status: "skipped",
        durationMs: 0,
        evidence: [],
        error: "Run cancelled by user"
      });
      continue;
    }

    const checkTimeout = check.timeoutMs ?? defaultTimeout;
    const result = await executeCheckSafely(check, ctx, checkTimeout, logger);
    checkResults.push(result);
  }

  if (options.signal?.aborted) {
    wasCancelled = true;
  }

  // 5. Evaluate rules into findings
  const findings: Finding[] = [];
  for (const rule of applicableRules) {
    if (rule.evaluate) {
      try {
        const finding = rule.evaluate(ctx, checkResults);
        if (finding) {
          findings.push(finding);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(`Rule evaluation error in ${rule.id}: ${errorMsg}`);
      }
    }
  }

  // Deterministic ordering: severity (critical to info), then ruleId alphabetically
  const sortedFindings = sortFindingsDeterministically(findings);

  // 6. Build final report
  const completedAt = new Date().toISOString();
  let reportStatus: ReportStatus = "completed";
  if (wasCancelled) {
    reportStatus = "cancelled";
  } else if (
    checkResults.some((c) => c.status === "failed" || c.status === "error") ||
    sortedFindings.some((f) => f.severity === "high" || f.severity === "critical")
  ) {
    reportStatus = "completed_with_warnings";
  }

  const finalReport = buildReport({
    status: reportStatus,
    projectName: scanResult.projectName,
    operatingSystem: process.platform,
    startedAt,
    completedAt,
    technologies: scanResult.technologies,
    checks: checkResults,
    findings: sortedFindings
  });

  // Verify against schema
  const validation = validateReport(finalReport);
  if (!validation.success) {
    throw new Error(`Generated report failed schema validation: ${validation.errors.join("; ")}`);
  }

  return validation.data;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0
};

/**
 * Deterministically sorts findings by severity (critical to info) and then ruleId ascending.
 */
export function sortFindingsDeterministically(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0);
    if (sevDiff !== 0) return sevDiff;
    return a.ruleId.localeCompare(b.ruleId);
  });
}

/**
 * Assembles a valid Report object with summaries computed.
 */
function buildReport(data: {
  status: ReportStatus;
  projectName: string;
  operatingSystem: string;
  startedAt: string;
  completedAt: string;
  technologies: TechnologyDetection[];
  checks: CheckResult[];
  findings: Finding[];
}): Report {
  const bySeverity: Record<Severity, number> = {
    info: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };

  const byStatus: Record<CheckStatus, number> = {
    passed: 0,
    warning: 0,
    failed: 0,
    skipped: 0,
    error: 0
  };

  for (const finding of data.findings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
  }

  for (const check of data.checks) {
    byStatus[check.status] = (byStatus[check.status] || 0) + 1;
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    toolVersion: CURRENT_TOOL_VERSION,
    operatingSystem: data.operatingSystem,
    startedAt: data.startedAt,
    completedAt: data.completedAt,
    status: data.status,
    projectName: data.projectName,
    technologies: data.technologies,
    checks: data.checks,
    findings: data.findings,
    summary: {
      totalChecks: data.checks.length,
      totalFindings: data.findings.length,
      bySeverity,
      byStatus
    }
  };
}
