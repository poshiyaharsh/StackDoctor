import { describe, it, expect } from "vitest";
import {
  envExamplePresentNoEnvRule,
  extractEnvVarNames,
  type RuleEvaluationContext
} from "@stackdoctor/rules";
import { FindingSchema } from "@stackdoctor/schemas";

describe("ENV_EXAMPLE_PRESENT_NO_ENV Rule", () => {
  const baseContext: RuleEvaluationContext = {
    dir: "/test/app",
    files: {
      hasPackageJson: false,
      hasNodeModules: false,
      hasLockfile: false,
      hasEnvExample: true,
      hasEnv: false,
      envExampleVarNames: ["PORT", "DATABASE_URL", "SECRET_KEY"]
    },
    technologies: [],
    evidence: []
  };

  it("extracts variable names only and ignores comments and secret values", () => {
    const sampleEnvExample = `# Server Configuration
PORT=3000
HOST=0.0.0.0

# Database Credentials - dummy values
DATABASE_URL=postgres://user:password123@localhost:5432/mydb
SECRET_TOKEN="super_secret_dummy_value"
API_KEY: abcdef123456
EMPTY_VAR=
`;

    const varNames = extractEnvVarNames(sampleEnvExample);
    expect(varNames).toEqual([
      "PORT",
      "HOST",
      "DATABASE_URL",
      "SECRET_TOKEN",
      "API_KEY",
      "EMPTY_VAR"
    ]);

    // Ensure NO values leaked into the extracted array
    expect(varNames).not.toContain("password123");
    expect(varNames).not.toContain("super_secret_dummy_value");
    expect(varNames).not.toContain("3000");
  });

  it("triggers finding when .env.example exists and .env is missing", () => {
    expect(envExamplePresentNoEnvRule.preconditions(baseContext)).toBe(true);

    const finding = envExamplePresentNoEnvRule.evaluate(baseContext);
    expect(finding).not.toBeNull();
    expect(finding?.ruleId).toBe("ENV_EXAMPLE_PRESENT_NO_ENV");
    expect(finding?.severity).toBe("medium");
    expect(finding?.status).toBe("warning");

    const parseResult = FindingSchema.safeParse(finding);
    expect(parseResult.success).toBe(true);
  });

  it("does NOT trigger when .env is already present", () => {
    const envPresentContext: RuleEvaluationContext = {
      ...baseContext,
      files: {
        ...baseContext.files,
        hasEnv: true
      }
    };

    const finding = envExamplePresentNoEnvRule.evaluate(envPresentContext);
    expect(finding).toBeNull();
  });

  it("does NOT trigger when .env.example does not exist", () => {
    const noExampleContext: RuleEvaluationContext = {
      ...baseContext,
      files: {
        ...baseContext.files,
        hasEnvExample: false
      }
    };

    expect(envExamplePresentNoEnvRule.preconditions(noExampleContext)).toBe(false);
    expect(envExamplePresentNoEnvRule.evaluate(noExampleContext)).toBeNull();
  });

  it("strictly reports variable NAMES only and never secret values", () => {
    const finding = envExamplePresentNoEnvRule.evaluate(baseContext);
    expect(finding).not.toBeNull();

    // Check evidence contains names only
    const observed = finding?.evidence[0]?.observed;
    expect(observed).toContain("PORT");
    expect(observed).toContain("DATABASE_URL");
    expect(observed).toContain("SECRET_KEY");

    // Make sure no values are in the finding
    const findingString = JSON.stringify(finding);
    expect(findingString).not.toContain("password");
    expect(findingString).not.toContain("secret123");
  });

  it("separates observed evidence from possible causes", () => {
    const finding = envExamplePresentNoEnvRule.evaluate(baseContext);
    expect(finding).not.toBeNull();

    expect(finding?.evidence[0]?.observed).toContain(".env.example exists, but .env is absent");
    expect(finding?.possibleCauses.some((c) => c.includes("not copied .env.example"))).toBe(true);
  });
});
