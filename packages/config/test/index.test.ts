import { describe, it, expect } from "vitest";
import { CONFIG_PACKAGE, createEslintConfig } from "@stackdoctor/config";

describe("packages/config", () => {
  it("exports package identifier and eslint config factory", () => {
    expect(CONFIG_PACKAGE).toBe("@stackdoctor/config");
    expect(typeof createEslintConfig).toBe("function");
  });
});
