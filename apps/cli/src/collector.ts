import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { ScanResult } from "@stackdoctor/core";
import {
  extractEnvVarNames,
  type RuleEvaluationContext
} from "@stackdoctor/rules";
import {
  detectNodeRequirement,
  detectDeclaredPorts,
  checkPort,
  compareEnvVariableNames,
  checkRuntimeConflicts,
  inspectComposeServices,
  runStagedDatabaseCheck,
  comparePythonDependencies,
  isDjangoProject,
  discoverDjangoSettings,
  checkDjangoMigrations
} from "@stackdoctor/adapters";
import type { CliOptions } from "./index.js";

/**
 * Assembles a comprehensive RuleEvaluationContext for the scanned project
 * by running non-intrusive adapters and collecting evidence safely.
 */
export async function collectEvaluationContext(
  dir: string,
  opts: Pick<CliOptions, "dbUrlEnv" | "allowProjectCode">,
  scanResult: ScanResult
): Promise<RuleEvaluationContext> {
  // 1. Files & Env
  let envExampleVarNames: string[] = [];
  const envExamplePath = path.join(dir, ".env.example");
  const envPath = path.join(dir, ".env");

  if (fs.existsSync(envExamplePath)) {
    try {
      const content = fs.readFileSync(envExamplePath, "utf-8");
      envExampleVarNames = extractEnvVarNames(content);
    } catch {
      // Ignore read errors
    }
  }

  // 2. Runtimes
  const nodeReq = detectNodeRequirement(dir);
  const hasActivePythonVenv = Boolean(process.env.VIRTUAL_ENV);
  const hasLocalPythonVenv =
    fs.existsSync(path.join(dir, ".venv")) || fs.existsSync(path.join(dir, "venv"));

  // 3. Ports
  const declaredPorts = detectDeclaredPorts(dir);
  const portChecks: NonNullable<RuleEvaluationContext["ports"]>["portChecks"] = [];

  for (const dp of declaredPorts) {
    if (dp.valid && dp.port > 0) {
      try {
        const check = await checkPort("127.0.0.1", dp.port, 300);
        portChecks.push({
          port: check.port,
          host: check.host,
          status: check.status,
          conclusive: check.conclusive,
          processInfo: check.processInfo
            ? { pid: check.processInfo.pid, name: check.processInfo.name }
            : undefined,
          error: check.error
        });
      } catch {
        // Safe runner never throws
      }
    }
  }

  // 4. Configuration
  const envComparison = compareEnvVariableNames(dir);
  const conflict = checkRuntimeConflicts(dir);

  // Scan compose file and config for referenced services
  const composePath = path.join(dir, "docker-compose.yml");
  const composeAltPath = path.join(dir, "compose.yaml");
  const hasCompose = fs.existsSync(composePath) || fs.existsSync(composeAltPath);
  let composeServices: string[] = [];
  let missingReferencedServices: Array<{ serviceName: string; source: string }> = [];

  if (hasCompose) {
    const potentialReferenced: string[] = [];
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, "utf-8");
        const matches = envContent.matchAll(/(?:HOST|URL|SERVICE)[=:\s]+(?:\w+:\/\/)?([a-zA-Z0-9_-]+)/gi);
        for (const m of matches) {
          if (m[1] && m[1] !== "localhost" && m[1] !== "127" && m[1] !== "0") {
            potentialReferenced.push(m[1].toLowerCase());
          }
        }
      } catch {
        // Ignore read errors
      }
    }

    const composeInfo = inspectComposeServices(dir);
    composeServices = composeInfo.services;
    missingReferencedServices = composeInfo.missingReferencedServices;
  }

  // 5. Database Diagnostics
  const dbDiagnostics: NonNullable<RuleEvaluationContext["database"]>["diagnostics"] = [];
  const dbEndpointsToCheck: Array<{ dbType: "mongodb" | "mysql"; host: string; port: number }> = [];

  for (const s of composeServices) {
    if (s.includes("mongo")) {
      dbEndpointsToCheck.push({ dbType: "mongodb", host: "localhost", port: 27017 });
    }
    if (s.includes("mysql")) {
      dbEndpointsToCheck.push({ dbType: "mysql", host: "localhost", port: 3306 });
    }
  }

  const envFilesToScan = [envPath, envExamplePath];
  for (const ef of envFilesToScan) {
    if (fs.existsSync(ef)) {
      try {
        const content = fs.readFileSync(ef, "utf-8");
        const mongoMatch = content.match(/mongodb:\/\/(?:[^:@]+(?::[^@]+)?@)?([^:/]+)(?::(\d+))?/i);
        if (mongoMatch && mongoMatch[1]) {
          const host = mongoMatch[1];
          const port = mongoMatch[2] ? parseInt(mongoMatch[2], 10) : 27017;
          if (!dbEndpointsToCheck.some((e) => e.host === host && e.port === port)) {
            dbEndpointsToCheck.push({ dbType: "mongodb", host, port });
          }
        }

        const mysqlMatch = content.match(/mysql:\/\/(?:[^:@]+(?::[^@]+)?@)?([^:/]+)(?::(\d+))?/i);
        if (mysqlMatch && mysqlMatch[1]) {
          const host = mysqlMatch[1];
          const port = mysqlMatch[2] ? parseInt(mysqlMatch[2], 10) : 3306;
          if (!dbEndpointsToCheck.some((e) => e.host === host && e.port === port)) {
            dbEndpointsToCheck.push({ dbType: "mysql", host, port });
          }
        }

        const hostVarMatch = content.match(/(?:MONGO_HOST|MYSQL_HOST|DB_HOST)\s*=\s*([^\s#]+)/i);
        if (hostVarMatch && hostVarMatch[1]) {
          const rawHost = hostVarMatch[1].trim();
          if (rawHost.endsWith(".invalid") || rawHost.includes("fail") || rawHost.includes("unresolvable")) {
            const isMongo = content.toLowerCase().includes("mongo");
            dbEndpointsToCheck.push({
              dbType: isMongo ? "mongodb" : "mysql",
              host: rawHost,
              port: isMongo ? 27017 : 3306
            });
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  for (const ep of dbEndpointsToCheck) {
    try {
      const diag = await runStagedDatabaseCheck({
        host: ep.host,
        port: ep.port,
        dbType: ep.dbType,
        dbUrlEnvVar: opts.dbUrlEnv
      });
      dbDiagnostics.push(diag);
    } catch {
      // Safe runner never throws
    }
  }

  // 6. Python & Django
  const pyDeps = await comparePythonDependencies(dir);
  const missingPackages = pyDeps.missingPackages.map((p) => ({
    name: p.name,
    specifier: p.specifier,
    source: p.source
  }));
  const mismatchedPackages = pyDeps.mismatchedPackages.map((m) => ({
    name: m.declared.name,
    installedVersion: m.installedVersion,
    expectedSpecifier: m.expectedSpecifier,
    source: m.declared.source
  }));

  const isDjango = isDjangoProject(dir);
  let djangoSettings: NonNullable<RuleEvaluationContext["django"]>["settings"];
  let djangoMigrations: NonNullable<RuleEvaluationContext["django"]>["migrations"];

  if (isDjango) {
    const disc = discoverDjangoSettings(dir);
    djangoSettings = {
      discovered: disc.discovered,
      moduleName: disc.moduleName,
      expectedFilePath: disc.expectedFilePath,
      fileExists: disc.fileExists
    };

    const mig = await checkDjangoMigrations(dir, opts.allowProjectCode);
    djangoMigrations = {
      status: mig.status,
      reason: mig.reason,
      pendingCount: mig.pendingCount,
      unappliedList: mig.unappliedList
    };
  }

  // 7. Assemble full RuleEvaluationContext
  const evalCtx: RuleEvaluationContext = {
    dir,
    files: {
      ...scanResult.detectedFiles,
      envExampleVarNames
    },
    technologies: scanResult.technologies,
    evidence: scanResult.technologies.flatMap((t) => t.evidence),
    runtime: {
      nodeVersion: process.version,
      nodeRequirement: nodeReq.declared
        ? {
            declared: true,
            rawRange: nodeReq.rawRange,
            sourceFile: nodeReq.sourceFile
          }
        : undefined,
      hasActivePythonVenv,
      hasLocalPythonVenv,
      installedPythonVersion: undefined
    },
    ports: {
      declaredPorts: declaredPorts.map((dp) => ({
        port: dp.port,
        source: dp.source,
        rawValue: dp.rawValue,
        valid: dp.valid,
        error: dp.error
      })),
      portChecks
    },
    config: {
      missingEnvVarNames: envComparison.missingVars,
      runtimeConflict: {
        hasConflict: conflict.hasConflict,
        nodeEngines: conflict.nodeEngines,
        nvmrc: conflict.nvmrc,
        reason: conflict.reason
      },
      compose: {
        hasCompose,
        services: composeServices,
        missingReferencedServices
      }
    },
    database: {
      diagnostics: dbDiagnostics
    },
    python: {
      hasDeclaredDeps: pyDeps.hasDeclaredDeps,
      missingPackages,
      mismatchedPackages
    },
    django: {
      isDjangoProject: isDjango,
      settings: djangoSettings,
      migrations: djangoMigrations
    }
  };

  return evalCtx;
}
