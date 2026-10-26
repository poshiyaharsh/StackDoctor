import { z } from "zod";
import { CheckStatusSchema } from "./enums.js";
import { EvidenceSchema } from "./evidence.js";

export const CheckResultSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(256),
  category: z.string().min(1).max(128),
  status: CheckStatusSchema,
  durationMs: z.number().nonnegative(),
  evidence: z.array(EvidenceSchema).default([]),
  error: z.string().max(2000).optional()
});
export type CheckResult = z.infer<typeof CheckResultSchema>;
