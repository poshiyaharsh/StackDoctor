import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildIssueDraft } from "../src/issue-draft.js";
import { compareReports } from "../src/compare.js";
import {
  formatMarkdownReport,
  formatTerminalReport,
  formatComparisonTerminal,
  formatComparisonMarkdown
} from "../../../apps/cli/src/format.js";
import type { Report } from "@stackdoctor/schemas";

describe("Phase 4 Security Checks & Invariants (phase4-security.test.ts)", () => {
  const canarySecret = "CANARY_SECRET_SUPER_CONFIDENTIAL_12345";
  const canaryApiKey = "sk-live-CANARY-SECRET-API-KEY-999";
  const userHome = os.homedir();
  const userName = process.env.USERNAME || process.env.USER || "testuser";
  const userHost = os.hostname();
  const sampleAbsPath = path.join(userHome, "sensitive-workspace", "project-x");

  function createCanaryReport(): Report {
    return {
      schemaVersion: "1.0.0",
      toolVersion: "0.1.0",
      operatingSystem: "linux",
      startedAt: "2026-10-27T10:00:00.000Z",
      completedAt: "2026-10-27T10:00:01.000Z",
      durationMs: 1000,
      projectName: "canary-project",
      status: "completed_with_warnings",
      technologies: [{ name: "Node.js", confidence: "confirmed", evidence: [] }],
      findings: [
        {
          ruleId: "ENV_VAR_NAMES_MISSING",
          title: `Secret leaked in title: ${canarySecret}`,
          category: "configuration",
          severity: "high",
          confidence: "confirmed",
          status: "failed",
          evidence: [
            {
              id: "ev-1",
              kind: "file_content",
              description: `Observed secret in evidence: ${sampleAbsPath} with ${canaryApiKey}`,
              observed: `Detected line: export DB_PASSWORD=${canarySecret} in ${sampleAbsPath}/.env`,
              source: `${sampleAbsPath}/.env`,
              collectedAt: "2026-10-27T10:00:00.500Z"
            }
          ],
          possibleCauses: [
            `Database connection failed for user ${userName} on host ${userHost}.`
          ],
          recommendations: [
            {
              problem: "Password variable missing.",
              relevance: "Impacts database connection.",
              commandOrAction: `export DB_PASS=${canarySecret}`,
              risks: "None",
              undo: "unset DB_PASS",
              verification: "echo done"
            }
          ],
          verificationStatus: "unverified",
          docs: ["https://nodejs.org/api/"]
        }
      ],
      checks: [
        {
          id: "chk-1",
          title: "Check secrets",
          category: "security",
          status: "failed",
          durationMs: 100,
          evidence: [
            {
              id: "ev-chk-1",
              kind: "file_presence",
              description: `Evidence path: ${sampleAbsPath}`,
              observed: `Secret: ${canarySecret}`,
              source: "filesystem",
              collectedAt: "2026-10-27T10:00:00.000Z"
            }
          ]
        }
      ],
      summary: {
        totalChecks: 1,
        totalFindings: 1,
        byStatus: { passed: 0, failed: 1, skipped: 0, warning: 0 },
        bySeverity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 }
      }
    };
  }

  it("never includes canary secrets or machine identifiers in issue drafts", () => {
    const report = createCanaryReport();
    const draft = buildIssueDraft(report, {
      projectPath: sampleAbsPath,
      homeDir: userHome,
      username: userName,
      hostname: userHost
    });

    const fullDraft = draft.title + "\n" + draft.body;
    expect(fullDraft).not.toContain(canarySecret);
    expect(fullDraft).not.toContain(canaryApiKey);
    expect(fullDraft).not.toContain(sampleAbsPath);
    expect(fullDraft).not.toContain(userHome);
    expect(fullDraft).toContain("[REDACTED]");
    expect(fullDraft).toContain("<project>");
  });

  it("never includes canary secrets or absolute paths in markdown reports", () => {
    const report = createCanaryReport();
    const markdown = formatMarkdownReport(report, {
      projectPath: sampleAbsPath
    });

    expect(markdown).not.toContain(canarySecret);
    expect(markdown).not.toContain(canaryApiKey);
    expect(markdown).not.toContain(sampleAbsPath);
    expect(markdown).not.toContain(userHome);
    expect(markdown).toContain("[REDACTED]");
    expect(markdown).toContain("<project>");
  });

  it("never includes canary secrets in terminal report output", () => {
    const report = createCanaryReport();
    const terminalOutput = formatTerminalReport(report, { noColor: true });

    expect(terminalOutput).not.toContain(canarySecret);
    expect(terminalOutput).not.toContain(canaryApiKey);
    expect(terminalOutput).toContain("[REDACTED]");
  });

  it("never includes canary secrets in compare terminal and markdown outputs", () => {
    const baseReport = createCanaryReport();
    const headReport = {
      ...createCanaryReport(),
      findings: []
    };

    const comparison = compareReports(baseReport, headReport);
    const terminalDiff = formatComparisonTerminal(comparison, { noColor: true });
    const markdownDiff = formatComparisonMarkdown(comparison);

    expect(terminalDiff).not.toContain(canarySecret);
    expect(terminalDiff).not.toContain(canaryApiKey);
    expect(markdownDiff).not.toContain(canarySecret);
    expect(markdownDiff).not.toContain(canaryApiKey);
  });

  it("composite action (action.yml) safely passes inputs via environment variables with zero unquoted inputs in run blocks", () => {
    const actionPath = path.resolve(__dirname, "../../../action.yml");
    expect(fs.existsSync(actionPath)).toBe(true);

    const actionContent = fs.readFileSync(actionPath, "utf-8");

    // Extract all `run:` blocks in action.yml
    const lines = actionContent.split("\n");
    let inRunBlock = false;
    const runBlockLines: string[] = [];

    for (const line of lines) {
      if (/^\s*run:\s*(\|?>-?)?/.test(line)) {
        inRunBlock = true;
        continue;
      }
      if (inRunBlock) {
        // If indentation drops back to 4 or fewer spaces (or next step block)
        if (/^\s{2,4}-\s+name:/.test(line) || /^\S/.test(line)) {
          inRunBlock = false;
        } else {
          runBlockLines.push(line);
        }
      }
    }

    // Assert that NO run block contains raw ${{ inputs.* }}
    for (const runLine of runBlockLines) {
      const match = /\$\{\{\s*inputs\.[^}]+\}\}/.exec(runLine);
      if (match) {
        throw new Error(
          `Security violation: Unquoted/interpolated input inside run block: "${runLine.trim()}"`
        );
      }
      expect(match).toBeNull();
    }
  });

  describe("Oversized and Malformed Report Files Resilience", () => {
    const tempDir = path.join(os.tmpdir(), `stk-sec-oversized-${Date.now()}`);

    beforeEach(() => {
      fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("rejects malformed JSON report files without crashing", async () => {
      const malformedFile = path.join(tempDir, "malformed.json");
      fs.writeFileSync(malformedFile, "{ broken json ::: invalid }", "utf-8");

      const validReport = createCanaryReport();
      const validFile = path.join(tempDir, "valid.json");
      fs.writeFileSync(validFile, JSON.stringify(validReport), "utf-8");

      // Verify compare rejects malformed file
      const { runCli } = await import("../../../apps/cli/src/index.js");
      const exitCode = await runCli(["compare", malformedFile, validFile]);
      expect(exitCode).toBe(2);
    }, 15000);

    it("rejects invalid schema reports missing required fields", async () => {
      const invalidSchemaFile = path.join(tempDir, "invalid-schema.json");
      fs.writeFileSync(
        invalidSchemaFile,
        JSON.stringify({ notAReport: true, randomField: 123 }),
        "utf-8"
      );

      const validReport = createCanaryReport();
      const validFile = path.join(tempDir, "valid.json");
      fs.writeFileSync(validFile, JSON.stringify(validReport), "utf-8");

      const { runCli } = await import("../../../apps/cli/src/index.js");
      const exitCode = await runCli(["compare", invalidSchemaFile, validFile]);
      expect(exitCode).toBe(2);
    });
  });
});
