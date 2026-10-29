import { execFile, type ExecFileOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { redactText } from "@stackdoctor/core";

export const ALLOWED_EXECUTABLES = new Set([
  "node",
  "npm",
  "pnpm",
  "yarn",
  "python",
  "python3",
  "py",
  "java",
  "git",
  "docker",
  "docker-compose",
  "netstat",
  "ss",
  "lsof"
]);

export interface RunCommandOptions {
  cwd?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  onOutput?: (chunk: string, stream: "stdout" | "stderr") => void;
}

export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
  notFound: boolean;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_OUTPUT_BYTES = 100 * 1024; // 100 KB

export function isExecutableAllowlisted(executable: string, cwd?: string): boolean {
  if (ALLOWED_EXECUTABLES.has(executable)) {
    return true;
  }
  if (path.resolve(executable) === path.resolve(process.execPath)) {
    return true;
  }
  if (cwd) {
    const resolvedPath = path.resolve(cwd, executable);
    const resolvedCwd = path.resolve(cwd);
    const venvDir = path.join(resolvedCwd, ".venv");
    const relativeToVenv = path.relative(venvDir, resolvedPath);
    const isInsideVenv = !relativeToVenv.startsWith("..") && !path.isAbsolute(relativeToVenv);
    if (isInsideVenv) {
      const baseName = path.basename(resolvedPath).replace(/\.exe$/i, "").toLowerCase();
      if (["python", "python3", "pip", "pip3"].includes(baseName)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Executes a fixed executable with argument array safely.
 * Non-negotiable rules:
 * - NEVER uses shell: true
 * - Rejects non-allowlisted executables
 * - Enforces timeouts and output byte limits
 * - Redacts secrets from stdout and stderr
 * - Captures missing executables safely without throwing
 */
export async function runCommand(
  executable: string,
  args: string[] = [],
  options: RunCommandOptions = {}
): Promise<CommandResult> {
  if (!isExecutableAllowlisted(executable, options.cwd)) {
    throw new Error(
      `Executable not allowlisted: "${executable}". Allowed: ${Array.from(ALLOWED_EXECUTABLES).join(", ")}`
    );
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

  // On Windows, npm/pnpm/yarn are shell scripts (.cmd), which Node 20+ cannot spawn directly
  // with execFile without shell:true. We safely resolve to node running the CLI script.
  let spawnFile = executable;
  let spawnArgs = [...args];

  if (process.platform === "win32") {
    if (executable === "npm") {
      const nodeDir = path.dirname(process.execPath);
      const npmCli = path.join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js");
      if (fs.existsSync(npmCli)) {
        spawnFile = process.execPath;
        spawnArgs = [npmCli, ...args];
      }
    } else if (executable === "pnpm") {
      const nodeDir = path.dirname(process.execPath);
      const pnpmCli = path.join(nodeDir, "node_modules", "pnpm", "bin", "pnpm.cjs");
      if (fs.existsSync(pnpmCli)) {
        spawnFile = process.execPath;
        spawnArgs = [pnpmCli, ...args];
      }
    } else if (executable === "yarn") {
      const nodeDir = path.dirname(process.execPath);
      const yarnCli = path.join(nodeDir, "node_modules", "yarn", "bin", "yarn.js");
      if (fs.existsSync(yarnCli)) {
        spawnFile = process.execPath;
        spawnArgs = [yarnCli, ...args];
      }
    }
  }

  const execOptions: ExecFileOptions = {
    cwd: options.cwd,
    timeout: timeoutMs,
    maxBuffer: maxOutputBytes * 2,
    shell: false, // EXPLICITLY FALSE: Shell injection is strictly prevented
    windowsHide: true
  };

  return new Promise<CommandResult>((resolve) => {
    let truncated = false;

    const child = execFile(spawnFile, spawnArgs, execOptions, (error, stdout, stderr) => {
      const rawStdout = typeof stdout === "string" ? stdout : stdout?.toString("utf-8") || "";
      const rawStderr = typeof stderr === "string" ? stderr : stderr?.toString("utf-8") || "";

      let finalStdout = rawStdout;
      let finalStderr = rawStderr;

      if (Buffer.byteLength(finalStdout, "utf-8") > maxOutputBytes) {
        finalStdout = Buffer.from(finalStdout, "utf-8").subarray(0, maxOutputBytes).toString("utf-8");
        truncated = true;
      }

      if (Buffer.byteLength(finalStderr, "utf-8") > maxOutputBytes) {
        finalStderr = Buffer.from(finalStderr, "utf-8").subarray(0, maxOutputBytes).toString("utf-8");
        truncated = true;
      }

      if (error) {
        // Missing executable (ENOENT) or invalid spawn on missing binary
        if (
          error.code === "ENOENT" ||
          (error as NodeJS.ErrnoException).code === "ENOENT" ||
          (error as NodeJS.ErrnoException).code === "EINVAL"
        ) {
          return resolve({
            exitCode: null,
            stdout: "",
            stderr: "",
            timedOut: false,
            truncated: false,
            notFound: true
          });
        }

        // Child process was killed due to timeout
        const isTimedOut =
          !!(error.killed || error.signal === "SIGTERM" || (error as NodeJS.ErrnoException).code === "ETIMEDOUT");
        if (isTimedOut) {
          return resolve({
            exitCode: null,
            stdout: redactText(finalStdout),
            stderr: redactText(finalStderr),
            timedOut: true,
            truncated,
            notFound: false
          });
        }

        const exitCode = typeof error.code === "number" ? error.code : 1;
        return resolve({
          exitCode,
          stdout: redactText(finalStdout),
          stderr: redactText(finalStderr),
          timedOut: false,
          truncated,
          notFound: false
        });
      }

      return resolve({
        exitCode: 0,
        stdout: redactText(finalStdout),
        stderr: redactText(finalStderr),
        timedOut: false,
        truncated,
        notFound: false
      });
    });

    if (options.onOutput) {
      child.stdout?.on("data", (chunk: Buffer | string) => {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
        options.onOutput?.(redactText(text), "stdout");
      });
      child.stderr?.on("data", (chunk: Buffer | string) => {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
        options.onOutput?.(redactText(text), "stderr");
      });
    }

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT" || err.code === "EINVAL") {
        resolve({
          exitCode: null,
          stdout: "",
          stderr: "",
          timedOut: false,
          truncated: false,
          notFound: true
        });
      }
    });
  });
}
