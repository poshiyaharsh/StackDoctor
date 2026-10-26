import { RuleRegistry } from "./registry.js";
import { nodeDepsNotInstalledRule } from "./rules/node-deps-not-installed.js";
import { envExamplePresentNoEnvRule } from "./rules/env-example-no-env.js";
import { nodeVersionMismatchRule } from "./rules/node-version-mismatch.js";
import { lockfileMissingRule } from "./rules/lockfile-missing.js";
import { pythonVenvMissingRule } from "./rules/python-venv-missing.js";
import { portInUseRule } from "./rules/port-in-use.js";
import { envVarNamesMissingRule } from "./rules/env-var-names-missing.js";
import { portInvalidRule } from "./rules/port-invalid.js";
import { runtimeDeclarationsConflictRule } from "./rules/runtime-declarations-conflict.js";
import { composeServiceNotFoundRule } from "./rules/compose-service-not-found.js";
import { mongoConnectionRefusedRule } from "./rules/mongo-connection-refused.js";
import { mongoAuthFailedRule } from "./rules/mongo-auth-failed.js";
import { mysqlConnectionRefusedRule } from "./rules/mysql-connection-refused.js";
import { mysqlAuthFailedRule } from "./rules/mysql-auth-failed.js";
import { dbHostNotResolvedRule } from "./rules/db-host-not-resolved.js";
import { dbConnectionTimeoutRule } from "./rules/db-connection-timeout.js";

export * from "./types.js";
export * from "./registry.js";
export * from "./rules/node-deps-not-installed.js";
export * from "./rules/env-example-no-env.js";
export * from "./rules/node-version-mismatch.js";
export * from "./rules/lockfile-missing.js";
export * from "./rules/python-venv-missing.js";
export * from "./rules/port-in-use.js";
export * from "./rules/env-var-names-missing.js";
export * from "./rules/port-invalid.js";
export * from "./rules/runtime-declarations-conflict.js";
export * from "./rules/compose-service-not-found.js";
export * from "./rules/mongo-connection-refused.js";
export * from "./rules/mongo-auth-failed.js";
export * from "./rules/mysql-connection-refused.js";
export * from "./rules/mysql-auth-failed.js";
export * from "./rules/db-host-not-resolved.js";
export * from "./rules/db-connection-timeout.js";

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
  registry.register(portInUseRule);
  registry.register(envVarNamesMissingRule);
  registry.register(portInvalidRule);
  registry.register(runtimeDeclarationsConflictRule);
  registry.register(composeServiceNotFoundRule);
  registry.register(mongoConnectionRefusedRule);
  registry.register(mongoAuthFailedRule);
  registry.register(mysqlConnectionRefusedRule);
  registry.register(mysqlAuthFailedRule);
  registry.register(dbHostNotResolvedRule);
  registry.register(dbConnectionTimeoutRule);
  return registry;
}
