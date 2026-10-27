import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  ALLOWLISTED_OPERATION_IDS,
  RULE_TO_OPERATION_MAP,
  isAllowlistedOperationId,
  resolveOperationId,
  getOperation,
  listOperations,
  validateProjectDirectory,
  assertInsideProject,
  appendFixHistory,
  EmptyArgumentSchema,
  type AllowlistedOperationId
} from "../src/operations.js";

describe("Remediation Operation Registry (Run 5E)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-operations-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("strictly contains EXACTLY the four allowlisted operations", () => {
    expect(ALLOWLISTED_OPERATION_IDS).toEqual([
      "NODE_INSTALL_DEPENDENCIES",
      "PYTHON_CREATE_VENV",
      "PYTHON_INSTALL_REQUIREMENTS",
      "COPY_ENV_EXAMPLE"
    ]);

    const operations = listOperations();
    expect(operations).toHaveLength(4);
    expect(operations.map((o) => o.id)).toEqual([
      "NODE_INSTALL_DEPENDENCIES",
      "PYTHON_CREATE_VENV",
      "PYTHON_INSTALL_REQUIREMENTS",
      "COPY_ENV_EXAMPLE"
    ]);
  });

  it("strictly rejects non-allowlisted operations like process killing or file deletion", () => {
    const forbiddenOperations = [
      "KILL_PROCESS",
      "DELETE_FILE",
      "RUN_DB_MIGRATIONS",
      "UPGRADE_PACKAGES",
      "SUDO_INSTALL",
      "CONFIGURE_FIREWALL"
    ];

    for (const forbidden of forbiddenOperations) {
      expect(isAllowlistedOperationId(forbidden)).toBe(false);
      expect(resolveOperationId(forbidden)).toBeNull();
      expect(() => getOperation(forbidden as AllowlistedOperationId)).toThrow(
        /Unsupported remediation operation/
      );
    }
  });

  it("maps rule IDs to allowlisted operation IDs correctly", () => {
    expect(RULE_TO_OPERATION_MAP["NODE_DEPS_NOT_INSTALLED"]).toBe("NODE_INSTALL_DEPENDENCIES");
    expect(resolveOperationId("NODE_DEPS_NOT_INSTALLED")).toBe("NODE_INSTALL_DEPENDENCIES");
    expect(resolveOperationId("PYTHON_VENV_MISSING")).toBe("PYTHON_CREATE_VENV");
    expect(resolveOperationId("PYTHON_PACKAGES_MISSING")).toBe("PYTHON_INSTALL_REQUIREMENTS");
    expect(resolveOperationId("ENV_EXAMPLE_PRESENT_NO_ENV")).toBe("COPY_ENV_EXAMPLE");
    expect(resolveOperationId("NODE_INSTALL_DEPENDENCIES")).toBe("NODE_INSTALL_DEPENDENCIES");
    expect(resolveOperationId("UNKNOWN_RULE_XYZ")).toBeNull();
  });

  it("strictly enforces EmptyArgumentSchema rejecting any injected arguments from AI or external inputs", () => {
    expect(EmptyArgumentSchema.safeParse({}).success).toBe(true);
    expect(
      EmptyArgumentSchema.safeParse({
        command: "rm -rf /",
        flags: "--extra-danger"
      }).success
    ).toBe(false);
  });

  describe("NODE_INSTALL_DEPENDENCIES", () => {
    it("fails precondition if package.json does not exist", async () => {
      const op = getOperation("NODE_INSTALL_DEPENDENCIES");
      const pre = await op.checkPreconditions(tmpDir);
      expect(pre.ok).toBe(false);
      expect(pre.reason).toContain("package.json was not found");
    });

    it("detects lockfile and builds npm ci --ignore-scripts for package-lock.json", async () => {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "{}", "utf-8");
      fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "{}", "utf-8");

      const op = getOperation("NODE_INSTALL_DEPENDENCIES");
      const pre = await op.checkPreconditions(tmpDir);
      expect(pre.ok).toBe(true);

      const plan = await op.buildExecution(tmpDir);
      expect(plan.executable).toBe("npm");
      expect(plan.args).toEqual(["ci", "--ignore-scripts"]);
      expect(plan.cwd).toBe(tmpDir);
    });

    it("detects pnpm-lock.yaml and uses pnpm install --frozen-lockfile --ignore-scripts", async () => {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "{}", "utf-8");
      fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "lockfileVersion: 5.4", "utf-8");

      const op = getOperation("NODE_INSTALL_DEPENDENCIES");
      const plan = await op.buildExecution(tmpDir);
      expect(plan.executable).toBe("pnpm");
      expect(plan.args).toEqual(["install", "--frozen-lockfile", "--ignore-scripts"]);
    });

    it("detects yarn.lock and uses yarn install --immutable --ignore-scripts", async () => {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "{}", "utf-8");
      fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "# yarn lockfile", "utf-8");

      const op = getOperation("NODE_INSTALL_DEPENDENCIES");
      const plan = await op.buildExecution(tmpDir);
      expect(plan.executable).toBe("yarn");
      expect(plan.args).toEqual(["install", "--immutable", "--ignore-scripts"]);
    });

    it("verifies node_modules presence correctly", async () => {
      const op = getOperation("NODE_INSTALL_DEPENDENCIES");
      let ver = await op.verify(tmpDir);
      expect(ver.passed).toBe(false);

      fs.mkdirSync(path.join(tmpDir, "node_modules"));
      ver = await op.verify(tmpDir);
      expect(ver.passed).toBe(true);
    });
  });

  describe("PYTHON_CREATE_VENV", () => {
    it("fails precondition if .venv already exists", async () => {
      fs.mkdirSync(path.join(tmpDir, ".venv"));
      const op = getOperation("PYTHON_CREATE_VENV");
      const pre = await op.checkPreconditions(tmpDir);
      expect(pre.ok).toBe(false);
      expect(pre.reason).toContain(".venv directory already exists");
    });

    it("builds python -m venv .venv execution plan", async () => {
      const op = getOperation("PYTHON_CREATE_VENV");
      const pre = await op.checkPreconditions(tmpDir);
      expect(pre.ok).toBe(true);

      const plan = await op.buildExecution(tmpDir);
      expect(["python", "python3"]).toContain(plan.executable);
      expect(plan.args).toEqual(["-m", "venv", ".venv"]);
      expect(plan.cwd).toBe(tmpDir);
    });
  });

  describe("PYTHON_INSTALL_REQUIREMENTS", () => {
    it("fails precondition if requirements.txt does not exist", async () => {
      const op = getOperation("PYTHON_INSTALL_REQUIREMENTS");
      const pre = await op.checkPreconditions(tmpDir);
      expect(pre.ok).toBe(false);
      expect(pre.reason).toContain("requirements.txt was not found");
    });

    it("VENV-ONLY GUARD: fails precondition if .venv does not exist to prevent global installation", async () => {
      fs.writeFileSync(path.join(tmpDir, "requirements.txt"), "requests>=2.0.0\n", "utf-8");
      const op = getOperation("PYTHON_INSTALL_REQUIREMENTS");
      const pre = await op.checkPreconditions(tmpDir);
      expect(pre.ok).toBe(false);
      expect(pre.reason).toContain("No local .venv directory found");
    });

    it("builds execution plan targeting python/pip strictly inside .venv", async () => {
      fs.writeFileSync(path.join(tmpDir, "requirements.txt"), "requests>=2.0.0\n", "utf-8");
      const venvDir = path.join(tmpDir, ".venv");
      fs.mkdirSync(venvDir);

      const op = getOperation("PYTHON_INSTALL_REQUIREMENTS");
      const pre = await op.checkPreconditions(tmpDir);
      expect(pre.ok).toBe(true);

      const plan = await op.buildExecution(tmpDir);
      expect(plan.executable).toContain(".venv");
      expect(plan.args).toEqual(["-m", "pip", "install", "-r", "requirements.txt"]);
      expect(plan.cwd).toBe(tmpDir);
    });
  });

  describe("COPY_ENV_EXAMPLE", () => {
    it("fails precondition if .env.example is missing", async () => {
      const op = getOperation("COPY_ENV_EXAMPLE");
      const pre = await op.checkPreconditions(tmpDir);
      expect(pre.ok).toBe(false);
      expect(pre.reason).toContain(".env.example does not exist");
    });

    it("refuses to overwrite if .env already exists", async () => {
      fs.writeFileSync(path.join(tmpDir, ".env.example"), "DB_HOST=localhost\n", "utf-8");
      fs.writeFileSync(path.join(tmpDir, ".env"), "DB_HOST=prod-server\n", "utf-8");

      const op = getOperation("COPY_ENV_EXAMPLE");
      const pre = await op.checkPreconditions(tmpDir);
      expect(pre.ok).toBe(false);
      expect(pre.reason).toContain("Refusing to overwrite");
    });

    it("builds execution plan using node without shell to copy template file safely", async () => {
      fs.writeFileSync(path.join(tmpDir, ".env.example"), "DB_HOST=localhost\n", "utf-8");

      const op = getOperation("COPY_ENV_EXAMPLE");
      const pre = await op.checkPreconditions(tmpDir);
      expect(pre.ok).toBe(true);

      const plan = await op.buildExecution(tmpDir);
      expect(plan.executable).toBe(process.execPath);
      expect(plan.args[0]).toBe("-e");
      expect(plan.args[1]).toContain("copyFileSync");
      expect(plan.cwd).toBe(tmpDir);
    });
  });

  describe("Directory & Path Restriction Safety", () => {
    it("rejects project paths that do not exist or are not directories", () => {
      expect(() => validateProjectDirectory(path.join(tmpDir, "non_existent"))).toThrow(
        /Project directory does not exist/
      );

      const filePath = path.join(tmpDir, "some-file.txt");
      fs.writeFileSync(filePath, "hello", "utf-8");
      expect(() => validateProjectDirectory(filePath)).toThrow(
        /Project path is not a directory/
      );
    });

    it("rejects paths escaping project directory", () => {
      expect(() => assertInsideProject(tmpDir, "../outside-file")).toThrow(
        /Access denied: Target path/
      );
      expect(assertInsideProject(tmpDir, "nested/file.txt")).toBe(
        path.resolve(tmpDir, "nested/file.txt")
      );
    });
  });

  describe("Audit Fix History Logging", () => {
    it("writes audit history to .stackdoctor/fix-history.json and creates gitignore", () => {
      appendFixHistory(tmpDir, {
        timestamp: new Date().toISOString(),
        operationId: "NODE_INSTALL_DEPENDENCIES",
        command: "npm ci --ignore-scripts",
        argsSummary: ["ci", "--ignore-scripts"],
        result: {
          exitCode: 0,
          success: true
        },
        verification: {
          checkId: "NODE_DEPS_INSTALLED",
          passed: true,
          details: "node_modules is present"
        }
      });

      const gitignore = path.join(tmpDir, ".stackdoctor", ".gitignore");
      expect(fs.existsSync(gitignore)).toBe(true);
      expect(fs.readFileSync(gitignore, "utf-8")).toContain("*");

      const historyPath = path.join(tmpDir, ".stackdoctor", "fix-history.json");
      expect(fs.existsSync(historyPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
      expect(parsed).toHaveLength(1);
      expect(parsed[0].operationId).toBe("NODE_INSTALL_DEPENDENCIES");
      expect(parsed[0].result.success).toBe(true);
    });

    it("redacts any secrets from command and verification text before saving audit log", () => {
      const canarySecret = "AKIAIOSFODNN7EXAMPLE";
      appendFixHistory(tmpDir, {
        timestamp: new Date().toISOString(),
        operationId: "COPY_ENV_EXAMPLE",
        command: `echo ${canarySecret}`,
        argsSummary: [`echo`, canarySecret],
        result: {
          exitCode: 0,
          success: true
        },
        verification: {
          checkId: "ENV_FILE_EXISTS",
          passed: true,
          details: `Contains token ${canarySecret}`
        }
      });

      const historyPath = path.join(tmpDir, ".stackdoctor", "fix-history.json");
      const content = fs.readFileSync(historyPath, "utf-8");
      expect(content).not.toContain(canarySecret);
      expect(content).toContain("[REDACTED_AWS_KEY]");
    });
  });
});
