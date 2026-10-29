import { describe, it, expect } from "vitest";
import { RuleRegistry, createDefaultRuleRegistry, type Rule } from "@stackdoctor/rules";

describe("RuleRegistry (registry.ts)", () => {
  const dummyRule: Rule = {
    id: "CUSTOM_TEST_RULE",
    title: "Custom Test Rule",
    description: "Rule used for registry tests",
    technologies: ["Node.js", "TypeScript"],
    severity: "low",
    confidence: "likely",
    requiredEvidence: ["file_presence"],
    recommendedChecks: ["check_something"],
    remediation: [
      {
        problem: "Test problem",
        relevance: "High",
        commandOrAction: "echo fix",
        expectedResult: "Fixed",
        risks: "None",
        verification: "echo verified"
      }
    ],
    verification: "Verify something",
    docs: ["https://nodejs.org/api/"],
    preconditions: () => true,
    evaluate: () => null
  };

  it("registers rules and retrieves them by ID", () => {
    const registry = new RuleRegistry();
    registry.register(dummyRule);

    expect(registry.get("CUSTOM_TEST_RULE")?.id).toBe("CUSTOM_TEST_RULE");
    expect(registry.list().length).toBe(1);
  });

  it("CRITICAL RULE: rejects duplicate rule IDs", () => {
    const registry = new RuleRegistry();
    registry.register(dummyRule);

    expect(() => registry.register(dummyRule)).toThrow(/Duplicate rule ID/);
  });

  it("rejects rules with missing required fields", () => {
    const registry = new RuleRegistry();
    const incompleteRule = { ...dummyRule } as Partial<Rule>;
    delete incompleteRule.evaluate;

    expect(() => registry.register(incompleteRule as Rule)).toThrow(/missing required field "evaluate"/);
  });

  it("filters rules by technology with wildcard support", () => {
    const registry = createDefaultRuleRegistry();
    // Default registry contains 32 rules
    expect(registry.list().length).toBe(32);

    const nodeRules = registry.forTechnologies(["Node.js"]);
    expect(nodeRules.some((r) => r.id === "NODE_DEPS_NOT_INSTALLED")).toBe(true);
    expect(nodeRules.some((r) => r.id === "ENV_EXAMPLE_PRESENT_NO_ENV")).toBe(true);

    const pythonRules = registry.forTechnologies(["Python"]);
    // Wildcard rule ENV_EXAMPLE_PRESENT_NO_ENV matches, but Node rule does not
    expect(pythonRules.some((r) => r.id === "ENV_EXAMPLE_PRESENT_NO_ENV")).toBe(true);
    expect(pythonRules.some((r) => r.id === "NODE_DEPS_NOT_INSTALLED")).toBe(false);
  });

  it("CRITICAL RULE: rejects non-allowlisted documentation URLs", () => {
    const registry = new RuleRegistry();
    const badDomainRule: Rule = {
      ...dummyRule,
      docs: ["https://untrusted-domain.com/docs"]
    };
    expect(() => registry.register(badDomainRule)).toThrow(
      /is not from an allowlisted domain/
    );
  });

  it("CRITICAL RULE: rejects unencrypted HTTP documentation URLs", () => {
    const registry = new RuleRegistry();
    const httpRule: Rule = {
      ...dummyRule,
      docs: ["http://nodejs.org/api/"]
    };
    expect(() => registry.register(httpRule)).toThrow(
      /is not from an allowlisted domain or is not HTTPS/
    );
  });
});
