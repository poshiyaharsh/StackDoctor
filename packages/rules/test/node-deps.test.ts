import { describe, it, expect } from "vitest";
import { nodeDepsNotInstalledRule, type RuleEvaluationContext } from "@stackdoctor/rules";
import { FindingSchema } from "@stackdoctor/schemas";

describe("NODE_DEPS_NOT_INSTALLED Rule", () => {
  const baseContext: RuleEvaluationContext = {
    dir: "/test/app",
    files: {
      hasPackageJson: true,
      hasNodeModules: false,
      hasLockfile: true,
      lockfileType: "npm",
      hasEnvExample: false,
      hasEnv: false
    },
    technologies: [
      {
        name: "Node.js",
        confidence: "confirmed",
        evidence: []
      }
    ],
    evidence: []
  };

  it("triggers finding when package.json exists and node_modules is missing", () => {
    expect(nodeDepsNotInstalledRule.preconditions(baseContext)).toBe(true);

    const finding = nodeDepsNotInstalledRule.evaluate(baseContext);
    expect(finding).not.toBeNull();
    expect(finding?.ruleId).toBe("NODE_DEPS_NOT_INSTALLED");
    expect(finding?.severity).toBe("high");
    expect(finding?.confidence).toBe("confirmed");

    // Must validate against Finding zod schema
    const parseResult = FindingSchema.safeParse(finding);
    expect(parseResult.success).toBe(true);
  });

  it("does NOT trigger when node_modules is already present", () => {
    const installedContext: RuleEvaluationContext = {
      ...baseContext,
      files: {
        ...baseContext.files,
        hasNodeModules: true
      }
    };

    const finding = nodeDepsNotInstalledRule.evaluate(installedContext);
    expect(finding).toBeNull();
  });

  it("does NOT trigger when package.json does not exist", () => {
    const noPkgContext: RuleEvaluationContext = {
      ...baseContext,
      files: {
        ...baseContext.files,
        hasPackageJson: false
      }
    };

    expect(nodeDepsNotInstalledRule.preconditions(noPkgContext)).toBe(false);
    expect(nodeDepsNotInstalledRule.evaluate(noPkgContext)).toBeNull();
  });

  it("adapts remediation command based on lockfile (e.g. pnpm)", () => {
    const pnpmContext: RuleEvaluationContext = {
      ...baseContext,
      files: {
        ...baseContext.files,
        lockfileType: "pnpm"
      }
    };

    const finding = nodeDepsNotInstalledRule.evaluate(pnpmContext);
    expect(finding?.recommendations[0]?.commandOrAction).toBe("pnpm install");
  });

  it("strictly separates observed evidence from possible causes", () => {
    const finding = nodeDepsNotInstalledRule.evaluate(baseContext);
    expect(finding).not.toBeNull();

    // Evidence must contain facts
    expect(finding?.evidence[0]?.observed).toContain("package.json exists");
    expect(finding?.evidence[0]?.observed).toContain("node_modules does not exist");

    // Possible causes must contain hypotheses
    expect(finding?.possibleCauses.length).toBeGreaterThan(0);
    expect(finding?.possibleCauses.some((c) => c.includes("not yet been installed"))).toBe(true);
  });
});
