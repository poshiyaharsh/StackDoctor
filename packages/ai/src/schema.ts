import { z } from "zod";

/**
 * Schema for an individual ranked potential root cause.
 */
export const RootCauseRankingItemSchema = z
  .object({
    cause: z.string().min(1),
    likelihood: z.enum(["high", "medium", "low"]),
    reasoning: z.string().min(1),
    supportingEvidenceIds: z.array(z.string())
  })
  .strict();

export type RootCauseRankingItem = z.infer<typeof RootCauseRankingItemSchema>;

/**
 * Schema for confirmed facts strictly tied to observed evidence.
 * Must cite at least one valid evidence ID.
 */
export const ConfirmedFactItemSchema = z
  .object({
    statement: z.string().min(1),
    evidenceIds: z.array(z.string().min(1)).min(1)
  })
  .strict();

export type ConfirmedFactItem = z.infer<typeof ConfirmedFactItemSchema>;

/**
 * Schema for automated hypotheses and what would confirm or refute them.
 */
export const HypothesisItemSchema = z
  .object({
    statement: z.string().min(1),
    whatWouldConfirmIt: z.string().min(1)
  })
  .strict();

export type HypothesisItem = z.infer<typeof HypothesisItemSchema>;

/**
 * Strict schema for AI-generated diagnostic explanations.
 * Strictly separates confirmed facts from probabilistic hypotheses.
 */
export const AiExplanationSchema = z
  .object({
    summary: z.string().min(1),
    rootCauseRanking: z.array(RootCauseRankingItemSchema),
    confirmedFacts: z.array(ConfirmedFactItemSchema),
    hypotheses: z.array(HypothesisItemSchema),
    checklist: z.array(z.string().min(1)),
    suggestedExtraChecks: z.array(z.string().min(1)),
    suggestedOperationIds: z.array(z.string().min(1))
  })
  .strict();

export type AiExplanation = z.infer<typeof AiExplanationSchema>;
