import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  checkNodeRuntime,
  checkPackageManagerRuntime,
  checkPythonRuntime,
  checkPythonVenvStatus,
  checkGitRuntime,
  checkDockerRuntime
} from "@stackdoctor/adapters";
import { CheckResultSchema } from "@stackdoctor/schemas";

describe("Runtime Checks (runtimes.ts)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-runtimes-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it("checks Node.js runtime and validates schema", async () => {
    const result = await checkNodeRuntime();
    expect(CheckResultSchema.safeParse(result).success).toBe(true);
    expect(result.id).toBe("runtime_node");
    expect(result.category).toBe("runtime");
    // In our test environment, node is installed and running
    expect(result.status).toBe("passed");
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence[0]?.source).toBe("node -v");
  });

  it("checks package manager runtimes (npm, pnpm, yarn) without throwing", async () => {
    const npmResult = await checkPackageManagerRuntime("npm");
    expect(CheckResultSchema.safeParse(npmResult).success).toBe(true);
    expect(npmResult.id).toBe("runtime_npm");
    expect(["passed", "warning", "skipped"]).toContain(npmResult.status);

    const pnpmResult = await checkPackageManagerRuntime("pnpm");
    expect(CheckResultSchema.safeParse(pnpmResult).success).toBe(true);
    expect(pnpmResult.id).toBe("runtime_pnpm");
    expect(["passed", "warning", "skipped"]).toContain(pnpmResult.status);

    const yarnResult = await checkPackageManagerRuntime("yarn");
    expect(CheckResultSchema.safeParse(yarnResult).success).toBe(true);
    expect(yarnResult.id).toBe("runtime_yarn");
    expect(["passed", "warning", "skipped"]).toContain(yarnResult.status);
  });

  it("checks Python runtime without throwing and respects platform-specific executables", async () => {
    const result = await checkPythonRuntime();
    expect(CheckResultSchema.safeParse(result).success).toBe(true);
    expect(result.id).toBe("runtime_python");
    expect(["passed", "skipped"]).toContain(result.status);
  });

  it("detects active Python virtual environment from process.env.VIRTUAL_ENV", () => {
    const originalEnv = process.env.VIRTUAL_ENV;
    try {
      process.env.VIRTUAL_ENV = "/mock/env/path";
      const result = checkPythonVenvStatus(tempDir);
      expect(CheckResultSchema.safeParse(result).success).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence[0]?.kind).toBe("environment_variable");
    } finally {
      if (originalEnv !== undefined) {
        process.env.VIRTUAL_ENV = originalEnv;
      } else {
        delete process.env.VIRTUAL_ENV;
      }
    }
  });

  it("detects local Python virtual environment folder (.venv)", () => {
    const originalEnv = process.env.VIRTUAL_ENV;
    delete process.env.VIRTUAL_ENV;
    try {
      const venvPath = path.join(tempDir, ".venv");
      fs.mkdirSync(venvPath);

      const result = checkPythonVenvStatus(tempDir);
      expect(CheckResultSchema.safeParse(result).success).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence[0]?.source).toBe(".venv");
    } finally {
      if (originalEnv !== undefined) {
        process.env.VIRTUAL_ENV = originalEnv;
      }
    }
  });

  it("returns warning when neither VIRTUAL_ENV nor local venv exists", () => {
    const originalEnv = process.env.VIRTUAL_ENV;
    delete process.env.VIRTUAL_ENV;
    try {
      const result = checkPythonVenvStatus(tempDir);
      expect(CheckResultSchema.safeParse(result).success).toBe(true);
      expect(result.status).toBe("warning");
      expect(result.error).toContain("No active Python virtual environment detected");
    } finally {
      if (originalEnv !== undefined) {
        process.env.VIRTUAL_ENV = originalEnv;
      }
    }
  });

  it("checks Git runtime and validates schema", async () => {
    const result = await checkGitRuntime();
    expect(CheckResultSchema.safeParse(result).success).toBe(true);
    expect(result.id).toBe("runtime_git");
    expect(["passed", "warning"]).toContain(result.status);
  });

  it("checks Docker runtime and validates schema", async () => {
    const result = await checkDockerRuntime();
    expect(CheckResultSchema.safeParse(result).success).toBe(true);
    expect(result.id).toBe("runtime_docker");
    expect(["passed", "warning"]).toContain(result.status);
  });
});
