import { Router, Request, Response } from "express";
import { createDefaultRuleRegistry, Rule } from "@stackdoctor/rules";
import type { Severity, Confidence, Recommendation } from "@stackdoctor/schemas";
import { requireAuth } from "../middleware/auth.js";

export const rulesRouter = Router();

// Enforce authentication for rules inspection
rulesRouter.use(requireAuth);

const registry = createDefaultRuleRegistry();

export interface RuleMetadataDto {
  id: string;
  title: string;
  category?: string;
  description: string;
  technologies: string[];
  severity: Severity;
  confidence: Confidence;
  requiredEvidence: string[];
  recommendedChecks: string[];
  remediation: Recommendation[];
  verification: string;
  docs: string[];
}

function toRuleMetadata(rule: Rule): RuleMetadataDto {
  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    description: rule.description,
    technologies: rule.technologies,
    severity: rule.severity,
    confidence: rule.confidence,
    requiredEvidence: rule.requiredEvidence,
    recommendedChecks: rule.recommendedChecks,
    remediation: rule.remediation,
    verification: rule.verification,
    docs: rule.docs
  };
}

/**
 * GET /api/v1/rules
 * List all rules metadata available in the system.
 */
rulesRouter.get("/", (_req: Request, res: Response): void => {
  const allRules = registry.list();
  const rules = allRules.map(toRuleMetadata);
  res.status(200).json({
    total: rules.length,
    rules
  });
});

/**
 * GET /api/v1/rules/:ruleId
 * Retrieve single rule metadata by ruleId.
 */
rulesRouter.get("/:ruleId", (req: Request, res: Response): void => {
  const ruleId = String(req.params.ruleId);
  const rule = registry.get(ruleId);
  if (!rule) {
    res.status(404).json({
      error: {
        code: "NotFound",
        message: `Rule '${ruleId}' not found`
      }
    });
    return;
  }

  res.status(200).json({
    rule: toRuleMetadata(rule)
  });
});
