import { describe, it, expect } from "vitest";
import { compareReports, extractFindingSubjectKey } from "@stackdoctor/core";
import type { Report, Finding } from "@stackdoctor/schemas";

function createReport(overrides: Partial<Report> = {}): Report {
  return {
    schemaVersion: "1.0.0",
    toolVersion: "0.1.0",
    operatingSystem: "linux",
    startedAt: "2026-10-26T12:00:00.000Z",
    completedAt: "2026-10-26T12:00:02.000Z",
    status: "completed",
    projectName: "payment-service",
    technologies: [
      { name: "Node.js", confidence: "confirmed", evidence: [] }
    ],
    checks: [
      {
        id: "check_node_deps",
        title: "Check Node Dependencies",
        category: "runtime",
        status: "passed",
        durationMs: 10,
        evidence: []
      }
    ],
    findings: [],
    summary: {
      totalChecks: 1,
      totalFindings: 0,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      byStatus: { passed: 1, warning: 0, failed: 0, skipped: 0, error: 0 }
    },
    ...overrides
  };
}

function createFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: "NODE_DEPS_NOT_INSTALLED",
    title: "Node modules missing",
    category: "dependencies",
    severity: "high",
    confidence: "confirmed",
    status: "failed",
    evidence: [
      {
        id: "ev1",
        kind: "filesystem",
        description: "node_modules is missing",
        observed: "node_modules directory does not exist",
        source: "package.json",
        collectedAt: "2026-10-26T12:00:01.000Z"
      }
    ],
    possibleCauses: ["Run npm install"],
    recommendations: [],
    verificationStatus: "unverified",
    docs: [],
    ...overrides
  };
}

describe("Core Report Comparison (compareReports)", () => {
  it("comparing a report with itself gives an empty diff and zero summary deltas", () => {
    const finding = createFinding();
    const report = createReport({
      findings: [finding],
      summary: {
        totalChecks: 1,
        totalFindings: 1,
        bySeverity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
        byStatus: { passed: 0, warning: 0, failed: 1, skipped: 0, error: 0 }
      }
    });

    const diff = compareReports(report, report);

    expect(diff.newFindings).toHaveLength(0);
    expect(diff.resolvedFindings).toHaveLength(0);
    expect(diff.changedFindings).toHaveLength(0);
    expect(diff.unchangedFindings).toHaveLength(1);
    expect(diff.hasRegressions).toBe(false);
    expect(diff.summaryDelta.checksDelta).toBe(0);
    expect(diff.summaryDelta.findingsDelta).toBe(0);
    expect(diff.summaryDelta.severityDeltas.high).toBe(0);
    expect(diff.technologyChanges.added).toHaveLength(0);
    expect(diff.technologyChanges.removed).toHaveLength(0);
    expect(diff.technologyChanges.unchanged).toHaveLength(1);
  });

  it("identifies new findings, resolved findings, and unchanged findings", () => {
    const baseFinding = createFinding({
      ruleId: "ENV_EXAMPLE_NO_ENV",
      title: "Missing .env",
      severity: "medium",
      evidence: [
        {
          id: "ev_env",
          kind: "file",
          description: ".env missing",
          observed: ".env file missing",
          source: ".env.example",
          collectedAt: "2026-10-26T12:00:00.000Z"
        }
      ]
    });

    const headFinding = createFinding({
      ruleId: "PORT_IN_USE",
      title: "Port in use",
      severity: "high",
      evidence: [
        {
          id: "ev_port",
          kind: "network",
          description: "Port 3000 busy",
          observed: "port: 3000 is occupied",
          source: "probe",
          collectedAt: "2026-10-26T12:05:00.000Z"
        }
      ]
    });

    const commonFinding = createFinding({
      ruleId: "NODE_DEPS_NOT_INSTALLED",
      title: "Node modules missing"
    });

    const baseReport = createReport({
      findings: [baseFinding, commonFinding],
      summary: {
        totalChecks: 2,
        totalFindings: 2,
        bySeverity: { critical: 0, high: 1, medium: 1, low: 0, info: 0 },
        byStatus: { passed: 0, warning: 0, failed: 2, skipped: 0, error: 0 }
      }
    });

    const headReport = createReport({
      findings: [headFinding, commonFinding],
      summary: {
        totalChecks: 3,
        totalFindings: 2,
        bySeverity: { critical: 0, high: 2, medium: 0, low: 0, info: 0 },
        byStatus: { passed: 1, warning: 0, failed: 2, skipped: 0, error: 0 }
      }
    });

    const diff = compareReports(baseReport, headReport);

    expect(diff.newFindings).toHaveLength(1);
    expect(diff.newFindings[0].ruleId).toBe("PORT_IN_USE");

    expect(diff.resolvedFindings).toHaveLength(1);
    expect(diff.resolvedFindings[0].ruleId).toBe("ENV_EXAMPLE_NO_ENV");

    expect(diff.unchangedFindings).toHaveLength(1);
    expect(diff.unchangedFindings[0].ruleId).toBe("NODE_DEPS_NOT_INSTALLED");

    expect(diff.changedFindings).toHaveLength(0);
    expect(diff.hasRegressions).toBe(true); // new finding is high severity
    expect(diff.summaryDelta.checksDelta).toBe(1);
    expect(diff.summaryDelta.findingsDelta).toBe(0);
    expect(diff.summaryDelta.severityDeltas.high).toBe(1);
    expect(diff.summaryDelta.severityDeltas.medium).toBe(-1);
  });

  it("detects changed findings when severity, confidence, or status changes", () => {
    const baseFinding = createFinding({
      ruleId: "MONGO_CONNECTION_REFUSED",
      title: "MongoDB connection refused",
      severity: "medium",
      confidence: "likely",
      status: "warning",
      evidence: [
        {
          id: "ev_mongo",
          kind: "network",
          description: "Mongo port 27017 refused",
          observed: "port: 27017 refused",
          source: "mongo",
          collectedAt: "2026-10-26T12:00:00.000Z"
        }
      ]
    });

    const headFinding = createFinding({
      ruleId: "MONGO_CONNECTION_REFUSED",
      title: "MongoDB connection refused",
      severity: "critical", // Escalate severity
      confidence: "confirmed", // Escalate confidence
      status: "failed", // Status change
      evidence: [
        {
          id: "ev_mongo",
          kind: "network",
          description: "Mongo port 27017 refused",
          observed: "port: 27017 refused",
          source: "mongo",
          collectedAt: "2026-10-26T12:05:00.000Z"
        }
      ]
    });

    const baseReport = createReport({ findings: [baseFinding] });
    const headReport = createReport({ findings: [headFinding] });

    const diff = compareReports(baseReport, headReport);

    expect(diff.changedFindings).toHaveLength(1);
    const changed = diff.changedFindings[0];
    expect(changed.changes.severity).toEqual({ before: "medium", after: "critical" });
    expect(changed.changes.confidence).toEqual({ before: "likely", after: "confirmed" });
    expect(changed.changes.status).toEqual({ before: "warning", after: "failed" });
    expect(diff.hasRegressions).toBe(true);
  });

  it("differentiates multiple findings of the same ruleId with different subjects", () => {
    const port3000 = createFinding({
      ruleId: "PORT_IN_USE",
      evidence: [
        {
          id: "ev1",
          kind: "network",
          description: "Port check",
          observed: "port: 3000 in use",
          source: "probe",
          collectedAt: "2026-10-26T12:00:00.000Z"
        }
      ]
    });

    const port8080 = createFinding({
      ruleId: "PORT_IN_USE",
      evidence: [
        {
          id: "ev2",
          kind: "network",
          description: "Port check",
          observed: "port: 8080 in use",
          source: "probe",
          collectedAt: "2026-10-26T12:00:00.000Z"
        }
      ]
    });

    expect(extractFindingSubjectKey(port3000)).toBe("port_3000");
    expect(extractFindingSubjectKey(port8080)).toBe("port_8080");

    const baseReport = createReport({ findings: [port3000] });
    const headReport = createReport({ findings: [port8080] });

    const diff = compareReports(baseReport, headReport);
    expect(diff.newFindings).toHaveLength(1);
    expect(extractFindingSubjectKey(diff.newFindings[0])).toBe("port_8080");
    expect(diff.resolvedFindings).toHaveLength(1);
    expect(extractFindingSubjectKey(diff.resolvedFindings[0])).toBe("port_3000");
  });

  it("detects environment changes in operating system, tool version, and runtimes", () => {
    const baseReport = createReport({
      operatingSystem: "darwin",
      toolVersion: "0.1.0",
      checks: [
        {
          id: "check_node_version",
          title: "Node.js Version Check",
          category: "runtime",
          status: "passed",
          evidence: [
            {
              id: "ev_v",
              kind: "runtime",
              description: "node version",
              observed: "v18.16.0",
              source: "node",
              collectedAt: "2026-10-26T12:00:00.000Z"
            }
          ]
        }
      ]
    });

    const headReport = createReport({
      operatingSystem: "linux",
      toolVersion: "0.2.0",
      checks: [
        {
          id: "check_node_version",
          title: "Node.js Version Check",
          category: "runtime",
          status: "passed",
          evidence: [
            {
              id: "ev_v",
              kind: "runtime",
              description: "node version",
              observed: "v20.11.0",
              source: "node",
              collectedAt: "2026-10-26T12:05:00.000Z"
            }
          ]
        }
      ]
    });

    const diff = compareReports(baseReport, headReport);

    expect(diff.environmentChanges.operatingSystem).toEqual({
      before: "darwin",
      after: "linux"
    });
    expect(diff.environmentChanges.toolVersion).toEqual({
      before: "0.1.0",
      after: "0.2.0"
    });
    expect(diff.environmentChanges.runtimeVersions).toContainEqual({
      runtime: "Node.js Version Check",
      before: "v18.16.0",
      after: "v20.11.0"
    });
  });
});
