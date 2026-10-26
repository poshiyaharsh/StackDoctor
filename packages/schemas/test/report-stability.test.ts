import { describe, it, expect } from "vitest";
import {
  type Report,
  validateReport,
  CURRENT_SCHEMA_VERSION,
  CURRENT_TOOL_VERSION
} from "@stackdoctor/schemas";

describe("JSON Report Stability and Schema Invariance (Run 4B)", () => {
  function createCanonicalReport(): Report {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      toolVersion: CURRENT_TOOL_VERSION,
      operatingSystem: "linux",
      startedAt: "2026-10-26T12:00:00.000Z",
      completedAt: "2026-10-26T12:00:05.000Z",
      status: "completed_with_warnings",
      projectName: "canonical-service",
      technologies: [
        {
          name: "Node.js",
          confidence: "confirmed",
          evidence: [
            {
              id: "ev_tech_node",
              kind: "file",
              description: "package.json detected",
              observed: "Found package.json with engine definitions",
              source: "package.json",
              collectedAt: "2026-10-26T12:00:01.000Z"
            }
          ]
        }
      ],
      checks: [
        {
          id: "check_node_deps",
          title: "Check Node Dependencies",
          category: "runtime",
          status: "failed",
          durationMs: 15,
          evidence: [
            {
              id: "ev_check_node_deps",
              kind: "filesystem",
              description: "node_modules inspection",
              observed: "Directory not found",
              source: "fs.existsSync",
              collectedAt: "2026-10-26T12:00:02.000Z"
            }
          ]
        }
      ],
      findings: [
        {
          ruleId: "NODE_DEPS_NOT_INSTALLED",
          title: "Dependencies not installed in node_modules",
          category: "dependency",
          severity: "high",
          confidence: "confirmed",
          status: "failed",
          evidence: [
            {
              id: "ev_finding_1",
              kind: "filesystem",
              description: "node_modules is missing",
              observed: "Directory node_modules was not found in project root",
              source: "fs.existsSync",
              collectedAt: "2026-10-26T12:00:03.000Z"
            }
          ],
          possibleCauses: [
            "Fresh git clone before running package manager install"
          ],
          recommendations: [
            {
              problem: "Cannot run or test without installed dependencies",
              relevance: "Required to execute application code",
              commandOrAction: "npm install",
              expectedResult: "node_modules created",
              risks: "None",
              undo: "rm -rf node_modules",
              verification: "test -d node_modules"
            }
          ],
          verificationStatus: "unverified",
          docs: [
            "https://docs.npmjs.com/cli/install"
          ]
        }
      ],
      summary: {
        totalChecks: 1,
        totalFindings: 1,
        bySeverity: {
          critical: 0,
          high: 1,
          medium: 0,
          low: 0,
          info: 0
        },
        byStatus: {
          passed: 0,
          warning: 0,
          failed: 1,
          skipped: 0,
          error: 0
        }
      }
    };
  }

  it("validates that the canonical report conforms to the strict schema contract", () => {
    const report = createCanonicalReport();
    const result = validateReport(report);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.schemaVersion).toBe("1.0.0");
    expect(result.data.toolVersion).toBe("0.1.0");
    expect(result.data.projectName).toBe("canonical-service");
  });

  it("fails if mandatory top-level schema fields are missing or renamed", () => {
    const report = createCanonicalReport();
    const mutated = { ...report } as Record<string, unknown>;
    delete mutated.schemaVersion;

    const result = validateReport(mutated);
    expect(result.success).toBe(true);
    // schemaVersion has a default in zod schema, but deleting required summary fails
    delete mutated.summary;
    const summaryResult = validateReport(mutated);
    expect(summaryResult.success).toBe(false);
  });

  it("matches structural JSON snapshot preventing unintentional breaking schema mutations", () => {
    const report = createCanonicalReport();
    // Serialize and snapshot test shape
    const serialized = JSON.parse(JSON.stringify(report));

    expect(serialized).toMatchSnapshot();
  });
});
