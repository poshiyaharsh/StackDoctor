import { z } from "zod";
import { SeveritySchema, ConfidenceSchema, CheckStatusSchema, VerificationStatusSchema } from "./enums.js";
import { EvidenceSchema } from "./evidence.js";
import { DocUrlSchema } from "./rules.js";

export const RecommendationSchema = z.object({
  problem: z.string().min(1).max(1000),
  relevance: z.string().min(1).max(1000),
  commandOrAction: z.string().min(1).max(2000),
  expectedResult: z.string().min(1).max(1000),
  risks: z.string().min(1).max(1000),
  undo: z.string().max(2000).optional(),
  verification: z.string().min(1).max(1000)
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const FindingSchema = z.object({
  ruleId: z.string().min(1).max(128),
  title: z.string().min(1).max(256),
  category: z.string().min(1).max(128),
  severity: SeveritySchema,
  confidence: ConfidenceSchema,
  status: CheckStatusSchema,
  evidence: z.array(EvidenceSchema).default([]),
  possibleCauses: z.array(z.string().min(1).max(1000)).default([]),
  recommendations: z.array(RecommendationSchema).default([]),
  verificationStatus: VerificationStatusSchema.default("unverified"),
  docs: z.array(DocUrlSchema).default([])
});
export type Finding = z.infer<typeof FindingSchema>;
