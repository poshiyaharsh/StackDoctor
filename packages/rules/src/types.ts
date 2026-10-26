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
    envVarNames?: string[];
  };
  technologies: TechnologyDetection[];
  evidence: Evidence[];
  runtime?: {
    nodeVersion?: string;
    nodeRequirement?: {
      declared: boolean;
      rawRange?: string;
      sourceFile?: string;
    };
    hasActivePythonVenv?: boolean;
    hasLocalPythonVenv?: boolean;
    installedPythonVersion?: string;
  };
  ports?: {
    declaredPorts?: Array<{
      port: number;
      source: string;
      rawValue: string;
      valid: boolean;
      error?: string;
    }>;
    portChecks?: Array<{
      port: number;
      host: string;
      status: "available" | "in_use" | "unknown" | "invalid";
      conclusive: boolean;
      processInfo?: { pid?: number; name?: string };
      error?: string;
    }>;
  };
  config?: {
    missingEnvVarNames?: string[];
    runtimeConflict?: {
      hasConflict: boolean;
      nodeEngines?: string;
      nvmrc?: string;
      reason?: string;
    };
    compose?: {
      hasCompose: boolean;
      services: string[];
      missingReferencedServices: Array<{
        serviceName: string;
        source: string;
      }>;
    };
  };
  database?: {
    diagnostics?: Array<{
      dbType: "mongodb" | "mysql" | "unknown";
      host: string;
      port: number;
      scheme?: string;
      databaseName?: string;
      finalCategory?:
        | "dns_failure"
        | "connection_refused"
        | "timeout"
        | "unreachable_network"
        | "tls_error"
        | "auth_failed"
        | "authorization_failed"
        | "protocol_error"
        | "unknown";
      error?: string;
    }>;
  };
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
