import { z } from "zod";
import { ConfidenceSchema } from "./enums.js";

export const MAX_EVIDENCE_OBSERVED_LENGTH = 10_000;
export const MAX_EVIDENCE_DESCRIPTION_LENGTH = 1_000;
export const MAX_EVIDENCE_SOURCE_LENGTH = 500;
export const MAX_EVIDENCE_ID_LENGTH = 128;
export const MAX_EVIDENCE_KIND_LENGTH = 128;

export const EvidenceSchema = z.object({
  id: z.string().min(1).max(MAX_EVIDENCE_ID_LENGTH),
  kind: z.string().min(1).max(MAX_EVIDENCE_KIND_LENGTH),
  description: z.string().min(1).max(MAX_EVIDENCE_DESCRIPTION_LENGTH),
  observed: z.string().max(MAX_EVIDENCE_OBSERVED_LENGTH),
  source: z.string().min(1).max(MAX_EVIDENCE_SOURCE_LENGTH),
  collectedAt: z.string().datetime({ message: "collectedAt must be an ISO 8601 string" })
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const TechnologyDetectionSchema = z.object({
  name: z.string().min(1).max(128),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema).default([])
});
export type TechnologyDetection = z.infer<typeof TechnologyDetectionSchema>;
