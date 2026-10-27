import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
// @ts-expect-error importing JavaScript script module for testing
import { scaffoldRegressionFixture } from "../../../scripts/new-regression.js";

describe("Regression Scaffolder", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-regression-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("scaffolds fixture directory, expected.json, package.json, and test stub", () => {
    const result = scaffoldRegressionFixture({
      id: "FB-042",
      slug: "custom-port-issue",
      root: tempRoot
    });

    expect(result.folderName).toBe("FB-042-custom-port-issue");
    expect(fs.existsSync(result.fixtureDir)).toBe(true);
    expect(fs.existsSync(result.testFile)).toBe(true);

    const readme = fs.readFileSync(path.join(result.fixtureDir, "README.md"), "utf-8");
    expect(readme).toContain("FB-042");
    expect(readme).toContain("custom-port-issue");

    const expected = fs.readFileSync(path.join(result.fixtureDir, "expected.json"), "utf-8");
    expect(expected).toContain("[");

    const packageJson = JSON.parse(fs.readFileSync(path.join(result.fixtureDir, "package.json"), "utf-8"));
    expect(packageJson.name).toBe("regression-custom-port-issue");

    const testContent = fs.readFileSync(result.testFile, "utf-8");
    expect(testContent).toContain("FB-042: custom-port-issue");
  });

  it("throws clear error on invalid ID format", () => {
    expect(() => {
      scaffoldRegressionFixture({ id: "INVALID_ID", slug: "my-test", root: tempRoot });
    }).toThrow(/Invalid or missing --id argument/);
  });

  it("throws clear error on invalid slug format", () => {
    expect(() => {
      scaffoldRegressionFixture({ id: "FB-001", slug: "Invalid Slug With Spaces", root: tempRoot });
    }).toThrow(/Invalid or missing --slug argument/);
  });
});
