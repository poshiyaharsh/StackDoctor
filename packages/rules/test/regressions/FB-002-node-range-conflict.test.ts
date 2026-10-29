import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { checkRuntimeConflicts } from "@stackdoctor/adapters";
import { runtimeDeclarationsConflictRule } from "../../src/rules/runtime-declarations-conflict.js";
import type { RuleEvaluationContext } from "../../src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureDir = path.resolve(__dirname, "../../../../examples/regressions/FB-002-node-range-conflict");

describe("Regression FB-002: node-range-conflict", () => {
  it("fixture directory exists and contains expected metadata", () => {
    expect(fs.existsSync(fixtureDir)).toBe(true);
    const expectedPath = path.join(fixtureDir, "expected.json");
    expect(fs.existsSync(expectedPath)).toBe(true);
  });

  it("does not report conflict when .nvmrc major version satisfies engines.node range", () => {
    const conflict = checkRuntimeConflicts(fixtureDir);
    expect(conflict.hasConflict).toBe(false);

    const ctx: RuleEvaluationContext = {
      projectDir: fixtureDir,
      files: {
        hasPackageJson: true,
        hasNodeModules: true,
        hasLockfile: true,
        hasEnvExample: false,
        hasEnv: false,
        hasDockerfile: false,
        hasDockerCompose: false
      },
      config: {
        runtimeConflict: conflict
      }
    };

    const finding = runtimeDeclarationsConflictRule.evaluate(ctx);
    expect(finding).toBeNull();
  });
});
