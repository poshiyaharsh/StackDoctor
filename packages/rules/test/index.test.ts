import { describe, it, expect } from "vitest";
import { RULES_PACKAGE, RULES_DEPENDENCY } from "@stackdoctor/rules";
import { type RuleMetadata, RuleMetadataSchema } from "@stackdoctor/schemas";

describe("packages/rules", () => {
  it("exports package identifier and references schemas", () => {
    expect(RULES_PACKAGE).toBe("@stackdoctor/rules");
    expect(RULES_DEPENDENCY).toBe("@stackdoctor/schemas");
  });

  it("can import and use schemas from @stackdoctor/schemas", () => {
    const sampleRule: RuleMetadata = {
      id: "TEST_RULE",
      title: "Test Rule",
      description: "Rule description for tests",
      technologies: ["nodejs"],
      severity: "low",
      confidence: "likely",
      docs: ["https://example.com"]
    };
    const parsed = RuleMetadataSchema.parse(sampleRule);
    expect(parsed.id).toBe("TEST_RULE");
  });
});
