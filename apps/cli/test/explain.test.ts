import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCli } from "../src/index.js";
import { createDefaultRuleRegistry } from "@stackdoctor/rules";

describe("StackDoctor CLI 'explain' Command (Run 4D)", () => {
  const originalLog = console.log;
  const originalError = console.error;

  const tempDir = path.join(os.tmpdir(), `stk-explain-cli-test-${Date.now()}`);
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
    console.log = originalLog;
    console.error = originalError;
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("prints formatted text output for a known rule", async () => {
    const exitCode = await runCli(["explain", "NODE_DEPS_NOT_INSTALLED"]);
    expect(exitCode).toBe(0);

    const fullOutput = loggedOutput.join("\n");
    expect(fullOutput).toContain("=== StackDoctor Diagnostic Rule: NODE_DEPS_NOT_INSTALLED ===");
    expect(fullOutput).toContain("Title        : Node.js dependencies not installed");
    expect(fullOutput).toContain("Severity     : HIGH");
    expect(fullOutput).toContain("Confidence   : confirmed");
    expect(fullOutput).toContain("--- Description ---");
    expect(fullOutput).toContain("--- Evidence Required (Observed Facts) ---");
    expect(fullOutput).toContain("--- Recommended Checks ---");
    expect(fullOutput).toContain("--- Remediation Actions ---");
    expect(fullOutput).toContain("--- Verification ---");
    expect(fullOutput).toContain("--- Documentation References ---");
    expect(fullOutput).toContain("https://docs.npmjs.com/cli/v10/commands/npm-install");
  });

  it("supports case-insensitive rule lookup", async () => {
    const exitCode = await runCli(["explain", "node_deps_not_installed"]);
    expect(exitCode).toBe(0);
    const fullOutput = loggedOutput.join("\n");
    expect(fullOutput).toContain("=== StackDoctor Diagnostic Rule: NODE_DEPS_NOT_INSTALLED ===");
  });

  it("produces valid JSON when --json flag is passed", async () => {
    const exitCode = await runCli(["explain", "NODE_DEPS_NOT_INSTALLED", "--json"]);
    expect(exitCode).toBe(0);

    const fullOutput = loggedOutput.join("\n");
    const parsed = JSON.parse(fullOutput);
    expect(parsed.id).toBe("NODE_DEPS_NOT_INSTALLED");
    expect(parsed.title).toBe("Node.js dependencies not installed");
    expect(parsed.severity).toBe("high");
    expect(parsed.confidence).toBe("confirmed");
    expect(Array.isArray(parsed.docs)).toBe(true);
    expect(parsed.docs[0]).toContain("https://docs.npmjs.com");
    expect(Array.isArray(parsed.remediation)).toBe(true);
  });

  it("produces valid JSON when --format json is passed", async () => {
    const exitCode = await runCli(["explain", "PORT_IN_USE", "--format", "json"]);
    expect(exitCode).toBe(0);

    const fullOutput = loggedOutput.join("\n");
    const parsed = JSON.parse(fullOutput);
    expect(parsed.id).toBe("PORT_IN_USE");
    expect(parsed.docs[0]).toBe("https://nodejs.org/api/errors.html#eaddrinuse");
  });

  it("works for every built-in rule in the default registry", async () => {
    const registry = createDefaultRuleRegistry();
    const rules = registry.list();
    expect(rules.length).toBeGreaterThanOrEqual(20);

    for (const rule of rules) {
      loggedOutput = [];
      const code = await runCli(["explain", rule.id]);
      expect(code).toBe(0);
      const text = loggedOutput.join("\n");
      expect(text).toContain(`=== StackDoctor Diagnostic Rule: ${rule.id} ===`);
      expect(text).toContain(rule.title);
      expect(text).toContain(rule.verification);
    }
  });

  it("returns exit code 2 and suggests similar IDs for unknown rule", async () => {
    const exitCode = await runCli(["explain", "NODE_DEPS_MISSING"]);
    expect(exitCode).toBe(2);

    const fullError = errorOutput.join("\n");
    expect(fullError).toContain('Error: Unknown diagnostic rule ID "NODE_DEPS_MISSING".');
    expect(fullError).toContain("Did you mean one of these?");
    expect(fullError).toContain("NODE_DEPS_NOT_INSTALLED");
    expect(fullError).toContain("Run `stackdoctor rules` to list all supported diagnostic rules.");
  });

  it("returns exit code 3 when rule ID argument is missing", async () => {
    const exitCode = await runCli(["explain"]);
    expect(exitCode).toBe(3);

    const fullError = errorOutput.join("\n");
    expect(fullError).toContain("Missing rule ID");
  });

  it("writes output to file when --out flag is provided", async () => {
    const outFile = path.join(tempDir, "explain-output.txt");
    const exitCode = await runCli(["explain", "NODE_DEPS_NOT_INSTALLED", "--out", outFile]);
    expect(exitCode).toBe(0);
    expect(fs.existsSync(outFile)).toBe(true);

    const fileContent = fs.readFileSync(outFile, "utf-8");
    expect(fileContent).toContain("=== StackDoctor Diagnostic Rule: NODE_DEPS_NOT_INSTALLED ===");
  });

  it("matches snapshot for explain output", async () => {
    await runCli(["explain", "NODE_DEPS_NOT_INSTALLED"]);
    const fullOutput = loggedOutput.join("\n");
    expect(fullOutput).toMatchSnapshot();
  });
});
