import { SCHEMAS_PACKAGE } from "@stackdoctor/schemas";
import { RULES_PACKAGE } from "@stackdoctor/rules";
import { ADAPTERS_PACKAGE } from "@stackdoctor/adapters";

export const CORE_PACKAGE = "@stackdoctor/core";
export const CORE_DEPENDENCIES = [SCHEMAS_PACKAGE, RULES_PACKAGE, ADAPTERS_PACKAGE] as const;
