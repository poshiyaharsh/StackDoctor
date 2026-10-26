import { z } from "zod";
import { SeveritySchema, ConfidenceSchema } from "./enums.js";

export const RuleMetadataSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(256),
  description: z.string().min(1).max(2000),
  technologies: z.array(z.string().min(1).max(128)).min(1),
  severity: SeveritySchema,
  confidence: ConfidenceSchema,
  docs: z.array(z.string().min(1)).default([])
});
export type RuleMetadata = z.infer<typeof RuleMetadataSchema>;
