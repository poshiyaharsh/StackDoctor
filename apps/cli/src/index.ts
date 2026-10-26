import { CORE_PACKAGE } from "@stackdoctor/core";

export const CLI_NAME = "stackdoctor";
export const CLI_CORE = CORE_PACKAGE;

export function main(): void {
  console.log(`${CLI_NAME} scaffold initialized using ${CLI_CORE}`);
}
