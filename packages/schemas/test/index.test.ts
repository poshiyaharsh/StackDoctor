import { describe, it, expect } from "vitest";
import { SCHEMAS_PACKAGE, CONFIG_SOURCE } from "@stackdoctor/schemas";

describe("packages/schemas", () => {
  it("exports package identifier and references config", () => {
    expect(SCHEMAS_PACKAGE).toBe("@stackdoctor/schemas");
    expect(CONFIG_SOURCE).toBe("@stackdoctor/config");
  });
});
