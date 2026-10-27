import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCli } from "../src/index.js";
import * as adapters from "@stackdoctor/adapters";

describe("CLI Safe Remediation `stackdoctor fix` (Run 5E)", () => {
  let tmpDir: string;
  let originalCi: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-fix-test-"));
    originalCi = process.env.CI;
    delete process.env.CI;
  });

  afterEach(() => {
    if (originalCi !== undefined) {
      process.env.CI = originalCi;
    } else {
      delete process.env.CI;
    }
    vi.restoreAllMocks();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it("fails with usage instructions when no rule or operation ID is specified", async () => {
    const code = await runCli(["fix"]);
    expect(code).toBe(1);
  });

  it("fails with allowlist guidance when an unknown or non-allowlisted operation ID is provided", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await runCli(["fix", "ARBITRARY_SHELL_COMMAND", tmpDir]);
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown or unsupported remediation operation")
    );
  });

  it("DRY RUN by default: prints planned command and details without spawning any child processes", async () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), "{}", "utf-8");
    fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "{}", "utf-8");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const runCommandSpy = vi.spyOn(adapters, "runCommand");

    const code = await runCli(["fix", "NODE_INSTALL_DEPENDENCIES", tmpDir]);

    expect(code).toBe(0);
    // CRITICAL: Assert NO child process was spawned during dry run
    expect(runCommandSpy).not.toHaveBeenCalled();

    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("DRY RUN");
    expect(logged).toContain("npm ci --ignore-scripts");
    expect(logged).toContain("node_modules directory is created");
    expect(logged).toContain("stackdoctor fix NODE_INSTALL_DEPENDENCIES --apply");
  });

  it("DRY RUN works via rule ID mapping (e.g. NODE_DEPS_NOT_INSTALLED -> NODE_INSTALL_DEPENDENCIES)", async () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), "{}", "utf-8");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const runCommandSpy = vi.spyOn(adapters, "runCommand");

    const code = await runCli(["fix", "NODE_DEPS_NOT_INSTALLED", tmpDir]);

    expect(code).toBe(0);
    expect(runCommandSpy).not.toHaveBeenCalled();

    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("Operation ID     : NODE_INSTALL_DEPENDENCIES");
  });

  it("refuses execution in --ci mode even with --apply flag", async () => {
    fs.writeFileSync(path.join(tmpDir, ".env.example"), "KEY=val\n", "utf-8");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await runCli(["fix", "COPY_ENV_EXAMPLE", tmpDir, "--apply", "--ci"]);
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Remediation execution is refused in --ci mode")
    );

    // .env should NOT be created
    expect(fs.existsSync(path.join(tmpDir, ".env"))).toBe(false);
  });

  it("refuses execution when process.env.CI is set", async () => {
    process.env.CI = "true";
    fs.writeFileSync(path.join(tmpDir, ".env.example"), "KEY=val\n", "utf-8");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await runCli(["fix", "COPY_ENV_EXAMPLE", tmpDir, "--apply"]);
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Remediation execution is refused in --ci mode")
    );
  });

  it("aborts execution when typed confirmation does not match operation ID", async () => {
    fs.writeFileSync(path.join(tmpDir, ".env.example"), "KEY=val\n", "utf-8");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await runCli(["fix", "COPY_ENV_EXAMPLE", tmpDir, "--apply"], {
      askConfirmation: async () => "yes" // User typed "yes" instead of exact "COPY_ENV_EXAMPLE"
    });

    expect(code).toBe(1);
    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("Aborted. Confirmation text did not match \"COPY_ENV_EXAMPLE\"");
    expect(fs.existsSync(path.join(tmpDir, ".env"))).toBe(false);
  });

  it("does not allow --yes flag to bypass typed confirmation for install/network operations", async () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), "{}", "utf-8");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const code = await runCli(["fix", "NODE_INSTALL_DEPENDENCIES", tmpDir, "--apply", "--yes"], {
      askConfirmation: async () => "wrong_confirmation"
    });

    expect(code).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("--yes flag cannot bypass typed confirmation")
    );
  });

  it("executes COPY_ENV_EXAMPLE with --apply and exact confirmation, re-running verification and logging history", async () => {
    fs.writeFileSync(path.join(tmpDir, ".env.example"), "APP_SECRET=canary-12345\n", "utf-8");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await runCli(["fix", "COPY_ENV_EXAMPLE", tmpDir, "--apply"], {
      askConfirmation: async () => "COPY_ENV_EXAMPLE"
    });

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, ".env"))).toBe(true);

    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("Remediation Verification:");
    expect(logged).toContain("Audit entry logged to .stackdoctor/fix-history.json");

    // Verify fix history log
    const historyPath = path.join(tmpDir, ".stackdoctor", "fix-history.json");
    expect(fs.existsSync(historyPath)).toBe(true);
    const history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
    expect(history).toHaveLength(1);
    expect(history[0].operationId).toBe("COPY_ENV_EXAMPLE");
    expect(history[0].result.success).toBe(true);
    expect(history[0].verification.passed).toBe(true);
  });

  it("refuses COPY_ENV_EXAMPLE when .env already exists (never overwrites)", async () => {
    fs.writeFileSync(path.join(tmpDir, ".env.example"), "KEY=val\n", "utf-8");
    fs.writeFileSync(path.join(tmpDir, ".env"), "KEY=existing-content\n", "utf-8");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await runCli(["fix", "COPY_ENV_EXAMPLE", tmpDir, "--apply"], {
      askConfirmation: async () => "COPY_ENV_EXAMPLE"
    });

    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Precondition failed for COPY_ENV_EXAMPLE")
    );
    expect(fs.readFileSync(path.join(tmpDir, ".env"), "utf-8")).toBe("KEY=existing-content\n");
  });

  it("refuses PYTHON_INSTALL_REQUIREMENTS when no .venv exists (venv-only guard)", async () => {
    fs.writeFileSync(path.join(tmpDir, "requirements.txt"), "flask==2.0.0\n", "utf-8");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await runCli(["fix", "PYTHON_INSTALL_REQUIREMENTS", tmpDir, "--apply"], {
      askConfirmation: async () => "PYTHON_INSTALL_REQUIREMENTS"
    });

    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("No local .venv directory found")
    );
  });

  it("rejects project directory path that does not exist", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const nonExistent = path.join(tmpDir, "does-not-exist");

    const code = await runCli(["fix", "COPY_ENV_EXAMPLE", nonExistent]);
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Project directory does not exist")
    );
  });

  it("safely handles special injection characters in path without shell execution", async () => {
    const safeSubdir = path.join(tmpDir, "proj-with-semi;calc");
    fs.mkdirSync(safeSubdir);
    fs.writeFileSync(path.join(safeSubdir, ".env.example"), "PORT=3000\n", "utf-8");

    const code = await runCli(["fix", "COPY_ENV_EXAMPLE", safeSubdir, "--apply", "--yes"]);
    expect(code).toBe(0);
    expect(fs.existsSync(path.join(safeSubdir, ".env"))).toBe(true);
  });
});
