import { describe, it, expect } from "vitest";
import {
  ReportSchema,
  validateReport,
  FindingSchema,
  EvidenceSchema,
  SeveritySchema,
  MAX_EVIDENCE_OBSERVED_LENGTH,
  type Report,
  type Finding,
  type Evidence
} from "@stackdoctor/schemas";

describe("Report and Schemas validation", () => {
  const validEvidence: Evidence = {
    id: "ev-node-1",
    kind: "runtime_version",
    description: "Detected node version from command line",
    observed: "v20.10.0",
    source: "node -v",
    collectedAt: new Date().toISOString()
  };

  const validFinding: Finding = {
    ruleId: "NODE_VERSION_MISMATCH",
    title: "Node.js version mismatch",
    category: "runtime",
    severity: "high",
    confidence: "confirmed",
    status: "failed",
    evidence: [validEvidence],
    possibleCauses: [
      "Current active Node version is v20.10.0 while engines requires >=22.0.0",
      "nvm or volta active version is overriding local repo configuration"
    ],
    recommendations: [
      {
        problem: "Incompatible node runtime",
        relevance: "Engines requires node >=22.0.0",
        commandOrAction: "nvm use 22",
        expectedResult: "Active node version becomes v22.x",
        risks: "None; switches node environment",
        undo: "nvm use 20",
        verification: "node -v"
      }
    ],
    verificationStatus: "unverified",
    docs: ["https://nodejs.org/"]
  };

  const validReport: Report = {
    schemaVersion: "1.0.0",
    toolVersion: "0.1.0",
    operatingSystem: "win32",
    startedAt: new Date(Date.now() - 5000).toISOString(),
    completedAt: new Date().toISOString(),
    status: "completed",
    projectName: "sample-app",
    technologies: [
      {
        name: "nodejs",
        confidence: "confirmed",
        evidence: [validEvidence]
      }
    ],
    checks: [
      {
        id: "check-node-version",
        title: "Check Node version",
        category: "runtime",
        status: "passed",
        durationMs: 42,
        evidence: [validEvidence]
      }
    ],
    findings: [validFinding],
    summary: {
      totalChecks: 1,
      totalFindings: 1,
      bySeverity: {
        info: 0,
        low: 0,
        medium: 0,
        high: 1,
        critical: 0
      },
      byStatus: {
        passed: 1,
        warning: 0,
        failed: 0,
        skipped: 0,
        error: 0
      }
    }
  };

  it("passes validation for a valid report", () => {
    const parsed = ReportSchema.parse(validReport);
    expect(parsed.projectName).toBe("sample-app");

    const validated = validateReport(validReport);
    expect(validated.success).toBe(true);
    if (validated.success) {
      expect(validated.data.status).toBe("completed");
    }
  });

  it("fails when required fields are missing", () => {
    const invalidReport = { ...validReport } as Partial<Report>;
    delete invalidReport.projectName;
    delete invalidReport.startedAt;

    const result = validateReport(invalidReport);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("projectName"))).toBe(true);
      expect(result.errors.some((e) => e.includes("startedAt"))).toBe(true);
    }
  });

  it("fails when evidence exceeds max length limit", () => {
    const oversizeObserved = "x".repeat(MAX_EVIDENCE_OBSERVED_LENGTH + 1);
    const invalidEvidence = {
      ...validEvidence,
      observed: oversizeObserved
    };

    const parseResult = EvidenceSchema.safeParse(invalidEvidence);
    expect(parseResult.success).toBe(false);
  });

  it("fails when an unknown severity is supplied", () => {
    const invalidSeverity = "extreme";
    const parseResult = SeveritySchema.safeParse(invalidSeverity);
    expect(parseResult.success).toBe(false);

    const invalidFinding = {
      ...validFinding,
      severity: invalidSeverity as unknown as Severity
    };
    const findingResult = FindingSchema.safeParse(invalidFinding);
    expect(findingResult.success).toBe(false);
  });

  it("strictly separates evidence and possibleCauses fields", () => {
    // Evidence contains facts (objects with id, kind, observed, source, collectedAt)
    // possibleCauses contains strings representing hypotheses
    const finding = validFinding;
    expect(Array.isArray(finding.evidence)).toBe(true);
    expect(Array.isArray(finding.possibleCauses)).toBe(true);

    // Each evidence item must have observed fact structure
    expect(typeof finding.evidence[0]?.observed).toBe("string");
    expect(typeof finding.evidence[0]?.source).toBe("string");

    // possibleCauses must be plain strings (hypotheses)
    expect(typeof finding.possibleCauses[0]).toBe("string");

    // If evidence is erroneously placed into possibleCauses, parsing must reject it
    const swappedFinding = {
      ...validFinding,
      possibleCauses: [validEvidence as unknown as string]
    };
    const result = FindingSchema.safeParse(swappedFinding);
    expect(result.success).toBe(false);
  });
});
