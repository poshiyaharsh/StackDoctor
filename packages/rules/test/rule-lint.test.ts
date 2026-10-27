import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createDefaultRuleRegistry, type Rule } from "../src/index.js";
import { isAllowedDocUrl, ALLOWED_DOC_DOMAINS } from "@stackdoctor/schemas";

export const FORBIDDEN_HYPOTHESIS_WORDS = [
  "probably",
  "might",
  "seems",
  "maybe",
  "could be",
  "likely",
  "possibly"
];

export interface RuleLintResult {
  valid: boolean;
  errors: string[];
}

export function lintRule(
  rule: unknown,
  options?: {
    docsContent?: string;
    testFilesContent?: string;
  }
): RuleLintResult {
  const errors: string[] = [];

  if (!rule || typeof rule !== "object") {
    return { valid: false, errors: ["Rule must be a non-null object"] };
  }

  const r = rule as Partial<Rule>;

  // 1. Required fields
  if (!r.id || typeof r.id !== "string") {
    errors.push("Missing or invalid 'id' field");
  }
  if (!r.title || typeof r.title !== "string") {
    errors.push("Missing or invalid 'title' field");
  }
  if (!r.description || typeof r.description !== "string") {
    errors.push("Missing or invalid 'description' field");
  }
  if (!Array.isArray(r.technologies) || r.technologies.length === 0) {
    errors.push("Missing or empty 'technologies' field");
  }
  const validSeverities = ["critical", "high", "medium", "low", "info"];
  if (!r.severity || !validSeverities.includes(r.severity)) {
    errors.push(`Invalid 'severity' field. Must be one of: ${validSeverities.join(", ")}`);
  }
  const validConfidences = ["confirmed", "likely", "possible", "tentative"];
  if (!r.confidence || !validConfidences.includes(r.confidence)) {
    errors.push(`Invalid 'confidence' field. Must be one of: ${validConfidences.join(", ")}`);
  }
  if (!Array.isArray(r.requiredEvidence)) {
    errors.push("Missing 'requiredEvidence' array");
  }
  if (!Array.isArray(r.recommendedChecks)) {
    errors.push("Missing 'recommendedChecks' array");
  }
  if (!Array.isArray(r.remediation) || r.remediation.length === 0) {
    errors.push("Missing or empty 'remediation' array");
  }
  if (!r.verification || typeof r.verification !== "string" || r.verification.trim() === "") {
    errors.push("Missing or empty 'verification' field");
  }
  if (!Array.isArray(r.docs)) {
    errors.push("Missing 'docs' array");
  }
  if (typeof r.preconditions !== "function") {
    errors.push("Missing 'preconditions' function");
  }
  if (typeof r.evaluate !== "function") {
    errors.push("Missing 'evaluate' function");
  }

  // 2. ID format (strict UPPER_SNAKE_CASE)
  if (r.id && !/^[A-Z][A-Z0-9_]*$/.test(r.id)) {
    errors.push(`Rule ID "${r.id}" must be in UPPER_SNAKE_CASE (e.g. MY_RULE_ID)`);
  }

  // 3. Recommendation verification step
  if (Array.isArray(r.remediation)) {
    r.remediation.forEach((rec, idx) => {
      if (!rec.verification || rec.verification.trim() === "") {
        errors.push(`Remediation recommendation at index ${idx} is missing a verification step`);
      }
      if (!rec.commandOrAction || rec.commandOrAction.trim() === "") {
        errors.push(`Remediation recommendation at index ${idx} is missing commandOrAction`);
      }
    });
  }

  // 4. Docs URLs allowlist and HTTPS check
  if (Array.isArray(r.docs)) {
    r.docs.forEach((docUrl) => {
      if (!docUrl.startsWith("https://")) {
        errors.push(`Documentation URL must be HTTPS: "${docUrl}"`);
      }
      if (!isAllowedDocUrl(docUrl)) {
        errors.push(
          `Documentation URL "${docUrl}" domain is not on allowlist (${ALLOWED_DOC_DOMAINS.join(", ")})`
        );
      }
    });
  }

  // 5. Hypothesis wording check in required evidence
  if (Array.isArray(r.requiredEvidence)) {
    r.requiredEvidence.forEach((ev) => {
      const lower = ev.toLowerCase();
      for (const word of FORBIDDEN_HYPOTHESIS_WORDS) {
        if (lower.includes(word)) {
          errors.push(`Forbidden hypothesis word "${word}" found in requiredEvidence: "${ev}"`);
        }
      }
    });
  }

  // 6. Docs entry check
  if (r.id && options?.docsContent) {
    if (!options.docsContent.includes(r.id)) {
      errors.push(`Rule "${r.id}" is missing an entry in docs/diagnostics.md`);
    }
  }

  // 7. Test coverage check
  if (r.id && options?.testFilesContent) {
    if (!options.testFilesContent.includes(r.id)) {
      errors.push(`Rule "${r.id}" has no corresponding test file in packages/rules/test`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

describe("Rule Linter (Run 4D)", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const docsPath = path.join(rootDir, "docs", "diagnostics.md");
  const docsContent = fs.existsSync(docsPath) ? fs.readFileSync(docsPath, "utf-8") : "";

  const testDir = path.resolve(__dirname);
  const testFiles = fs.readdirSync(testDir).filter((f) => f.endsWith(".test.ts"));
  const testFilesContent = testFiles
    .map((f) => fs.readFileSync(path.join(testDir, f), "utf-8"))
    .join("\n");

  it("validates that all registered rules in createDefaultRuleRegistry() pass rule-lint", () => {
    const registry = createDefaultRuleRegistry();
    const rules = registry.list();
    expect(rules.length).toBeGreaterThanOrEqual(20);

    const ids = new Set<string>();
    for (const rule of rules) {
      // Check duplicate ID
      expect(ids.has(rule.id)).toBe(false);
      ids.add(rule.id);

      const result = lintRule(rule, { docsContent, testFilesContent });
      if (!result.valid) {
        console.error(`Rule ${rule.id} failed lint with errors:`, result.errors);
      }
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    }
  });

  describe("catches deliberately bad rule fixtures", () => {
    const baseValidRule: Rule = {
      id: "VALID_MOCK_RULE",
      title: "Valid Mock Rule",
      category: "environment",
      description: "Description of valid mock rule",
      technologies: ["Node.js"],
      severity: "medium",
      confidence: "confirmed",
      requiredEvidence: ["file_presence"],
      recommendedChecks: ["Check something"],
      remediation: [
        {
          problem: "A mock problem occurred.",
          relevance: "Impacts system behavior.",
          commandOrAction: "echo 'fixed'",
          expectedResult: "Fixed.",
          risks: "None.",
          undo: "echo 'undo'",
          verification: "test -f foo"
        }
      ],
      verification: "Verify that foo exists.",
      docs: ["https://nodejs.org/api/"],
      preconditions: () => true,
      evaluate: () => null
    };

    it("fails when rule ID is not UPPER_SNAKE_CASE", () => {
      const badRule = { ...baseValidRule, id: "lowercase_rule_id" };
      const result = lintRule(badRule, { docsContent: "lowercase_rule_id", testFilesContent: "lowercase_rule_id" });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("must be in UPPER_SNAKE_CASE"))).toBe(true);
    });

    it("fails when doc link is not HTTPS", () => {
      const badRule = { ...baseValidRule, docs: ["http://nodejs.org/api/"] };
      const result = lintRule(badRule);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("must be HTTPS"))).toBe(true);
    });

    it("fails when doc link domain is not on the allowlist", () => {
      const badRule = { ...baseValidRule, docs: ["https://random-untrusted-domain.com/docs"] };
      const result = lintRule(badRule);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("not on allowlist"))).toBe(true);
    });

    it("fails when verification step is missing from remediation", () => {
      const badRule = {
        ...baseValidRule,
        remediation: [
          {
            problem: "Problem",
            relevance: "Relevance",
            commandOrAction: "fix",
            risks: "None",
            verification: "" // Missing verification step!
          }
        ]
      };
      const result = lintRule(badRule);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("missing a verification step"))).toBe(true);
    });

    it("fails when rule verification field is missing", () => {
      const badRule = { ...baseValidRule, verification: "" };
      const result = lintRule(badRule);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Missing or empty 'verification' field"))).toBe(true);
    });

    it("fails when forbidden hypothesis words appear in requiredEvidence", () => {
      const badRule = {
        ...baseValidRule,
        requiredEvidence: ["file_presence", "service probably crashed"]
      };
      const result = lintRule(badRule);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Forbidden hypothesis word "probably"'))).toBe(true);
    });

    it("fails when rule is missing from docs/diagnostics.md", () => {
      const badRule = { ...baseValidRule, id: "RULE_NOT_IN_DOCS" };
      const result = lintRule(badRule, { docsContent: "OTHER_RULES", testFilesContent: "RULE_NOT_IN_DOCS" });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("missing an entry in docs/diagnostics.md"))).toBe(true);
    });

    it("fails when rule has no test file coverage", () => {
      const badRule = { ...baseValidRule, id: "RULE_WITHOUT_TESTS" };
      const result = lintRule(badRule, { docsContent: "RULE_WITHOUT_TESTS", testFilesContent: "OTHER_TESTS" });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("has no corresponding test file"))).toBe(true);
    });
  });
});
