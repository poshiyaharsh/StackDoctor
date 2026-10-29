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
      dbType: "mongodb" | "mysql" | "postgresql" | "mssql" | "sqlite" | "unknown";
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
        | "database_not_found"
        | "ssl_required"
        | "protocol_error"
        | "file_not_found"
        | "directory_not_found"
        | "corrupted_file"
        | "permission_denied"
        | "unknown";
      error?: string;
    }>;
    sqlite?: Array<{
      filePath: string;
      resolvedPath: string;
      source: string;
      exists: boolean;
      dirExists: boolean;
      sizeBytes?: number;
      isValidSqliteHeader?: boolean;
      isReadable?: boolean;
      isWritable?: boolean;
      error?: string;
      errorCategory?:
        | "dns_failure"
        | "connection_refused"
        | "timeout"
        | "unreachable_network"
        | "tls_error"
        | "auth_failed"
        | "authorization_failed"
        | "database_not_found"
        | "ssl_required"
        | "protocol_error"
        | "file_not_found"
        | "directory_not_found"
        | "corrupted_file"
        | "permission_denied"
        | "unknown";
    }>;
  };
  python?: {
    hasDeclaredDeps?: boolean;
    missingPackages?: Array<{
      name: string;
      specifier?: string;
      source: string;
    }>;
    mismatchedPackages?: Array<{
      name: string;
      installedVersion: string;
      expectedSpecifier: string;
      source?: string;
    }>;
  };
  django?: {
    isDjangoProject?: boolean;
    settings?: {
      discovered: boolean;
      moduleName?: string;
      expectedFilePath?: string;
      fileExists: boolean;
    };
    migrations?: {
      status: "passed" | "pending" | "skipped" | "error";
      reason?: string;
      pendingCount?: number;
      unappliedList?: string[];
    };
  };
  java?: {
    installed: boolean;
    rawVersion?: string;
    majorVersion?: number;
    requirement?: {
      declared: boolean;
      requiredVersion?: string;
      requiredMajor?: number;
      sourceFile?: string;
      sourceProperty?: string;
    };
  };
  springBoot?: {
    isSpringBoot: boolean;
    hasDataDependency: boolean;
    hasEmbeddedDatabase: boolean;
    datasourceUrlConfigured: boolean;
    serverPort?: number;
    serverPortDeclared: boolean;
    configFilePath?: string;
  };
  php?: {
    installed: boolean;
    version?: string | null;
    rawOutput?: string;
    requirement?: {
      declared: boolean;
      requiredVersion?: string;
      sourceFile?: string;
    };
  };
  composer?: {
    hasComposerJson: boolean;
    hasVendor: boolean;
    hasAutoload: boolean;
    declaredDepsCount: number;
    missingVendor: boolean;
  };
  laravel?: {
    isLaravel: boolean;
    hasArtisan: boolean;
    hasAppKey: boolean;
    keyIsMissingOrEmpty: boolean;
  };
  dotnet?: {
    installed: boolean;
    version?: string | null;
    majorVersion?: number;
    projects: Array<{
      projectFile: string;
      projectName: string;
      targetFramework?: string;
      targetFrameworkMajor?: number;
      packageReferences: string[];
      missingAssetsJson: boolean;
      launchPort?: number;
      launchUrl?: string;
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
