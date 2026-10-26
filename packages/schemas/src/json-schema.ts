import { zodToJsonSchema } from "zod-to-json-schema";
import { ReportSchema } from "./report.js";

export function getReportJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(ReportSchema, {
    name: "StackDoctorReport",
    target: "jsonSchema7"
  }) as Record<string, unknown>;
}
