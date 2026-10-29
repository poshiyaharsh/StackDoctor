import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { lockfileMissingRule } from "../../src/rules/lockfile-missing.js";
import type { RuleEvaluationContext } from "../../src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureDir = path.resolve(__dirname, "../../../../examples/regressions/FB-004-pnpm-lockfile");

describe("Regression FB-004: pnpm-lockfile", () => {
  it("fixture directory exists and contains expected metadata", () => {
    expect(fs.existsSync(fixtureDir)).toBe(true);
    const expectedPath = path.join(fixtureDir, "expected.json");
    expect(fs.existsSync(expectedPath)).toBe(true);
    expect(fs.existsSync(path.join(fixtureDir, "pnpm-lock.yaml"))).toBe(true);
  });

  it("does not report missing lockfile when pnpm-lock.yaml is present", () => {
    const ctx: RuleEvaluationContext = {
      projectDir: fixtureDir,
      files: {
        hasPackageJson: true,
        hasNodeModules: true,
        hasLockfile: true,
        lockfileType: "pnpm",
        hasEnvExample: false,
        hasEnv: false,
        hasDockerfile: false,
        hasDockerCompose: false
      }
    };

    const finding = lockfileMissingRule.evaluate(ctx);
    expect(finding).toBeNull();
  });
});
