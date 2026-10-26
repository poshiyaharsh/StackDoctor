import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  normalizePackageName,
  parseRequirementsTxt,
  parsePyprojectDependencies,
  checkPythonVersionSatisfies
} from "@stackdoctor/adapters";

describe("Python Dependencies Adapter (python-deps.ts)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-pydeps-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe("normalizePackageName (PEP 503)", () => {
    it("normalizes casing, underscores, and dots to lowercase dashes", () => {
      expect(normalizePackageName("Django_Cors_Headers")).toBe("django-cors-headers");
      expect(normalizePackageName("psycopg2_binary")).toBe("psycopg2-binary");
      expect(normalizePackageName("zope.interface")).toBe("zope-interface");
      expect(normalizePackageName("  Flask  ")).toBe("flask");
    });
  });

  describe("parseRequirementsTxt", () => {
    it("parses packages with version specifiers and ignores comments and options", () => {
      const content = `
# Core framework
Django==4.2.11
psycopg2-binary>=2.9.0
requests>=2.28.0,<3.0.0
gunicorn # WSGI Server

# pip options to ignore
-r base.txt
-i https://pypi.org/simple
`;
      const reqPath = path.join(tempDir, "requirements.txt");
      fs.writeFileSync(reqPath, content);

      const pkgs = parseRequirementsTxt(reqPath);
      expect(pkgs.length).toBe(4);

      const names = pkgs.map((p) => p.normalizedName);
      expect(names).toContain("django");
      expect(names).toContain("psycopg2-binary");
      expect(names).toContain("requests");
      expect(names).toContain("gunicorn");

      const djangoPkg = pkgs.find((p) => p.normalizedName === "django");
      expect(djangoPkg?.specifier).toBe("==4.2.11");
    });

    it("returns empty array when requirements.txt does not exist", () => {
      expect(parseRequirementsTxt(path.join(tempDir, "does-not-exist.txt"))).toEqual([]);
    });
  });

  describe("parsePyprojectDependencies", () => {
    it("parses [project.dependencies] and [tool.poetry.dependencies]", () => {
      const content = `
[project]
name = "my-django-app"
dependencies = [
    "django>=4.2.0",
    "djangorestframework>=3.14.0",
    "celery"
]

[tool.poetry.dependencies]
python = "^3.11"
redis = "^5.0"
`;
      const pyprojectPath = path.join(tempDir, "pyproject.toml");
      fs.writeFileSync(pyprojectPath, content);

      const pkgs = parsePyprojectDependencies(pyprojectPath);
      const names = pkgs.map((p) => p.normalizedName);

      expect(names).toContain("django");
      expect(names).toContain("djangorestframework");
      expect(names).toContain("celery");
      expect(names).toContain("redis");
      // Python version constraint itself is excluded
      expect(names).not.toContain("python");
    });
  });

  describe("checkPythonVersionSatisfies", () => {
    it("evaluates exact matching (==)", () => {
      expect(checkPythonVersionSatisfies("4.2.11", "==4.2.11")).toEqual({
        satisfies: true,
        parseable: true
      });
      expect(checkPythonVersionSatisfies("4.2.10", "==4.2.11")).toEqual({
        satisfies: false,
        parseable: true
      });
    });

    it("evaluates semver ranges (>=, <=, ~=)", () => {
      expect(checkPythonVersionSatisfies("4.2.11", ">=4.2.0")).toEqual({
        satisfies: true,
        parseable: true
      });
      expect(checkPythonVersionSatisfies("3.2.1", ">=4.0.0")).toEqual({
        satisfies: false,
        parseable: true
      });
    });

    it("handles unparseable specifiers gracefully without false failure", () => {
      const res = checkPythonVersionSatisfies("4.2.11", "unparseable-specifier-xyz");
      expect(res.parseable).toBe(false);
      expect(res.satisfies).toBe(true);
    });
  });
});
