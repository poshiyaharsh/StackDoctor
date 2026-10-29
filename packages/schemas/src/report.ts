import { z } from "zod";
import { ReportStatusSchema, SeveritySchema, CheckStatusSchema } from "./enums.js";
import { TechnologyDetectionSchema } from "./evidence.js";
import { CheckResultSchema } from "./checks.js";
import { FindingSchema } from "./findings.js";

export const MAX_REPORT_FINDINGS = 1_000;
export const CURRENT_SCHEMA_VERSION = "1.0.0";
export const CURRENT_TOOL_VERSION = "0.2.0";

export const ReportSummarySchema = z.object({
  totalChecks: z.number().int().nonnegative(),
  totalFindings: z.number().int().nonnegative(),
  bySeverity: z.record(SeveritySchema, z.number().int().nonnegative()),
  byStatus: z.record(CheckStatusSchema, z.number().int().nonnegative())
});
export type ReportSummary = z.infer<typeof ReportSummarySchema>;

export const ReportSchema = z.object({
  schemaVersion: z.string().min(1).default(CURRENT_SCHEMA_VERSION),
  toolVersion: z.string().min(1).default(CURRENT_TOOL_VERSION),
  operatingSystem: z.string().min(1).max(64),
  startedAt: z.string().datetime({ message: "startedAt must be an ISO 8601 string" }),
  completedAt: z.string().datetime({ message: "completedAt must be an ISO 8601 string" }),
  status: ReportStatusSchema,
  projectName: z.string().min(1).max(256),
  technologies: z.array(TechnologyDetectionSchema).default([]),
  checks: z.array(CheckResultSchema).default([]),
  findings: z.array(FindingSchema).max(MAX_REPORT_FINDINGS).default([]),
  summary: ReportSummarySchema
});
export type Report = z.infer<typeof ReportSchema>;

export type ValidateReportResult =
  | { success: true; data: Report }
  | { success: false; errors: string[] };

export function validateReport(input: unknown): ValidateReportResult {
  const result = ReportSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map((err) => {
      const field = err.path.length > 0 ? err.path.join(".") : "root";
      return `[${field}] ${err.message}`;
    })
  };
}
