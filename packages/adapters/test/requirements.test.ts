import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  detectNodeRequirement,
  evaluateNodeVersion,
  detectPythonRequirement
} from "@stackdoctor/adapters";

describe("Requirement Detection & Evaluation (requirements.ts)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-reqs-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe("detectNodeRequirement", () => {
    it("detects engines.node from package.json", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ engines: { node: ">=18.0.0" } })
      );

      const req = detectNodeRequirement(tempDir);
      expect(req.declared).toBe(true);
      expect(req.rawRange).toBe(">=18.0.0");
      expect(req.sourceFile).toContain("engines.node");
    });

    it("detects requirement from .nvmrc", () => {
      fs.writeFileSync(path.join(tempDir, ".nvmrc"), "20.10.0\n");

      const req = detectNodeRequirement(tempDir);
      expect(req.declared).toBe(true);
      expect(req.rawRange).toBe("20.10.0");
      expect(req.sourceFile).toBe(".nvmrc");
    });

    it("detects requirement from .node-version", () => {
      fs.writeFileSync(path.join(tempDir, ".node-version"), "v18.19.0\n");

      const req = detectNodeRequirement(tempDir);
      expect(req.declared).toBe(true);
      expect(req.rawRange).toBe("v18.19.0");
      expect(req.sourceFile).toBe(".node-version");
    });

    it("returns declared: false when no requirement files exist", () => {
      const req = detectNodeRequirement(tempDir);
      expect(req.declared).toBe(false);
      expect(req.rawRange).toBeUndefined();
    });

    it("handles corrupt package.json gracefully without throwing", () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), "invalid json {");
      const req = detectNodeRequirement(tempDir);
      expect(req.declared).toBe(false);
    });
  });

  describe("evaluateNodeVersion", () => {
    it("evaluates matching semver versions accurately", () => {
      const evaluation = evaluateNodeVersion("v20.11.0", {
        declared: true,
        rawRange: ">=18.0.0 <22.0.0",
        sourceFile: "package.json"
      });

      expect(evaluation.matches).toBe(true);
      expect(evaluation.installedVersion).toBe("20.11.0");
      expect(evaluation.warning).toBeUndefined();
    });

    it("evaluates failing semver versions accurately", () => {
      const evaluation = evaluateNodeVersion("v16.14.0", {
        declared: true,
        rawRange: ">=18.0.0",
        sourceFile: "package.json"
      });

      expect(evaluation.matches).toBe(false);
      expect(evaluation.installedVersion).toBe("16.14.0");
      expect(evaluation.warning).toBeUndefined();
    });

    it("normalizes shorthand major versions (e.g. '20') to valid semver ranges", () => {
      const evaluation = evaluateNodeVersion("v20.5.1", {
        declared: true,
        rawRange: "20",
        sourceFile: ".nvmrc"
      });

      expect(evaluation.matches).toBe(true);
    });

    it("issues a warning and does NOT fail when the range is unparseable", () => {
      const evaluation = evaluateNodeVersion("v20.5.1", {
        declared: true,
        rawRange: "iron-lts-unparseable-spec",
        sourceFile: ".nvmrc"
      });

      expect(evaluation.matches).toBe(true);
      expect(evaluation.warning).toBeDefined();
      expect(evaluation.warning).toContain("could not interpret declared range");
    });

    it("passes immediately when no requirement was declared", () => {
      const evaluation = evaluateNodeVersion("v20.5.1", { declared: false });
      expect(evaluation.matches).toBe(true);
      expect(evaluation.warning).toBeUndefined();
    });
  });

  describe("detectPythonRequirement", () => {
    it("detects requirement from .python-version", () => {
      fs.writeFileSync(path.join(tempDir, ".python-version"), "3.11.5\n");
      const req = detectPythonRequirement(tempDir);
      expect(req.declared).toBe(true);
      expect(req.rawRequirement).toBe("3.11.5");
      expect(req.sourceFile).toBe(".python-version");
    });

    it("detects requirement from pyproject.toml", () => {
      fs.writeFileSync(
        path.join(tempDir, "pyproject.toml"),
        '[project]\nname = "my-app"\nrequires-python = ">=3.10"\n'
      );
      const req = detectPythonRequirement(tempDir);
      expect(req.declared).toBe(true);
      expect(req.rawRequirement).toBe(">=3.10");
      expect(req.sourceFile).toBe("pyproject.toml");
    });

    it("detects requirement from runtime.txt", () => {
      fs.writeFileSync(path.join(tempDir, "runtime.txt"), "python-3.10.12\n");
      const req = detectPythonRequirement(tempDir);
      expect(req.declared).toBe(true);
      expect(req.rawRequirement).toBe("3.10.12");
      expect(req.sourceFile).toBe("runtime.txt");
    });

    it("returns declared: false when no Python requirement exists", () => {
      const req = detectPythonRequirement(tempDir);
      expect(req.declared).toBe(false);
    });
  });
});
