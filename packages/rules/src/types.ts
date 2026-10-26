import type {
  Severity,
  Confidence,
  Finding,
  Evidence,
  Recommendation,
  TechnologyDetection
} from "@stackdoctor/schemas";

export interface RuleEvaluationContext {
  dir: string;
  files: {
    hasPackageJson: boolean;
    hasNodeModules: boolean;
    hasLockfile: boolean;
    lockfileType?: "npm" | "pnpm" | "yarn" | "bun";
    hasEnvExample: boolean;
    hasEnv: boolean;
    envExamplePath?: string;
    envPath?: string;
    envExampleVarNames?: string[];
  };
  technologies: TechnologyDetection[];
  evidence: Evidence[];
}

export interface Rule {
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
  preconditions: (ctx: RuleEvaluationContext) => boolean;
  evaluate: (ctx: RuleEvaluationContext) => Finding | null;
}
