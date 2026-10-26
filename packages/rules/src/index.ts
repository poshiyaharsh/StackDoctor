import { RuleRegistry } from "./registry.js";
import { nodeDepsNotInstalledRule } from "./rules/node-deps-not-installed.js";
import { envExamplePresentNoEnvRule } from "./rules/env-example-no-env.js";

export * from "./types.js";
export * from "./registry.js";
export * from "./rules/node-deps-not-installed.js";
export * from "./rules/env-example-no-env.js";

export const RULES_PACKAGE = "@stackdoctor/rules";
export const RULES_DEPENDENCY = "@stackdoctor/schemas";

/**
 * Creates and initializes a RuleRegistry populated with all standard StackDoctor rules.
 */
export function createDefaultRuleRegistry(): RuleRegistry {
  const registry = new RuleRegistry();
  registry.register(nodeDepsNotInstalledRule);
  registry.register(envExamplePresentNoEnvRule);
  return registry;
}
