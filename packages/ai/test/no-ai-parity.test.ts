import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { runCli } from "stackdoctor";
import type { Report } from "@stackdoctor/schemas";
import {
  explainWithAi,
  buildFallbackExplanation,
  AiConfigSchema
} from "../src/index.js";

describe("No-AI Parity & Fallback Verification (Run 5F)", () => {
  const fixturesDir = path.resolve(__dirname, "../../../examples");
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.AI_ENABLED;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("verifies explainWithAi returns ai_disabled when AI is unconfigured or disabled", async () => {
    const config = AiConfigSchema.parse({
      enabled: false
    });

    const result = await explainWithAi({
      config,
      input: { findings: [], environment: { osFamily: "linux", runtimeVersions: [] } }
    });
    expect(result.status).toBe("ai_disabled");
    if (result.status === "ai_disabled") {
      expect(result.message).toContain("AI explanations are disabled by default");
    }
  });

  it("builds identical deterministic rule-based fallback explanation without AI", () => {
    const dummyFinding = {
      ruleId: "ENV_EXAMPLE_PRESENT_NO_ENV",
      title: "Missing .env",
      category: "configuration" as const,
      severity: "medium" as const,
      confidence: "confirmed" as const,
      status: "fail" as const,
      evidence: [
        {
          id: "ev-1",
          kind: "fs_check",
          description: ".env.example found",
          observed: "found",
          source: "fs",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [".env file was not created from template"],
      recommendations: [
        {
          problem: "Missing .env",
          relevance: "High",
          commandOrAction: "copy .env.example .env",
          expectedResult: ".env exists",
          risks: "None",
          verification: "test -f .env"
        }
      ],
      verificationStatus: "unverified" as const,
      docs: []
    };

    const fallback = buildFallbackExplanation([dummyFinding]);
    expect(fallback.summary).toContain("Missing .env");
    expect(fallback.confirmedFacts.length).toBeGreaterThan(0);
    expect(fallback.rootCauseRanking.length).toBe(1);
    expect(fallback.rootCauseRanking[0].cause).toContain(".env file was not created from template");
    expect(fallback.checklist.length).toBeGreaterThan(0);
  });

  it("CLI scan on healthy-node-project yields 0 findings identical to baseline", async () => {
    const fixturePath = path.join(fixturesDir, "healthy-node-project");
    let jsonOutput = "";
    vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
      jsonOutput += (msg ?? "") + "\n";
    });

    const exitCode = await runCli(["scan", fixturePath, "--json"]);
    expect(exitCode).toBe(0);

    const report = JSON.parse(jsonOutput.trim()) as Report;
    expect(report.findings.length).toBe(0);
  });

  it("CLI scan on broken-node-project yields exact baseline findings without AI", async () => {
    const fixturePath = path.join(fixturesDir, "broken-node-project");

    let server: net.Server | undefined;
    try {
      server = net.createServer();
      await new Promise<void>((resolve) => server!.listen(3000, "127.0.0.1", () => resolve()));
    } catch {
      // Port might already be in use
    }

    let jsonOutput = "";
    vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
      jsonOutput += (msg ?? "") + "\n";
    });

    try {
      await runCli(["scan", fixturePath, "--json"]);
      const report = JSON.parse(jsonOutput.trim()) as Report;
      const actualRuleIds = report.findings.map((f) => f.ruleId).sort();

      const expectedPath = path.join(fixturePath, "expected.json");
      const expectedRuleIds = (JSON.parse(fs.readFileSync(expectedPath, "utf-8")) as string[]).sort();

      expect(actualRuleIds).toEqual(expectedRuleIds);
    } finally {
      if (server) {
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      }
    }
  });

  it("CLI scan on broken-django-project yields exact baseline findings without AI", async () => {
    const fixturePath = path.join(fixturesDir, "broken-django-project");
    let jsonOutput = "";
    vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
      jsonOutput += (msg ?? "") + "\n";
    });

    await runCli(["scan", fixturePath, "--json"]);
    const report = JSON.parse(jsonOutput.trim()) as Report;
    const actualRuleIds = report.findings.map((f) => f.ruleId).sort();

    const expectedPath = path.join(fixturePath, "expected.json");
    const expectedRuleIds = (JSON.parse(fs.readFileSync(expectedPath, "utf-8")) as string[]).sort();

    expect(actualRuleIds).toEqual(expectedRuleIds);
  });

  it("CLI scan on broken-database-config yields exact baseline findings without AI", async () => {
    const fixturePath = path.join(fixturesDir, "broken-database-config");
    let jsonOutput = "";
    vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
      jsonOutput += (msg ?? "") + "\n";
    });

    await runCli(["scan", fixturePath, "--json"]);
    const report = JSON.parse(jsonOutput.trim()) as Report;
    const actualRuleIds = report.findings.map((f) => f.ruleId).sort();

    const expectedPath = path.join(fixturePath, "expected.json");
    const expectedRuleIds = (JSON.parse(fs.readFileSync(expectedPath, "utf-8")) as string[]).sort();

    expect(actualRuleIds).toEqual(expectedRuleIds);
  });
});
