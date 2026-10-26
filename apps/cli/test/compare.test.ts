import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import https from "node:https";
import { runCli } from "../src/index.js";
import type { Report, Finding } from "@stackdoctor/schemas";

describe("StackDoctor CLI 'compare' Command (Run 4C)", () => {
  const originalFetch = globalThis.fetch;
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalLog = console.log;
  const originalError = console.error;

  const tempDir = path.join(os.tmpdir(), `stk-compare-cli-test-${Date.now()}`);
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
      startedAt: "2026-10-26T10:00:00.000Z",
      completedAt: "2026-10-26T10:00:03.000Z",
      status: "completed",
      projectName: "sample-project",
      technologies: [{ name: "nodejs", confidence: "confirmed", evidence: [] }],
      checks: [
        {
          id: "node-deps",
          title: "Node Dependencies Check",
          category: "dependencies",
          status: "passed",
          durationMs: 42,
          evidence: []
        }
      ],
      findings: [],
      summary: {
        totalChecks: 1,
        totalFindings: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        byStatus: { passed: 1, failed: 0, warning: 0, skipped: 0, error: 0 }
      },
      ...overrides
    };
  }

  function createFinding(overrides: Partial<Finding> = {}): Finding {
    return {
      ruleId: "port-conflict",
      title: "Port Conflict Detected",
      severity: "high",
      confidence: "confirmed",
      category: "ports",
      status: "failed",
      description: "Port 3000 is occupied",
      evidence: [
        {
          id: "ev-1",
          kind: "port_binding",
          description: "Port binding check",
          observed: "port: 3000 in use",
          source: "probe",
          collectedAt: "2026-10-26T10:00:00.000Z"
        }
      ],
      possibleCauses: ["Another service is using port 3000"],
      recommendations: [],
      verificationStatus: "unverified",
      docs: [],
      ...overrides
    };
  }

  it("compares two identical reports with zero diff (empty diff on self-comparison)", async () => {
    const report = createTestReport({
      findings: [createFinding()]
    });
    const reportPath1 = path.join(tempDir, "base.json");
    const reportPath2 = path.join(tempDir, "head.json");
    fs.writeFileSync(reportPath1, JSON.stringify(report), "utf-8");
    fs.writeFileSync(reportPath2, JSON.stringify(report), "utf-8");

    const exitCode = await runCli(["compare", reportPath1, reportPath2]);
    expect(exitCode).toBe(0);

    const fullOutput = loggedOutput.join("\n");
    expect(fullOutput).toContain("=== StackDoctor Diagnostic Report Comparison ===");
    expect(fullOutput).toContain("Findings: 0 (New: 0, Resolved: 0, Changed: 0)");
    expect(fullOutput).toContain("--- New Findings (0) ---");
    expect(fullOutput).toContain("None.");
  });

  it("outputs valid JSON comparison with --format json", async () => {
    const base = createTestReport();
    const head = createTestReport({
      findings: [createFinding({ severity: "critical", title: "Redis connection failed" })]
    });

    const basePath = path.join(tempDir, "base.json");
    const headPath = path.join(tempDir, "head.json");
    fs.writeFileSync(basePath, JSON.stringify(base), "utf-8");
    fs.writeFileSync(headPath, JSON.stringify(head), "utf-8");

    const exitCode = await runCli(["compare", basePath, headPath, "--format", "json"]);
    expect(exitCode).toBe(0);

    const jsonStr = loggedOutput.join("\n");
    const parsed = JSON.parse(jsonStr);
    expect(parsed.newFindings).toHaveLength(1);
    expect(parsed.newFindings[0].severity).toBe("critical");
    expect(parsed.resolvedFindings).toHaveLength(0);
    expect(parsed.hasRegressions).toBe(true);
  });

  it("outputs valid Markdown comparison with --format markdown and writes to --out", async () => {
    const base = createTestReport({
      findings: [createFinding({ ruleId: "old-bug", title: "Resolved Issue" })]
    });
    const head = createTestReport({
      findings: []
    });

    const basePath = path.join(tempDir, "base.json");
    const headPath = path.join(tempDir, "head.json");
    const outPath = path.join(tempDir, "diff.md");
    fs.writeFileSync(basePath, JSON.stringify(base), "utf-8");
    fs.writeFileSync(headPath, JSON.stringify(head), "utf-8");

    const exitCode = await runCli([
      "compare",
      basePath,
      headPath,
      "--format",
      "markdown",
      "--out",
      outPath
    ]);
    expect(exitCode).toBe(0);

    const fullOutput = loggedOutput.join("\n");
    expect(fullOutput).toContain("# 🩺 StackDoctor Report Comparison");
    expect(fullOutput).toContain("### ✅ Resolved Findings");
    expect(fullOutput).toContain("old-bug");

    expect(fs.existsSync(outPath)).toBe(true);
    const fileContent = fs.readFileSync(outPath, "utf-8");
    expect(fileContent).toContain("# 🩺 StackDoctor Report Comparison");
  });

  it("returns exit code 1 with --fail-on-new when new findings meet or exceed threshold", async () => {
    const base = createTestReport({ findings: [] });
    const head = createTestReport({
      findings: [createFinding({ severity: "high", title: "New High Severity Finding" })]
    });

    const basePath = path.join(tempDir, "base.json");
    const headPath = path.join(tempDir, "head.json");
    fs.writeFileSync(basePath, JSON.stringify(base), "utf-8");
    fs.writeFileSync(headPath, JSON.stringify(head), "utf-8");

    // Fails on high threshold
    const exitCode1 = await runCli([
      "compare",
      basePath,
      headPath,
      "--fail-on-new",
      "high"
    ]);
    expect(exitCode1).toBe(1);

    // Passes on critical threshold (since new finding is only high)
    const exitCode2 = await runCli([
      "compare",
      basePath,
      headPath,
      "--fail-on-new",
      "critical"
    ]);
    expect(exitCode2).toBe(0);
  });

  it("does not trigger --fail-on-new for pre-existing unchanged findings", async () => {
    const existingFinding = createFinding({ severity: "critical", title: "Existing Critical Flaw" });
    const base = createTestReport({ findings: [existingFinding] });
    const head = createTestReport({ findings: [existingFinding] });

    const basePath = path.join(tempDir, "base.json");
    const headPath = path.join(tempDir, "head.json");
    fs.writeFileSync(basePath, JSON.stringify(base), "utf-8");
    fs.writeFileSync(headPath, JSON.stringify(head), "utf-8");

    const exitCode = await runCli([
      "compare",
      basePath,
      headPath,
      "--fail-on-new",
      "critical"
    ]);
    expect(exitCode).toBe(0);
  });

  it("returns exit code 3 on missing arguments", async () => {
    const exitCode = await runCli(["compare", "single-file.json"]);
    expect(exitCode).toBe(3);
    expect(errorOutput.join("\n")).toContain("Usage error");
  });

  it("returns exit code 3 on invalid --fail-on-new severity", async () => {
    const exitCode = await runCli([
      "compare",
      "f1.json",
      "f2.json",
      "--fail-on-new",
      "super_critical"
    ]);
    expect(exitCode).toBe(3);
    expect(errorOutput.join("\n")).toContain("Invalid severity");
  });

  it("returns exit code 2 when base or head file does not exist", async () => {
    const existingPath = path.join(tempDir, "base.json");
    fs.writeFileSync(existingPath, JSON.stringify(createTestReport()), "utf-8");

    const exitCode = await runCli(["compare", existingPath, "nonexistent-head.json"]);
    expect(exitCode).toBe(2);
    expect(errorOutput.join("\n")).toContain("does not exist");
  });

  it("returns exit code 2 when file is corrupt or invalid schema", async () => {
    const basePath = path.join(tempDir, "base.json");
    const corruptPath = path.join(tempDir, "corrupt.json");
    fs.writeFileSync(basePath, JSON.stringify(createTestReport()), "utf-8");
    fs.writeFileSync(corruptPath, "{ invalid json", "utf-8");

    const exitCode = await runCli(["compare", basePath, corruptPath]);
    expect(exitCode).toBe(2);
    expect(errorOutput.join("\n")).toContain("Error reading Head report file");
  });

  it("runs 100% offline without network calls", async () => {
    let networkCallAttempted = false;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      networkCallAttempted = true;
      return Promise.reject(new Error("Network disabled"));
    });

    const report = createTestReport();
    const p1 = path.join(tempDir, "b.json");
    const p2 = path.join(tempDir, "h.json");
    fs.writeFileSync(p1, JSON.stringify(report), "utf-8");
    fs.writeFileSync(p2, JSON.stringify(report), "utf-8");

    const exitCode = await runCli(["compare", p1, p2]);
    expect(exitCode).toBe(0);
    expect(networkCallAttempted).toBe(false);
  });
});
