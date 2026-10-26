import {
  type Report,
  type Finding,
  type Severity,
  type Confidence,
  type CheckStatus,
  type TechnologyDetection
} from "@stackdoctor/schemas";
import { sortFindingsDeterministically } from "./runner.js";

export interface ChangedFinding {
  finding: Finding;
  previousFinding: Finding;
  changes: {
    severity?: { before: Severity; after: Severity };
    confidence?: { before: Confidence; after: Confidence };
    status?: { before: CheckStatus; after: CheckStatus };
  };
}

export interface EnvironmentChanges {
  operatingSystem?: { before: string; after: string };
  toolVersion?: { before: string; after: string };
  runtimeVersions: Array<{
    runtime: string;
    before?: string;
    after?: string;
  }>;
}

export interface TechnologyChanges {
  added: TechnologyDetection[];
  removed: TechnologyDetection[];
  unchanged: TechnologyDetection[];
}

export interface SummaryDelta {
  checksDelta: number;
  findingsDelta: number;
  severityDeltas: Record<Severity, number>;
}

export interface ReportComparison {
  baseProject: string;
  headProject: string;
  baseTimestamp: string;
  headTimestamp: string;
  newFindings: Finding[];
  resolvedFindings: Finding[];
  unchangedFindings: Finding[];
  changedFindings: ChangedFinding[];
  environmentChanges: EnvironmentChanges;
  technologyChanges: TechnologyChanges;
  summaryDelta: SummaryDelta;
  hasRegressions: boolean;
}

const SEVERITY_LEVELS: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

/**
 * Extracts a stable subject identifier from finding evidence (e.g. port, service, path, package).
 * Combined with ruleId, this forms the unique identity of a finding across diagnostic runs:
 * `findingId = "${ruleId}::${subjectKey}"`
 */
export function extractFindingSubjectKey(finding: Finding): string {
  if (finding.evidence && finding.evidence.length > 0) {
    for (const ev of finding.evidence) {
      // 1. Port numbers (e.g. port: 3000, 127.0.0.1:5432, :8080)
      const portMatch = ev.observed?.match(/(?:port\s*[:=]?\s*|\b(?:localhost|127\.0\.0\.1):)(\d{2,5})\b/i);
      if (portMatch) {
        return `port_${portMatch[1]}`;
      }

      // 2. Service name in docker/compose (e.g. service "redis", service: db)
      const serviceMatch = ev.observed?.match(/service\s*["']?([a-zA-Z0-9_-]+)["']?/i);
      if (serviceMatch) {
        return `service_${serviceMatch[1].toLowerCase()}`;
      }

      // 3. Environment variable name (e.g. missing VAR_NAME)
      const envVarMatch = ev.description?.match(/\b([A-Z0-9_]{3,})\b/);
      if (envVarMatch) {
        return `env_${envVarMatch[1]}`;
      }

      // 4. Source file path basename
      if (ev.source && ev.source !== "probe" && ev.source !== "diagnostic") {
        const cleanSource = ev.source.replace(/\\/g, "/").split("/").pop();
        if (cleanSource) {
          return `source_${cleanSource.toLowerCase()}`;
        }
      }
    }
  }

  // Fallback to sanitized finding title
  return finding.title ? finding.title.toLowerCase().replace(/[^a-z0-9_-]+/g, "_") : "default";
}

/**
 * Extracts runtime versions from technologies and checks.
 */
function extractRuntimeMap(report: Report): Map<string, string> {
  const map = new Map<string, string>();

  if (report.technologies) {
    for (const tech of report.technologies) {
      for (const ev of tech.evidence || []) {
        if (ev.observed && /version|v\d+\.\d+/i.test(ev.observed)) {
          map.set(tech.name, ev.observed.trim());
        }
      }
    }
  }

  if (report.checks) {
    for (const chk of report.checks) {
      if (chk.id?.includes("version") || chk.title?.toLowerCase().includes("version")) {
        for (const ev of chk.evidence || []) {
          if (ev.observed) {
            const name = chk.title || chk.id;
            map.set(name, ev.observed.trim());
          }
        }
      }
    }
  }

  return map;
}

/**
 * Pure, deterministic comparison of two StackDoctor diagnostic reports.
 * Never executes code; purely evaluates differences in checks, findings, and environment.
 */
export function compareReports(base: Report, head: Report): ReportComparison {
  const baseFindings = base.findings || [];
  const headFindings = head.findings || [];

  // 1. Build finding lookup maps by unique identity: ruleId + subjectKey
  const baseMap = new Map<string, Finding>();
  for (const f of baseFindings) {
    const key = `${f.ruleId}::${extractFindingSubjectKey(f)}`;
    baseMap.set(key, f);
  }

  const headMap = new Map<string, Finding>();
  for (const f of headFindings) {
    const key = `${f.ruleId}::${extractFindingSubjectKey(f)}`;
    headMap.set(key, f);
  }

  const newFindings: Finding[] = [];
  const resolvedFindings: Finding[] = [];
  const unchangedFindings: Finding[] = [];
  const changedFindings: ChangedFinding[] = [];
  const matchedBaseKeys = new Set<string>();

  // 2. Identify New, Changed, and Unchanged findings
  for (const [key, headFinding] of headMap.entries()) {
    if (!baseMap.has(key)) {
      newFindings.push(headFinding);
    } else {
      matchedBaseKeys.add(key);
      const baseFinding = baseMap.get(key)!;

      const severityChanged = headFinding.severity !== baseFinding.severity;
      const confidenceChanged = headFinding.confidence !== baseFinding.confidence;
      const statusChanged = headFinding.status !== baseFinding.status;

      if (severityChanged || confidenceChanged || statusChanged) {
        const changes: ChangedFinding["changes"] = {};
        if (severityChanged) {
          changes.severity = { before: baseFinding.severity, after: headFinding.severity };
        }
        if (confidenceChanged) {
          changes.confidence = { before: baseFinding.confidence, after: headFinding.confidence };
        }
        if (statusChanged) {
          changes.status = { before: baseFinding.status, after: headFinding.status };
        }

        changedFindings.push({
          finding: headFinding,
          previousFinding: baseFinding,
          changes
        });
      } else {
        unchangedFindings.push(headFinding);
      }
    }
  }

  // 3. Identify Resolved findings
  for (const [key, baseFinding] of baseMap.entries()) {
    if (!matchedBaseKeys.has(key)) {
      resolvedFindings.push(baseFinding);
    }
  }

  // Sort finding lists deterministically
  const sortedNew = sortFindingsDeterministically(newFindings);
  const sortedResolved = sortFindingsDeterministically(resolvedFindings);
  const sortedUnchanged = sortFindingsDeterministically(unchangedFindings);
  const sortedChanged = [...changedFindings].sort((a, b) => {
    const sevDiff = (SEVERITY_LEVELS[b.finding.severity] ?? 0) - (SEVERITY_LEVELS[a.finding.severity] ?? 0);
    if (sevDiff !== 0) return sevDiff;
    return a.finding.ruleId.localeCompare(b.finding.ruleId);
  });

  // 4. Environment Changes
  const environmentChanges: EnvironmentChanges = {
    runtimeVersions: []
  };

  if (base.operatingSystem !== head.operatingSystem) {
    environmentChanges.operatingSystem = {
      before: base.operatingSystem,
      after: head.operatingSystem
    };
  }

  if (base.toolVersion !== head.toolVersion) {
    environmentChanges.toolVersion = {
      before: base.toolVersion,
      after: head.toolVersion
    };
  }

  const baseRuntimes = extractRuntimeMap(base);
  const headRuntimes = extractRuntimeMap(head);
  const allRuntimeKeys = new Set([...baseRuntimes.keys(), ...headRuntimes.keys()]);

  for (const runtime of allRuntimeKeys) {
    const before = baseRuntimes.get(runtime);
    const after = headRuntimes.get(runtime);
    if (before !== after) {
      environmentChanges.runtimeVersions.push({
        runtime,
        before,
        after
      });
    }
  }

  // 5. Technology Changes
  const baseTechNames = new Set((base.technologies || []).map((t) => t.name));
  const headTechNames = new Set((head.technologies || []).map((t) => t.name));

  const addedTech = (head.technologies || []).filter((t) => !baseTechNames.has(t.name));
  const removedTech = (base.technologies || []).filter((t) => !headTechNames.has(t.name));
  const unchangedTech = (head.technologies || []).filter((t) => baseTechNames.has(t.name));

  // 6. Summary Delta
  const baseCounts = base.summary?.bySeverity || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const headCounts = head.summary?.bySeverity || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  const severityDeltas: Record<Severity, number> = {
    critical: (headCounts.critical || 0) - (baseCounts.critical || 0),
    high: (headCounts.high || 0) - (baseCounts.high || 0),
    medium: (headCounts.medium || 0) - (baseCounts.medium || 0),
    low: (headCounts.low || 0) - (baseCounts.low || 0),
    info: (headCounts.info || 0) - (baseCounts.info || 0)
  };

  const summaryDelta: SummaryDelta = {
    checksDelta: (head.summary?.totalChecks ?? head.checks?.length ?? 0) - (base.summary?.totalChecks ?? base.checks?.length ?? 0),
    findingsDelta: (head.summary?.totalFindings ?? headFindings.length) - (base.summary?.totalFindings ?? baseFindings.length),
    severityDeltas
  };

  // 7. Check for regressions
  const hasRegressions =
    sortedNew.length > 0 ||
    sortedChanged.some(
      (c) => (SEVERITY_LEVELS[c.finding.severity] ?? 0) > (SEVERITY_LEVELS[c.previousFinding.severity] ?? 0)
    );

  return {
    baseProject: base.projectName || "base",
    headProject: head.projectName || "head",
    baseTimestamp: base.completedAt || base.startedAt || "",
    headTimestamp: head.completedAt || head.startedAt || "",
    newFindings: sortedNew,
    resolvedFindings: sortedResolved,
    unchangedFindings: sortedUnchanged,
    changedFindings: sortedChanged,
    environmentChanges,
    technologyChanges: {
      added: addedTech,
      removed: removedTech,
      unchanged: unchangedTech
    },
    summaryDelta,
    hasRegressions
  };
}
