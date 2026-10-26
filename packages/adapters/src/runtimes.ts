import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { CheckResult, Evidence } from "@stackdoctor/schemas";
import { runCommand } from "./exec.js";
import { getPlatformAdapter } from "./platform/index.js";

/**
 * Checks active Node.js runtime version. Never throws.
 */
export async function checkNodeRuntime(): Promise<CheckResult> {
  const startTime = Date.now();
  const res = await runCommand("node", ["-v"]);
  const durationMs = Date.now() - startTime;
  const now = new Date().toISOString();

  if (res.notFound) {
    return {
      id: "runtime_node",
      title: "Node.js runtime availability",
      category: "runtime",
      status: "failed",
      durationMs,
      evidence: [],
      error: "Node.js executable not found on PATH"
    };
  }

  const cleanVersion = res.stdout.trim();
  const evidence: Evidence = {
    id: "ev-node-version-installed",
    kind: "command_output",
    description: "Installed Node.js version from node -v",
    observed: `node -v output: ${cleanVersion}`,
    source: "node -v",
    collectedAt: now
  };

  return {
    id: "runtime_node",
    title: "Node.js runtime availability",
    category: "runtime",
    status: res.exitCode === 0 ? "passed" : "error",
    durationMs,
    evidence: [evidence],
    error: res.exitCode === 0 ? undefined : res.stderr
  };
}

/**
 * Checks package manager availability (npm, pnpm, yarn). Never throws.
 */
export async function checkPackageManagerRuntime(
  pkgManager: "npm" | "pnpm" | "yarn"
): Promise<CheckResult> {
  const startTime = Date.now();
  const res = await runCommand(pkgManager, ["-v"]);
  const durationMs = Date.now() - startTime;
  const now = new Date().toISOString();

  if (res.notFound) {
    return {
      id: `runtime_${pkgManager}`,
      title: `${pkgManager} package manager availability`,
      category: "runtime",
      status: "skipped",
      durationMs,
      evidence: [],
      error: `${pkgManager} is not installed or not available on PATH`
    };
  }

  const cleanVersion = res.stdout.trim();
  const evidence: Evidence = {
    id: `ev-${pkgManager}-version`,
    kind: "command_output",
    description: `Installed ${pkgManager} version from ${pkgManager} -v`,
    observed: `${pkgManager} -v output: ${cleanVersion}`,
    source: `${pkgManager} -v`,
    collectedAt: now
  };

  return {
    id: `runtime_${pkgManager}`,
    title: `${pkgManager} package manager availability`,
    category: "runtime",
    status: res.exitCode === 0 ? "passed" : "warning",
    durationMs,
    evidence: [evidence],
    error: res.exitCode === 0 ? undefined : res.stderr
  };
}

/**
 * Checks Python runtime version trying platform-appropriate executables. Never throws.
 */
export async function checkPythonRuntime(): Promise<CheckResult> {
  const startTime = Date.now();
  const platform = getPlatformAdapter();
  const executables = platform.getPythonExecutables();
  const now = new Date().toISOString();

  for (const exe of executables) {
    const res = await runCommand(exe, ["--version"]);
    if (!res.notFound && res.exitCode === 0) {
      const output = (res.stdout.trim() || res.stderr.trim());
      const evidence: Evidence = {
        id: "ev-python-version",
        kind: "command_output",
        description: `Python version from ${exe} --version`,
        observed: `${exe} --version output: ${output}`,
        source: `${exe} --version`,
        collectedAt: now
      };
      return {
        id: "runtime_python",
        title: "Python runtime availability",
        category: "runtime",
        status: "passed",
        durationMs: Date.now() - startTime,
        evidence: [evidence]
      };
    }
  }

  return {
    id: "runtime_python",
    title: "Python runtime availability",
    category: "runtime",
    status: "skipped",
    durationMs: Date.now() - startTime,
    evidence: [],
    error: `Python executable (${executables.join(", ")}) not found on PATH`
  };
}

/**
 * Checks whether an active Python virtual environment or local venv exists. Never throws.
 */
export function checkPythonVenvStatus(projectDir?: string): CheckResult {
  const now = new Date().toISOString();
  const activeVenv = process.env.VIRTUAL_ENV;

  if (activeVenv) {
    const evidence: Evidence = {
      id: "ev-python-active-venv",
      kind: "environment_variable",
      description: "Active Python virtual environment in process environment",
      observed: `VIRTUAL_ENV environment variable is set to a virtualenv directory`,
      source: "process.env.VIRTUAL_ENV",
      collectedAt: now
    };
    return {
      id: "runtime_python_venv",
      title: "Python virtual environment status",
      category: "runtime",
      status: "passed",
      durationMs: 0,
      evidence: [evidence]
    };
  }

  if (projectDir) {
    const venvDirs = [".venv", "venv", "env", ".env_py"];
    for (const d of venvDirs) {
      const fullPath = path.join(projectDir, d);
      if (fs.existsSync(fullPath)) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const evidence: Evidence = {
              id: "ev-python-local-venv-dir",
              kind: "file_presence",
              description: `Found local virtual environment directory at ${d}`,
              observed: `Virtual environment directory exists at ${d}`,
              source: d,
              collectedAt: now
            };
            return {
              id: "runtime_python_venv",
              title: "Python virtual environment status",
              category: "runtime",
              status: "passed",
              durationMs: 0,
              evidence: [evidence]
            };
          }
        } catch {
          // Continue safely
        }
      }
    }
  }

  return {
    id: "runtime_python_venv",
    title: "Python virtual environment status",
    category: "runtime",
    status: "warning",
    durationMs: 0,
    evidence: [],
    error: "No active Python virtual environment detected (VIRTUAL_ENV not set and no .venv found)"
  };
}

/**
 * Checks Git CLI availability. Never throws.
 */
export async function checkGitRuntime(): Promise<CheckResult> {
  const startTime = Date.now();
  const res = await runCommand("git", ["--version"]);
  const durationMs = Date.now() - startTime;
  const now = new Date().toISOString();

  if (res.notFound) {
    return {
      id: "runtime_git",
      title: "Git CLI availability",
      category: "runtime",
      status: "warning",
      durationMs,
      evidence: [],
      error: "Git executable not found on PATH"
    };
  }

  const evidence: Evidence = {
    id: "ev-git-version",
    kind: "command_output",
    description: "Git version output",
    observed: res.stdout.trim(),
    source: "git --version",
    collectedAt: now
  };

  return {
    id: "runtime_git",
    title: "Git CLI availability",
    category: "runtime",
    status: res.exitCode === 0 ? "passed" : "warning",
    durationMs,
    evidence: [evidence],
    error: res.exitCode === 0 ? undefined : res.stderr
  };
}

/**
 * Checks Docker availability (only when Docker/Compose files were detected). Never throws.
 */
export async function checkDockerRuntime(): Promise<CheckResult> {
  const startTime = Date.now();
  const res = await runCommand("docker", ["--version"]);
  const durationMs = Date.now() - startTime;
  const now = new Date().toISOString();

  if (res.notFound) {
    return {
      id: "runtime_docker",
      title: "Docker availability",
      category: "runtime",
      status: "warning",
      durationMs,
      evidence: [],
      error: "Docker executable not found on PATH"
    };
  }

  const evidence: Evidence = {
    id: "ev-docker-version",
    kind: "command_output",
    description: "Docker CLI version output",
    observed: res.stdout.trim(),
    source: "docker --version",
    collectedAt: now
  };

  return {
    id: "runtime_docker",
    title: "Docker availability",
    category: "runtime",
    status: res.exitCode === 0 ? "passed" : "warning",
    durationMs,
    evidence: [evidence],
    error: res.exitCode === 0 ? undefined : res.stderr
  };
}
