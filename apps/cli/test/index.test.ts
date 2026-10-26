import { describe, it, expect } from "vitest";
import { CLI_NAME, CLI_CORE } from "stackdoctor";

describe("apps/cli", () => {
  it("exports cli name and references core package", () => {
    expect(CLI_NAME).toBe("stackdoctor");
    expect(CLI_CORE).toBe("@stackdoctor/core");
  });
});
