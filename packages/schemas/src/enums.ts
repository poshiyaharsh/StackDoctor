import { z } from "zod";

export const SeveritySchema = z.enum(["info", "low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const ConfidenceSchema = z.enum(["confirmed", "likely", "possible"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const CheckStatusSchema = z.enum(["passed", "warning", "failed", "skipped", "error"]);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

export const ReportStatusSchema = z.enum([
  "completed",
  "completed_with_warnings",
  "failed",
  "cancelled"
]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const VerificationStatusSchema = z.enum([
  "unverified",
  "verified",
  "failed"
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
