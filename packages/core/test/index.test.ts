import { describe, it, expect } from "vitest";
import { CORE_PACKAGE, CORE_DEPENDENCIES } from "@stackdoctor/core";

describe("packages/core", () => {
  it("exports package identifier and declares package dependencies", () => {
    expect(CORE_PACKAGE).toBe("@stackdoctor/core");
    expect(CORE_DEPENDENCIES).toEqual([
      "@stackdoctor/schemas",
      "@stackdoctor/rules",
      "@stackdoctor/adapters"
    ]);
  });
});
