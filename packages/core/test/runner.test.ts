import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runDiagnostics, type DiagnosticCheck, type DiagnosticRule } from "@stackdoctor/core";
import { validateReport, type Finding } from "@stackdoctor/schemas";

describe("Diagnostic Lifecycle Runner (runner.ts)", () => {
  let tempProjectDir: string;

  beforeEach(() => {
    tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-runner-test-"));
    fs.writeFileSync(
      path.join(tempProjectDir, "package.json"),
      JSON.stringify({ name: "runner-test-project", version: "1.0.0" }),
      "utf-8"
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tempProjectDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("completes a full diagnostic run and produces a schema-valid report", async () => {
    const sampleCheck: DiagnosticCheck = {
      id: "check_node_manifest",
      title: "Verify package.json existence",
      category: "manifest",
      execute: async () => ({
        status: "passed",
        evidence: [
          {
            id: "ev-check-pkg",
            kind: "file_presence",
            description: "package.json was found",
            observed: "File exists",
            source: "package.json",
            collectedAt: new Date().toISOString()
          }
        ]
      })
    };

    const sampleRule: DiagnosticRule = {
      id: "RULE_SAMPLE_PASS",
      title: "Sample Pass Rule",
      description: "Sample rule for testing lifecycle",
      technologies: ["Node.js"],
      severity: "info",
      confidence: "confirmed",
      docs: ["https://stackdoctor.dev"],
      checks: [sampleCheck],
      evaluate: () => null
    };

    const report = await runDiagnostics({
      dir: tempProjectDir,
      rules: [sampleRule]
    });

    expect(report.projectName).toBe("runner-test-project");
    expect(report.status).toBe("completed");
    expect(report.checks.length).toBe(1);
    expect(report.checks[0]?.status).toBe("passed");

    // Must validate completely against zod schema
    const validation = validateReport(report);
    expect(validation.success).toBe(true);
  });

  it("CRITICAL RULE: a throwing check does not crash the run", async () => {
    const throwingCheck: DiagnosticCheck = {
      id: "check_deliberate_throw",
      title: "Deliberately throwing check",
      category: "resilience",
      execute: async () => {
        throw new Error("Deliberate failure: unhandled exception in check logic password=secret123");
      }
    };

    const report = await runDiagnostics({
      dir: tempProjectDir,
      checks: [throwingCheck]
    });

    // Run must NOT crash and must return a valid report
    expect(report.status).toBe("completed_with_warnings");
    expect(report.checks.length).toBe(1);
    expect(report.checks[0]?.status).toBe("error");

    // Secret inside error message must be redacted
    expect(report.checks[0]?.error).toContain("password=[REDACTED]");
    expect(report.checks[0]?.error).not.toContain("secret123");

    const validation = validateReport(report);
    expect(validation.success).toBe(true);
  });

  it("CRITICAL RULE: a timing out check is caught and does not crash the run", async () => {
    const hangingCheck: DiagnosticCheck = {
      id: "check_deliberate_timeout",
      title: "Deliberately hanging check",
      category: "resilience",
      timeoutMs: 50, // fast timeout for test speed
      execute: async () => {
        // Hang indefinitely
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        return {
          status: "passed",
          evidence: []
        };
      }
    };

    const report = await runDiagnostics({
      dir: tempProjectDir,
      checks: [hangingCheck]
    });

    expect(report.status).toBe("completed_with_warnings");
    expect(report.checks.length).toBe(1);
    expect(report.checks[0]?.status).toBe("error");
    expect(report.checks[0]?.error).toContain("timed out after 50ms");

    const validation = validateReport(report);
    expect(validation.success).toBe(true);
  });

  it("supports cancellation via AbortSignal", async () => {
    const controller = new AbortController();

    const slowCheck: DiagnosticCheck = {
      id: "check_slow",
      title: "Slow check for cancellation",
      category: "timing",
      execute: async () => {
        controller.abort();
        return {
          status: "passed",
          evidence: []
        };
      }
    };

    const nextCheck: DiagnosticCheck = {
      id: "check_skipped",
      title: "Should be skipped after abort",
      category: "timing",
      execute: async () => ({
        status: "passed",
        evidence: []
      })
    };

    const report = await runDiagnostics({
      dir: tempProjectDir,
      checks: [slowCheck, nextCheck],
      signal: controller.signal
    });

    expect(report.status).toBe("cancelled");
    const skippedCheck = report.checks.find((c) => c.id === "check_skipped");
    expect(skippedCheck?.status).toBe("skipped");

    const validation = validateReport(report);
    expect(validation.success).toBe(true);
  });

  it("evaluates rules into findings and populates summary counts", async () => {
    const failingCheck: DiagnosticCheck = {
      id: "check_fake_failure",
      title: "Check with failure status",
      category: "deps",
      execute: async () => ({
        status: "failed",
        evidence: [
          {
            id: "ev-failed-check",
            kind: "file_presence",
            description: "Missing required files",
            observed: "node_modules is missing",
            source: "fs.existsSync",
            collectedAt: new Date().toISOString()
          }
        ]
      })
    };

    const sampleFinding: Finding = {
      ruleId: "NODE_DEPS_MISSING",
      title: "Node dependencies not installed",
      category: "deps",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [],
      possibleCauses: ["User cloned repo but did not run npm install"],
      recommendations: [
        {
          problem: "Dependencies missing",
          relevance: "Cannot run project without dependencies",
          commandOrAction: "npm install",
          expectedResult: "node_modules folder created",
          risks: "None",
          verification: "test -d node_modules"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://docs.npmjs.com"]
    };

    const rule: DiagnosticRule = {
      id: "NODE_DEPS_MISSING",
      title: "Node dependencies not installed",
      description: "Detects missing node_modules",
      technologies: ["Node.js"],
      severity: "high",
      confidence: "confirmed",
      docs: ["https://docs.npmjs.com"],
      checks: [failingCheck],
      evaluate: (_ctx, checkResults) => {
        if (checkResults.some((c) => c.status === "failed")) {
          return sampleFinding;
        }
        return null;
      }
    };

    const report = await runDiagnostics({
      dir: tempProjectDir,
      rules: [rule]
    });

    expect(report.findings.length).toBe(1);
    expect(report.summary.bySeverity.high).toBe(1);
    expect(report.summary.byStatus.failed).toBe(1);
    expect(report.status).toBe("completed_with_warnings");

    const validation = validateReport(report);
    expect(validation.success).toBe(true);
  });
});
