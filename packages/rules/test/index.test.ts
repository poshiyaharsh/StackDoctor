import { describe, it, expect } from "vitest";
import { RULES_PACKAGE, RULES_DEPENDENCY } from "@stackdoctor/rules";

describe("packages/rules", () => {
  it("exports package identifier and references schemas", () => {
    expect(RULES_PACKAGE).toBe("@stackdoctor/rules");
    expect(RULES_DEPENDENCY).toBe("@stackdoctor/schemas");
  });
});
