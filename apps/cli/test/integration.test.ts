import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { runCli } from "stackdoctor";
import type { Report } from "@stackdoctor/schemas";

describe("Phase 2 End-to-End Fixture Integration Tests", () => {
  const fixturesDir = path.resolve(__dirname, "../../../examples");

  it("evaluates examples/healthy-node-project with zero findings (0% false positives)", async () => {
    const fixturePath = path.join(fixturesDir, "healthy-node-project");
    let jsonOutput = "";
    vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
      jsonOutput += (msg ?? "") + "\n";
    });

    const exitCode = await runCli(["scan", fixturePath, "--json"]);
    expect(exitCode).toBe(0);

    const report = JSON.parse(jsonOutput.trim()) as Report;
    const actualRuleIds = report.findings.map((f) => f.ruleId).sort();

    const expectedPath = path.join(fixturePath, "expected.json");
    const expectedRuleIds = (JSON.parse(fs.readFileSync(expectedPath, "utf-8")) as string[]).sort();

    expect(actualRuleIds).toEqual(expectedRuleIds);
    expect(report.findings.length).toBe(0);
  });

  it("evaluates examples/broken-django-project matching expected.json exactly", async () => {
    const fixturePath = path.join(fixturesDir, "broken-django-project");
    let jsonOutput = "";
    vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
      jsonOutput += (msg ?? "") + "\n";
    });

    const exitCode = await runCli(["scan", fixturePath, "--json"]);
    expect(exitCode).toBe(1);

    const report = JSON.parse(jsonOutput.trim()) as Report;
    const actualRuleIds = report.findings.map((f) => f.ruleId).sort();

    const expectedPath = path.join(fixturePath, "expected.json");
    const expectedRuleIds = (JSON.parse(fs.readFileSync(expectedPath, "utf-8")) as string[]).sort();

    expect(actualRuleIds).toEqual(expectedRuleIds);
  });

  it("evaluates examples/broken-database-config matching expected.json exactly", async () => {
    const fixturePath = path.join(fixturesDir, "broken-database-config");
    let jsonOutput = "";
    vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
      jsonOutput += (msg ?? "") + "\n";
    });

    const exitCode = await runCli(["scan", fixturePath, "--json"]);
    expect(exitCode).toBe(1);

    const report = JSON.parse(jsonOutput.trim()) as Report;
    const actualRuleIds = report.findings.map((f) => f.ruleId).sort();

    const expectedPath = path.join(fixturePath, "expected.json");
    const expectedRuleIds = (JSON.parse(fs.readFileSync(expectedPath, "utf-8")) as string[]).sort();

    expect(actualRuleIds).toEqual(expectedRuleIds);
  });

  it("evaluates examples/broken-node-project with active port listener matching expected.json exactly", async () => {
    const fixturePath = path.join(fixturesDir, "broken-node-project");

    // Start a listener on port 3000 to trigger PORT_IN_USE
    const server = net.createServer();
    await new Promise<void>((resolve) => {
      server.listen(3000, "127.0.0.1", () => resolve());
    });

    try {
      let jsonOutput = "";
      vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
        jsonOutput += (msg ?? "") + "\n";
      });

      const exitCode = await runCli(["scan", fixturePath, "--json"]);
      expect(exitCode).toBe(1);

      const report = JSON.parse(jsonOutput.trim()) as Report;
      const actualRuleIds = report.findings.map((f) => f.ruleId).sort();

      const expectedPath = path.join(fixturePath, "expected.json");
      const expectedRuleIds = (JSON.parse(fs.readFileSync(expectedPath, "utf-8")) as string[]).sort();

      expect(actualRuleIds).toEqual(expectedRuleIds);
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });
});
