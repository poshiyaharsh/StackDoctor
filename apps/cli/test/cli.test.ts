import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCli, parseCliArgs } from "stackdoctor";
import { validateReport, type Report } from "@stackdoctor/schemas";

describe("StackDoctor CLI (apps/cli)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-cli-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
    vi.restoreAllMocks();
  });

  it("parses CLI arguments correctly", () => {
    const opts1 = parseCliArgs(["scan", "./some/dir", "--json", "--no-color"]);
    expect(opts1.command).toBe("scan");
    expect(opts1.targetPath).toBe("./some/dir");
    expect(opts1.json).toBe(true);
    expect(opts1.noColor).toBe(true);

    const opts2 = parseCliArgs(["--version"]);
    expect(opts2.version).toBe(true);

    const opts3 = parseCliArgs(["--help"]);
    expect(opts3.help).toBe(true);

    const opts4 = parseCliArgs(["scan", "--out", "report.json"]);
    expect(opts4.outFile).toBe("report.json");
  });

  it("handles --help and --version with exit code 0", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitCodeHelp = await runCli(["--help"]);
    expect(exitCodeHelp).toBe(0);
    expect(logSpy).toHaveBeenCalled();

    logSpy.mockClear();
    const exitCodeVersion = await runCli(["--version"]);
    expect(exitCodeVersion).toBe(0);
    expect(logSpy).toHaveBeenCalled();
  });

  it("returns exit code 2 when an invalid path is specified", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitCode = await runCli(["scan", path.join(tempDir, "does-not-exist")]);
    expect(exitCode).toBe(2);
    expect(errSpy).toHaveBeenCalled();
  });

  it("runs end-to-end on examples/broken-node-project and triggers both sample rules", async () => {
    const brokenProjectPath = path.resolve(__dirname, "../../../examples/broken-node-project");

    let stdoutData = "";
    vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
      stdoutData += (msg ?? "") + "\n";
    });

    const exitCode = await runCli(["scan", brokenProjectPath, "--no-color"]);

    // Expect exit code 1 because NODE_DEPS_NOT_INSTALLED is high severity
    expect(exitCode).toBe(1);

    // Verify sections and findings in terminal output
    expect(stdoutData).toContain("=== StackDoctor Diagnostic Report ===");
    expect(stdoutData).toContain("NODE_DEPS_NOT_INSTALLED");
    expect(stdoutData).toContain("ENV_EXAMPLE_PRESENT_NO_ENV");
    expect(stdoutData).toContain("OBSERVED:");
    expect(stdoutData).toContain("POSSIBLE:");
    expect(stdoutData).toContain("Action     : npm install");
    expect(stdoutData).toContain("Action     : cp .env.example .env");
  });

  it("prints valid schema-compliant JSON when --json flag is passed", async () => {
    const brokenProjectPath = path.resolve(__dirname, "../../../examples/broken-node-project");

    let jsonOutput = "";
    vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
      jsonOutput += (msg ?? "") + "\n";
    });

    const exitCode = await runCli(["scan", brokenProjectPath, "--json"]);
    expect(exitCode).toBe(1);

    const parsed = JSON.parse(jsonOutput.trim()) as Report;
    expect(parsed.projectName).toBe("broken-node-project");

    const validation = validateReport(parsed);
    expect(validation.success).toBe(true);
    expect(parsed.findings.some((f) => f.ruleId === "NODE_DEPS_NOT_INSTALLED")).toBe(true);
    expect(parsed.findings.some((f) => f.ruleId === "ENV_EXAMPLE_PRESENT_NO_ENV")).toBe(true);
  });

  it("writes valid schema-compliant JSON file when --out flag is passed", async () => {
    const brokenProjectPath = path.resolve(__dirname, "../../../examples/broken-node-project");
    const outFilePath = path.join(tempDir, "diagnostic-report.json");

    vi.spyOn(console, "log").mockImplementation(() => {});

    const exitCode = await runCli(["scan", brokenProjectPath, "--out", outFilePath]);
    expect(exitCode).toBe(1);

    expect(fs.existsSync(outFilePath)).toBe(true);
    const content = fs.readFileSync(outFilePath, "utf-8");
    const parsed = JSON.parse(content) as Report;

    const validation = validateReport(parsed);
    expect(validation.success).toBe(true);
    // NODE_DEPS_NOT_INSTALLED, ENV_EXAMPLE_PRESENT_NO_ENV, LOCKFILE_MISSING
    expect(parsed.summary.totalFindings).toBe(3);
  });
});
