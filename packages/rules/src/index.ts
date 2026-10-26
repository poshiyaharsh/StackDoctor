import { RuleRegistry } from "./registry.js";
import { nodeDepsNotInstalledRule } from "./rules/node-deps-not-installed.js";
import { envExamplePresentNoEnvRule } from "./rules/env-example-no-env.js";
import { nodeVersionMismatchRule } from "./rules/node-version-mismatch.js";
import { lockfileMissingRule } from "./rules/lockfile-missing.js";
import { pythonVenvMissingRule } from "./rules/python-venv-missing.js";

export * from "./types.js";
export * from "./registry.js";
export * from "./rules/node-deps-not-installed.js";
export * from "./rules/env-example-no-env.js";
export * from "./rules/node-version-mismatch.js";
export * from "./rules/lockfile-missing.js";
export * from "./rules/python-venv-missing.js";

export const RULES_PACKAGE = "@stackdoctor/rules";
export const RULES_DEPENDENCY = "@stackdoctor/schemas";

/**
 * Creates and initializes a RuleRegistry populated with all standard StackDoctor rules.
 */
export function createDefaultRuleRegistry(): RuleRegistry {
  const registry = new RuleRegistry();
  registry.register(nodeDepsNotInstalledRule);
  registry.register(envExamplePresentNoEnvRule);
  registry.register(nodeVersionMismatchRule);
  registry.register(lockfileMissingRule);
  registry.register(pythonVenvMissingRule);
  return registry;
}
