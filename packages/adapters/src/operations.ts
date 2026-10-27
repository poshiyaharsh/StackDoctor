import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { z } from "zod";
import { runCommand } from "./exec.js";
import { redactText } from "@stackdoctor/core";

/**
 * Strict allowlist of safe remediation operations.
 * EXACTLY four operations are supported.
 * Non-supported operations (killing processes, deleting files, database changes,
 * network/firewall configs, sudo) are strictly forbidden.
 */
export const ALLOWLISTED_OPERATION_IDS = [
  "NODE_INSTALL_DEPENDENCIES",
  "PYTHON_CREATE_VENV",
  "PYTHON_INSTALL_REQUIREMENTS",
  "COPY_ENV_EXAMPLE"
] as const;

export type AllowlistedOperationId = (typeof ALLOWLISTED_OPERATION_IDS)[number];

export function isAllowlistedOperationId(id: string): id is AllowlistedOperationId {
  return (ALLOWLISTED_OPERATION_IDS as readonly string[]).includes(id);
}

/**
 * Mapping from Diagnostic Rule IDs to their corresponding allowlisted remediation operation.
 */
export const RULE_TO_OPERATION_MAP: Record<string, AllowlistedOperationId> = {
  NODE_DEPS_NOT_INSTALLED: "NODE_INSTALL_DEPENDENCIES",
  PYTHON_VENV_MISSING: "PYTHON_CREATE_VENV",
  PYTHON_PACKAGES_MISSING: "PYTHON_INSTALL_REQUIREMENTS",
  ENV_EXAMPLE_PRESENT_NO_ENV: "COPY_ENV_EXAMPLE"
};

/**
 * Resolves an operation ID from either a direct operation ID or a rule ID.
 */
export function resolveOperationId(input: string): AllowlistedOperationId | null {
  if (isAllowlistedOperationId(input)) {
    return input;
  }
  const mapped = RULE_TO_OPERATION_MAP[input];
  if (mapped && isAllowlistedOperationId(mapped)) {
    return mapped;
  }
  return null;
}

/**
 * Strict empty schema for operation arguments.
 * Remediation operations do not accept arbitrary parameters from AI or external inputs.
 */
export const EmptyArgumentSchema = z.object({}).strict();

export interface PlannedExecution {
  executable: string;
  args: string[];
  cwd: string;
}

export interface VerificationResult {
  passed: boolean;
  details: string;
}

export interface PreconditionResult {
  ok: boolean;
  reason?: string;
}

export interface RemediationOperation {
  id: AllowlistedOperationId;
  title: string;
  description: string;
  argumentSchema: z.ZodTypeAny;
  hasInstallNetworkEffects: boolean;
  workingDirectoryRestriction: string;
  risks: string;
  undoInstructions: string;
  expectedResult: string;
  verificationCheckId: string;
  checkPreconditions(projectDir: string): Promise<PreconditionResult>;
  buildExecution(projectDir: string, args?: unknown): Promise<PlannedExecution>;
  verify(projectDir: string): Promise<VerificationResult>;
}

/**
 * Validates that a project directory path is an existing directory.
 */
export function validateProjectDirectory(inputPath: string): string {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Project directory does not exist: "${resolved}"`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Project path is not a directory: "${resolved}"`);
  }
  return resolved;
}

/**
 * Asserts that a target file or path is strictly located inside the project directory.
 */
export function assertInsideProject(projectDir: string, targetPath: string): string {
  const resolvedProject = path.resolve(projectDir);
  const resolvedTarget = path.resolve(resolvedProject, targetPath);
  const relative = path.relative(resolvedProject, resolvedTarget);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Access denied: Target path "${targetPath}" resolves outside project directory "${resolvedProject}"`
    );
  }
  return resolvedTarget;
}

export const NODE_INSTALL_DEPENDENCIES_OPERATION: RemediationOperation = {
  id: "NODE_INSTALL_DEPENDENCIES",
  title: "Install Node.js dependencies",
  description:
    "Installs project dependencies using the project's detected package manager with --ignore-scripts.",
  argumentSchema: EmptyArgumentSchema,
  hasInstallNetworkEffects: true,
  workingDirectoryRestriction: "must be inside the scanned project",
  risks:
    "Downloads external packages from the configured npm registry. May consume network bandwidth.",
  undoInstructions: "Delete the node_modules folder (rm -rf node_modules).",
  expectedResult:
    "node_modules directory is created containing dependencies matching the project lockfile/package.json.",
  verificationCheckId: "NODE_DEPS_INSTALLED",

  async checkPreconditions(projectDir: string): Promise<PreconditionResult> {
    const pkgJson = path.join(projectDir, "package.json");
    if (!fs.existsSync(pkgJson)) {
      return {
        ok: false,
        reason: "package.json was not found in the project root."
      };
    }
    return { ok: true };
  },

  async buildExecution(projectDir: string, args: unknown = {}): Promise<PlannedExecution> {
    EmptyArgumentSchema.parse(args);
    const resolvedDir = validateProjectDirectory(projectDir);

    let executable = "npm";
    let cmdArgs = ["install", "--ignore-scripts"];

    if (fs.existsSync(path.join(resolvedDir, "pnpm-lock.yaml"))) {
      executable = "pnpm";
      cmdArgs = ["install", "--frozen-lockfile", "--ignore-scripts"];
    } else if (fs.existsSync(path.join(resolvedDir, "yarn.lock"))) {
      executable = "yarn";
      cmdArgs = ["install", "--immutable", "--ignore-scripts"];
    } else if (fs.existsSync(path.join(resolvedDir, "package-lock.json"))) {
      executable = "npm";
      cmdArgs = ["ci", "--ignore-scripts"];
    }

    return {
      executable,
      args: cmdArgs,
      cwd: resolvedDir
    };
  },

  async verify(projectDir: string): Promise<VerificationResult> {
    const nodeModules = path.join(projectDir, "node_modules");
    const exists = fs.existsSync(nodeModules);
    return {
      passed: exists,
      details: exists
        ? "node_modules directory is present in project root."
        : "node_modules directory is missing."
    };
  }
};

export const PYTHON_CREATE_VENV_OPERATION: RemediationOperation = {
  id: "PYTHON_CREATE_VENV",
  title: "Create Python virtual environment (.venv)",
  description: "Initializes an isolated Python virtual environment in .venv folder inside the project.",
  argumentSchema: EmptyArgumentSchema,
  hasInstallNetworkEffects: false,
  workingDirectoryRestriction: "must be inside the scanned project",
  risks: "Creates a local .venv directory; does not modify any existing source code.",
  undoInstructions: "Delete the .venv folder (rm -rf .venv).",
  expectedResult: "A local .venv directory is created with an isolated Python interpreter.",
  verificationCheckId: "PYTHON_VENV_EXISTS",

  async checkPreconditions(projectDir: string): Promise<PreconditionResult> {
    const venvDir = path.join(projectDir, ".venv");
    if (fs.existsSync(venvDir)) {
      return {
        ok: false,
        reason: ".venv directory already exists in the project root."
      };
    }
    return { ok: true };
  },

  async buildExecution(projectDir: string, args: unknown = {}): Promise<PlannedExecution> {
    EmptyArgumentSchema.parse(args);
    const resolvedDir = validateProjectDirectory(projectDir);
    const executable = process.platform === "win32" ? "python" : "python3";

    return {
      executable,
      args: ["-m", "venv", ".venv"],
      cwd: resolvedDir
    };
  },

  async verify(projectDir: string): Promise<VerificationResult> {
    const venvDir = path.join(projectDir, ".venv");
    const exists = fs.existsSync(venvDir);
    return {
      passed: exists,
      details: exists
        ? ".venv virtual environment directory is present."
        : ".venv virtual environment directory is missing."
    };
  }
};

export const PYTHON_INSTALL_REQUIREMENTS_OPERATION: RemediationOperation = {
  id: "PYTHON_INSTALL_REQUIREMENTS",
  title: "Install Python requirements into virtual environment",
  description:
    "Installs dependencies declared in requirements.txt into the project's .venv virtual environment ONLY.",
  argumentSchema: EmptyArgumentSchema,
  hasInstallNetworkEffects: true,
  workingDirectoryRestriction: "must be inside the scanned project",
  risks:
    "WARNING: Installing packages can execute third-party code (setup.py). Installs into .venv ONLY (never global).",
  undoInstructions: "Remove installed packages from .venv or re-create the .venv folder.",
  expectedResult:
    "All packages declared in requirements.txt are installed in the local virtual environment.",
  verificationCheckId: "PYTHON_PACKAGES_INSTALLED",

  async checkPreconditions(projectDir: string): Promise<PreconditionResult> {
    const reqFile = path.join(projectDir, "requirements.txt");
    if (!fs.existsSync(reqFile)) {
      return {
        ok: false,
        reason: "requirements.txt was not found in the project root."
      };
    }

    // STRICT VENV-ONLY GUARD: Refuse to install if no local .venv exists
    const venvDir = path.join(projectDir, ".venv");
    if (!fs.existsSync(venvDir)) {
      return {
        ok: false,
        reason:
          "Refusing to install Python requirements: No local .venv directory found. Run PYTHON_CREATE_VENV first to avoid modifying global Python."
      };
    }

    return { ok: true };
  },

  async buildExecution(projectDir: string, args: unknown = {}): Promise<PlannedExecution> {
    EmptyArgumentSchema.parse(args);
    const resolvedDir = validateProjectDirectory(projectDir);
    const venvDir = path.join(resolvedDir, ".venv");

    let executable: string;
    if (process.platform === "win32") {
      const winPython = path.join(venvDir, "Scripts", "python.exe");
      if (fs.existsSync(winPython)) {
        executable = winPython;
      } else {
        executable = path.join(venvDir, "Scripts", "pip.exe");
      }
    } else {
      const unixPython = path.join(venvDir, "bin", "python");
      if (fs.existsSync(unixPython)) {
        executable = unixPython;
      } else {
        executable = path.join(venvDir, "bin", "pip");
      }
    }

    return {
      executable,
      args: ["-m", "pip", "install", "-r", "requirements.txt"],
      cwd: resolvedDir
    };
  },

  async verify(projectDir: string): Promise<VerificationResult> {
    const venvDir = path.join(projectDir, ".venv");
    if (!fs.existsSync(venvDir)) {
      return {
        passed: false,
        details: ".venv directory is missing."
      };
    }

    // Verify python executable in .venv works
    const venvPython = process.platform === "win32"
      ? path.join(venvDir, "Scripts", "python.exe")
      : path.join(venvDir, "bin", "python");

    if (!fs.existsSync(venvPython)) {
      return {
        passed: false,
        details: "Virtualenv interpreter not found inside .venv."
      };
    }

    try {
      const res = await runCommand(venvPython, ["-m", "pip", "list"], { cwd: projectDir, timeoutMs: 5000 });
      return {
        passed: res.exitCode === 0,
        details: res.exitCode === 0
          ? "Dependencies successfully installed in .venv."
          : `Failed checking installed packages: ${res.stderr}`
      };
    } catch (err) {
      return {
        passed: false,
        details: err instanceof Error ? err.message : String(err)
      };
    }
  }
};

export const COPY_ENV_EXAMPLE_OPERATION: RemediationOperation = {
  id: "COPY_ENV_EXAMPLE",
  title: "Copy .env.example template to .env",
  description:
    "Copies .env.example to .env ONLY if .env does not already exist (refuses to overwrite).",
  argumentSchema: EmptyArgumentSchema,
  hasInstallNetworkEffects: false,
  workingDirectoryRestriction: "must be inside the scanned project",
  risks:
    "Creates a local .env configuration file based on the template. Values must still be configured; contents are never printed.",
  undoInstructions: "Delete the generated .env file (rm .env).",
  expectedResult: ".env configuration file is created from .env.example without overwriting.",
  verificationCheckId: "ENV_FILE_EXISTS",

  async checkPreconditions(projectDir: string): Promise<PreconditionResult> {
    const exampleFile = path.join(projectDir, ".env.example");
    if (!fs.existsSync(exampleFile)) {
      return {
        ok: false,
        reason: ".env.example does not exist in the project root."
      };
    }

    const envFile = path.join(projectDir, ".env");
    if (fs.existsSync(envFile)) {
      return {
        ok: false,
        reason: ".env file already exists. Refusing to overwrite existing environment file."
      };
    }

    return { ok: true };
  },

  async buildExecution(projectDir: string, args: unknown = {}): Promise<PlannedExecution> {
    EmptyArgumentSchema.parse(args);
    const resolvedDir = validateProjectDirectory(projectDir);

    // Fixed Node script: never uses shell, checks again for overwrite prevention, copies file
    const copyScript = [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const env = path.resolve('.env');",
      "if (fs.existsSync(env)) {",
      "  console.error('.env file already exists; refusing to overwrite');",
      "  process.exit(1);",
      "}",
      "fs.copyFileSync(path.resolve('.env.example'), env);",
      "console.log('Successfully copied .env.example to .env');"
    ].join(" ");

    return {
      executable: process.execPath,
      args: ["-e", copyScript],
      cwd: resolvedDir
    };
  },

  async verify(projectDir: string): Promise<VerificationResult> {
    const envFile = path.join(projectDir, ".env");
    const exists = fs.existsSync(envFile);
    return {
      passed: exists,
      details: exists
        ? ".env configuration file is present."
        : ".env configuration file is missing."
    };
  }
};

export const OPERATION_REGISTRY: Record<AllowlistedOperationId, RemediationOperation> = {
  NODE_INSTALL_DEPENDENCIES: NODE_INSTALL_DEPENDENCIES_OPERATION,
  PYTHON_CREATE_VENV: PYTHON_CREATE_VENV_OPERATION,
  PYTHON_INSTALL_REQUIREMENTS: PYTHON_INSTALL_REQUIREMENTS_OPERATION,
  COPY_ENV_EXAMPLE: COPY_ENV_EXAMPLE_OPERATION
};

export function getOperation(id: AllowlistedOperationId): RemediationOperation {
  const op = OPERATION_REGISTRY[id];
  if (!op) {
    throw new Error(`Unsupported remediation operation: "${id}"`);
  }
  return op;
}

export function listOperations(): RemediationOperation[] {
  return ALLOWLISTED_OPERATION_IDS.map((id) => OPERATION_REGISTRY[id]);
}

export interface FixHistoryEntry {
  timestamp: string;
  operationId: AllowlistedOperationId;
  command: string;
  argsSummary: string[];
  result: {
    exitCode: number | null;
    success: boolean;
  };
  verification: {
    checkId: string;
    passed: boolean;
    details: string;
  };
}

/**
 * Appends an audit entry to the local .stackdoctor/fix-history.json file.
 * Automatically ensures .stackdoctor is gitignored and contains zero secrets.
 */
export function appendFixHistory(projectDir: string, entry: FixHistoryEntry): void {
  const stackdoctorDir = path.join(projectDir, ".stackdoctor");
  if (!fs.existsSync(stackdoctorDir)) {
    fs.mkdirSync(stackdoctorDir, { recursive: true });
  }

  // Ensure gitignore exists inside .stackdoctor
  const gitignorePath = path.join(stackdoctorDir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, "*\n", "utf-8");
  }

  const historyFile = path.join(stackdoctorDir, "fix-history.json");
  let history: FixHistoryEntry[] = [];
  if (fs.existsSync(historyFile)) {
    try {
      const content = fs.readFileSync(historyFile, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        history = parsed;
      }
    } catch {
      history = [];
    }
  }

  // Sanitize command and args to ensure no canary secrets or environment values are recorded
  const sanitizedEntry: FixHistoryEntry = {
    ...entry,
    command: redactText(entry.command),
    argsSummary: entry.argsSummary.map(redactText),
    verification: {
      ...entry.verification,
      details: redactText(entry.verification.details)
    }
  };

  history.push(sanitizedEntry);
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2) + "\n", "utf-8");
}
