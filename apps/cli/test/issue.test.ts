import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import https from "node:https";
import { runCli } from "../src/index.js";
import type { Report } from "@stackdoctor/schemas";

describe("StackDoctor CLI 'issue' Command (Run 4A)", () => {
  const originalFetch = globalThis.fetch;
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalLog = console.log;
  const originalError = console.error;

  const tempDir = path.join(os.tmpdir(), `stk-issue-cli-test-${Date.now()}`);
  let loggedOutput: string[] = [];
  let errorOutput: string[] = [];

  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true });
    loggedOutput = [];
    errorOutput = [];
    console.log = (...args: unknown[]) => {
      loggedOutput.push(args.map(String).join(" "));
    };
    console.error = (...args: unknown[]) => {
      errorOutput.push(args.map(String).join(" "));
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    console.log = originalLog;
    console.error = originalError;
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  function createTestReport(overrides: Partial<Report> = {}): Report {
    return {
      schemaVersion: "1.0.0",
      toolVersion: "0.1.0",
      operatingSystem: "linux",
      startedAt: new Date(Date.now() - 3000).toISOString(),
      completedAt: new Date().toISOString(),
      status: "failed",
      projectName: "sample-project",
      technologies: [{ name: "nodejs", confidence: "confirmed", evidence: [] }],
      checks: [
        {
          id: "node-deps",
          title: "Node Dependencies Check",
          category: "dependencies",
          status: "failed",
          durationMs: 15,
          evidence: []
        }
      ],
      findings: [
        {
          ruleId: "NODE_DEPS_NOT_INSTALLED",
          title: "Node modules missing",
          category: "dependencies",
          severity: "high",
          confidence: "confirmed",
          status: "failed",
          evidence: [
            {
              id: "ev-1",
              kind: "filesystem",
              description: "node_modules directory missing",
              observed: "node_modules does not exist in project root",
              source: "fs.existsSync",
              collectedAt: new Date().toISOString()
            }
          ],
          possibleCauses: ["User did not run npm install"],
          recommendations: [
            {
              problem: "Dependencies not installed",
              relevance: "Required for runtime",
              commandOrAction: "npm install",
              expectedResult: "node_modules installed",
              risks: "None",
              verification: "test -d node_modules"
            }
          ],
          verificationStatus: "unverified",
          docs: []
        },
        {
          ruleId: "LOW_OPT_CHECK",
          title: "Optional optimization check",
          category: "performance",
          severity: "low",
          confidence: "possible",
          status: "warning",
          evidence: [],
          possibleCauses: ["Cache directory can be pruned"],
          recommendations: [],
          verificationStatus: "unverified",
          docs: []
        }
      ],
      summary: {
        totalChecks: 1,
        totalFindings: 2,
        bySeverity: {
          critical: 0,
          high: 1,
          medium: 0,
          low: 1,
          info: 0
        },
        byStatus: {
          failed: 1,
          passed: 0,
          warning: 1,
          skipped: 0,
          error: 0
        }
      },
      ...overrides
    };
  }

  it("prints a preview of what would be shared and confirms nothing was sent", async () => {
    const reportFile = path.join(tempDir, "report.json");
    fs.writeFileSync(reportFile, JSON.stringify(createTestReport()));

    const exitCode = await runCli(["issue", reportFile]);

    expect(exitCode).toBe(0);
    const fullLog = loggedOutput.join("\n");

    expect(fullLog).toContain("StackDoctor - GitHub Issue Draft Preview");
    expect(fullLog).toContain("Review before posting. Nothing was sent.");
    expect(fullLog).toContain("Title:  [Environment Issue] sample-project: Node modules missing (+1 more)");
    expect(fullLog).toContain("Labels: environment, stackdoctor, bug");
    expect(fullLog).toContain("## Observed Evidence");
    expect(fullLog).toContain("## Possible Causes (Hypotheses)");
  });

  it("guarantees 100% offline execution with zero network access (mock & assert)", async () => {
    const fetchSpy = vi.fn();
    const httpSpy = vi.spyOn(http, "request");
    const httpsSpy = vi.spyOn(https, "request");
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const reportFile = path.join(tempDir, "report.json");
    fs.writeFileSync(reportFile, JSON.stringify(createTestReport()));

    const exitCode = await runCli(["issue", reportFile]);

    expect(exitCode).toBe(0);
    // Absolute guarantee: never calls any network API
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    expect(httpSpy).toHaveBeenCalledTimes(0);
    expect(httpsSpy).toHaveBeenCalledTimes(0);
  });

  it("filters findings using --min-severity flag", async () => {
    const reportFile = path.join(tempDir, "report.json");
    fs.writeFileSync(reportFile, JSON.stringify(createTestReport()));

    const exitCode = await runCli(["issue", reportFile, "--min-severity", "high"]);
    expect(exitCode).toBe(0);

    const fullLog = loggedOutput.join("\n");
    expect(fullLog).toContain("NODE_DEPS_NOT_INSTALLED");
    expect(fullLog).not.toContain("LOW_OPT_CHECK");
  });

  it("omits observed evidence when --no-evidence flag is passed", async () => {
    const reportFile = path.join(tempDir, "report.json");
    fs.writeFileSync(reportFile, JSON.stringify(createTestReport()));

    const exitCode = await runCli(["issue", reportFile, "--no-evidence"]);
    expect(exitCode).toBe(0);

    const fullLog = loggedOutput.join("\n");
    expect(fullLog).toContain("Observed evidence omitted via options.");
    expect(fullLog).not.toContain("node_modules does not exist in project root");
  });

  it("writes issue draft to disk when --out <file> is provided", async () => {
    const reportFile = path.join(tempDir, "report.json");
    const outFile = path.join(tempDir, "issue-draft.md");
    fs.writeFileSync(reportFile, JSON.stringify(createTestReport()));

    const exitCode = await runCli(["issue", reportFile, "--out", outFile]);
    expect(exitCode).toBe(0);

    expect(fs.existsSync(outFile)).toBe(true);
    const content = fs.readFileSync(outFile, "utf-8");
    expect(content).toContain("## Summary");
    expect(content).toContain("## Findings");
    expect(content).toContain("NODE_DEPS_NOT_INSTALLED");
  });

  it("handles directory scanning directly when target is a folder", async () => {
    const exitCode = await runCli(["issue", "examples/healthy-node-project", "--no-color"]);
    expect(exitCode).toBe(0);

    const fullLog = loggedOutput.join("\n");
    expect(fullLog).toContain("StackDoctor - GitHub Issue Draft Preview");
    expect(fullLog).toContain("Review before posting. Nothing was sent.");
  });

  it("returns error code 2 for invalid or corrupt report files", async () => {
    const corruptFile = path.join(tempDir, "corrupt.json");
    fs.writeFileSync(corruptFile, "{ invalidJson: true ");

    const exitCode = await runCli(["issue", corruptFile]);
    expect(exitCode).toBe(2);
    expect(errorOutput.join("\n")).toContain("Error reading report file");
  });
});
