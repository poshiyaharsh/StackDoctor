import { describe, it, expect } from "vitest";
import { ADAPTERS_PACKAGE, ADAPTERS_DEPENDENCY } from "@stackdoctor/adapters";

describe("packages/adapters", () => {
  it("exports package identifier and references schemas", () => {
    expect(ADAPTERS_PACKAGE).toBe("@stackdoctor/adapters");
    expect(ADAPTERS_DEPENDENCY).toBe("@stackdoctor/schemas");
  });
});
