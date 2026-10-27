import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("Rule Generator Script (Run 4D)", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const testRuleId = "GENERATOR_UNIT_TEST_RULE";
  const kebabId = "generator-unit-test-rule";
  const ruleFilePath = path.join(rootDir, "packages/rules/src/rules", `${kebabId}.ts`);
  const testFilePath = path.join(rootDir, "packages/rules/test", `${kebabId}.test.ts`);

  let originalDocs: string | null = null;
  const docsPath = path.join(rootDir, "docs/diagnostics.md");

  beforeEach(() => {
    if (fs.existsSync(docsPath)) {
      originalDocs = fs.readFileSync(docsPath, "utf-8");
    }
  });

  afterEach(() => {
    if (fs.existsSync(ruleFilePath)) {
      fs.rmSync(ruleFilePath, { force: true });
    }
    if (fs.existsSync(testFilePath)) {
      fs.rmSync(testFilePath, { force: true });
    }
    // Restore diagnostics.md if modified
    if (originalDocs !== null) {
      fs.writeFileSync(docsPath, originalDocs, "utf-8");
    }
  });

  it("fails when rule ID is not UPPER_SNAKE_CASE", () => {
    expect(() => {
      execSync("node scripts/new-rule.js --id bad-rule-id", {
        cwd: rootDir,
        stdio: "pipe"
      });
    }).toThrow();
  });

  it("fails when rule ID is missing", () => {
    expect(() => {
      execSync("node scripts/new-rule.js", {
        cwd: rootDir,
        stdio: "pipe"
      });
    }).toThrow();
  });

  it("generates compilable rule and passing test file", () => {
    const output = execSync(
      `node scripts/new-rule.js --id ${testRuleId} --tech node`,
      {
        cwd: rootDir,
        encoding: "utf-8"
      }
    );

    expect(output).toContain(`Successfully created new diagnostic rule: ${testRuleId}`);
    expect(fs.existsSync(ruleFilePath)).toBe(true);
    expect(fs.existsSync(testFilePath)).toBe(true);

    // Verify generated test passes
    const testRunOutput = execSync(
      `npx vitest run packages/rules/test/${kebabId}.test.ts`,
      {
        cwd: rootDir,
        encoding: "utf-8"
      }
    );
    expect(testRunOutput).toContain("1 passed");
  }, 25000);
});
