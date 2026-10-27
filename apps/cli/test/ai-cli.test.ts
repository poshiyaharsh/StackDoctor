import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCli } from "../src/index.js";
import { MockProvider, type AiExplanation } from "@stackdoctor/ai";
import { getAiConfigFilePath } from "../src/ai-config-store.js";

describe("StackDoctor CLI - AI Commands and Consent Preview (Run 5C)", () => {
  let tempConfigDir: string;
  let tempFixtureDir: string;
  let stdoutOutput: string[] = [];
  let stderrOutput: string[] = [];
  const origLog = console.log;
  const origError = console.error;

  beforeEach(() => {
    tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), "sd-cli-ai-config-"));
    tempFixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "sd-cli-ai-fix-"));
    process.env.STACKDOCTOR_CONFIG_DIR = tempConfigDir;

    stdoutOutput = [];
    stderrOutput = [];
    console.log = (...args: unknown[]) => {
      stdoutOutput.push(args.map(String).join(" "));
    };
    console.error = (...args: unknown[]) => {
      stderrOutput.push(args.map(String).join(" "));
    };
  });

  afterEach(() => {
    console.log = origLog;
    console.error = origError;
    delete process.env.STACKDOCTOR_CONFIG_DIR;

    try {
      fs.rmSync(tempConfigDir, { recursive: true, force: true });
      fs.rmSync(tempFixtureDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("1. 'ai setup' writes config without raw keys and 'ai status' shows configuration safely", async () => {
    const exitCodeSetup = await runCli([
      "ai",
      "setup",
      "--provider",
      "anthropic",
      "--model",
      "claude-3-5-sonnet-20241022",
      "--key-env",
      "CUSTOM_ANTHROPIC_KEY"
    ]);

    expect(exitCodeSetup).toBe(0);
    const setupText = stdoutOutput.join("\n");
    expect(setupText).toContain("AI configuration saved successfully");
    expect(setupText).toContain("CUSTOM_ANTHROPIC_KEY");

    // Invariant: The config file must exist and must NEVER store an actual key
    const configPath = getAiConfigFilePath();
    expect(fs.existsSync(configPath)).toBe(true);
    const savedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(savedConfig.provider).toBe("anthropic");
    expect(savedConfig.apiKeyEnvVar).toBe("CUSTOM_ANTHROPIC_KEY");
    expect(savedConfig.key).toBeUndefined();
    expect(savedConfig.apiKey).toBeUndefined();

    // Now test 'ai status'
    stdoutOutput = [];
    const exitCodeStatus = await runCli(["ai", "status"]);
    expect(exitCodeStatus).toBe(0);
    const statusText = stdoutOutput.join("\n");
    expect(statusText).toContain("Status         : Enabled");
    expect(statusText).toContain("Provider       : anthropic");
    expect(statusText).toContain("Model          : claude-3-5-sonnet-20241022");
    expect(statusText).toContain("$CUSTOM_ANTHROPIC_KEY");
  });

  it("2. 'ai-explain' on unconfigured AI shows setup guidance and displays deterministic fallback", async () => {
    // Empty directory
    const exitCode = await runCli(["ai-explain", tempFixtureDir]);
    expect(exitCode).toBe(0);

    const out = stdoutOutput.join("\n");
    expect(out).toContain("StackDoctor Diagnostic Explanation (FALLBACK)");
    expect(out).toContain("Notice: Showing deterministic explanation");
    expect(out).toContain("AI explanations are unconfigured or disabled");
  });

  it("3. 'ai-explain' with --yes sends sanitized payload to MockProvider and outputs formatted sections", async () => {
    // Configure AI first
    await runCli([
      "ai",
      "setup",
      "--provider",
      "mock",
      "--model",
      "mock-model"
    ]);

    // Create a mock report file with a finding
    const reportFile = path.join(tempFixtureDir, "report.json");
    const mockReport = {
      schemaVersion: "1.0.0",
      toolVersion: "0.1.0",
      operatingSystem: "linux",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: "completed",
      projectName: "my-service",
      technologies: [],
      checks: [],
      findings: [
        {
          ruleId: "NODE_DEPS_MISSING",
          title: "Node.js dependencies missing",
          category: "dependencies",
          severity: "high",
          confidence: "confirmed",
          status: "failed",
          evidence: [
            {
              id: "ev-node-1",
              kind: "fs_check",
              description: "node_modules is missing",
              observed: "Directory node_modules not found",
              source: "fs",
              collectedAt: new Date().toISOString()
            }
          ],
          possibleCauses: ["Dependencies have not been installed"],
          recommendations: [
            {
              problem: "node_modules missing",
              relevance: "Direct",
              commandOrAction: "npm install",
              expectedResult: "node_modules populated",
              risks: "None",
              verification: "test -d node_modules"
            }
          ],
          verificationStatus: "unverified",
          docs: []
        }
      ],
      summary: {
        totalChecks: 1,
        totalFindings: 1,
        bySeverity: { info: 0, low: 0, medium: 0, high: 1, critical: 0 },
        byStatus: { passed: 0, failed: 1, warning: 0, skipped: 0, error: 0 }
      }
    };
    fs.writeFileSync(reportFile, JSON.stringify(mockReport, null, 2), "utf-8");

    const mockAiResponse: AiExplanation = {
      summary: "Dependencies are missing from project workspace.",
      rootCauseRanking: [
        {
          cause: "Fresh repo checkout",
          likelihood: "high",
          reasoning: "The node_modules directory was not created yet.",
          supportingEvidenceIds: ["ev-node-1"]
        }
      ],
      confirmedFacts: [
        {
          statement: "The node_modules directory was not found.",
          evidenceIds: ["ev-node-1"]
        }
      ],
      hypotheses: [
        {
          statement: "Install command was interrupted.",
          whatWouldConfirmIt: "Check npm cache integrity"
        }
      ],
      checklist: ["Run npm install at project root"],
      suggestedExtraChecks: ["npm test"],
      suggestedOperationIds: ["npm_install"]
    };

    const customMock = new MockProvider();
    customMock.enqueueResponse(JSON.stringify(mockAiResponse));

    stdoutOutput = [];
    // Run ai-explain with --yes
    const exitCode = await runCli([
      "ai-explain",
      reportFile,
      "--yes",
      "--provider",
      "mock"
    ], { customMockProvider: customMock });

    expect(exitCode).toBe(0);
    const out = stdoutOutput.join("\n");

    // Verify consent preview was displayed
    expect(out).toContain("StackDoctor AI Consent Preview");
    expect(out).toContain("Payload Size");
    expect(out).toContain("Findings Count");
    expect(out).toContain("Privacy Guarantees");

    // Verify AI explanation sections
    expect(out).toContain("AI-Generated Diagnostic Explanation (UNVERIFIED)");
    expect(out).toContain("Notice: AI-generated explanation. Verify before acting.");
    expect(out).toContain("--- Confirmed Facts (Grounded in Evidence) ---");
    expect(out).toContain("The node_modules directory was not found. (Citing: ev-node-1)");
    expect(out).toContain("--- Remediation Checklist ---");
    expect(out).toContain("[ ] Run npm install at project root");

    // Verify MockProvider received the request
    expect(customMock.getReceivedRequests()).toHaveLength(1);
    const receivedReq = customMock.getReceivedRequests()[0];
    expect(receivedReq.user).toContain("<diagnostic_data>");
    expect(receivedReq.user).toContain("NODE_DEPS_MISSING");
  });

  it("4. 'scan' command never makes AI provider calls under any circumstances (100% offline guarantee)", async () => {
    // Even if AI is configured and enabled in settings
    await runCli([
      "ai",
      "setup",
      "--provider",
      "mock",
      "--model",
      "mock-model"
    ]);

    const customMock = new MockProvider();
    stdoutOutput = [];

    const exitCode = await runCli(["scan", tempFixtureDir], { customMockProvider: customMock });
    expect(exitCode).toBe(0);

    // Assert: customMock MUST have 0 received requests
    expect(customMock.getReceivedRequests()).toHaveLength(0);

    const out = stdoutOutput.join("\n");
    expect(out).toContain("StackDoctor Diagnostic Report");
    expect(out).not.toContain("AI-Generated Diagnostic Explanation");
  });
});
