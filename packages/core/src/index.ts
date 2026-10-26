export * from "./redact.js";
export * from "./scanner.js";
export * from "./logger.js";
export * from "./runner.js";
export * from "./issue-draft.js";
export * from "./compare.js";

export const CORE_PACKAGE = "@stackdoctor/core";
export const CORE_DEPENDENCIES = [
  "@stackdoctor/schemas",
  "@stackdoctor/rules",
  "@stackdoctor/adapters"
] as const;

