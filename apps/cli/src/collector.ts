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
  checkDjangoMigrations,
  detectJavaRuntime,
  detectJavaRequirement,
  inspectSpringBootConfig,
  detectPhpRuntime,
  detectPhpRequirement,
  inspectComposerDependencies,
  inspectLaravelConfig,
  detectDotnetRuntime,
  inspectDotnetProjects,
  findSqliteConfigurations
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
        const check = await checkPort("127.0.0.1", dp.port, 3000);
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
  const dbEndpointsToCheck: Array<{
    dbType: "mongodb" | "mysql" | "postgresql" | "mssql";
    host: string;
    port: number;
  }> = [];

  // Scan active environment files (.env, .env.local) - never probe unconfigured examples (.env.example)
  const envFilesToScan = [envPath, path.join(dir, ".env.local")].filter((f) => fs.existsSync(f));
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

        const pgMatch = content.match(/postgres(?:ql)?:\/\/(?:[^:@]+(?::[^@]+)?@)?([^:/]+)(?::(\d+))?/i);
        if (pgMatch && pgMatch[1]) {
          const host = pgMatch[1];
          const port = pgMatch[2] ? parseInt(pgMatch[2], 10) : 5432;
          if (!dbEndpointsToCheck.some((e) => e.host === host && e.port === port)) {
            dbEndpointsToCheck.push({ dbType: "postgresql", host, port });
          }
        }

        const pgHostMatch = content.match(/(?:POSTGRES_HOST|PGHOST)\s*=\s*([^\s#]+)/i);
        if (pgHostMatch && pgHostMatch[1]) {
          const host = pgHostMatch[1].trim();
          const portMatch = content.match(/(?:POSTGRES_PORT|PGPORT)\s*=\s*(\d+)/i);
          const port = portMatch && portMatch[1] ? parseInt(portMatch[1], 10) : 5432;
          if (!dbEndpointsToCheck.some((e) => e.host === host && e.port === port)) {
            dbEndpointsToCheck.push({ dbType: "postgresql", host, port });
          }
        }

        const mssqlMatch = content.match(/(?:mssql|sqlserver):\/\/(?:[^:@]+(?::[^@]+)?@)?([^:/]+)(?::(\d+))?/i);
        if (mssqlMatch && mssqlMatch[1]) {
          const host = mssqlMatch[1];
          const port = mssqlMatch[2] ? parseInt(mssqlMatch[2], 10) : 1433;
          if (!dbEndpointsToCheck.some((e) => e.host === host && e.port === port)) {
            dbEndpointsToCheck.push({ dbType: "mssql", host, port });
          }
        }

        const mssqlHostMatch = content.match(/(?:MSSQL_HOST|SQLSERVER_HOST)\s*=\s*([^\s#]+)/i);
        if (mssqlHostMatch && mssqlHostMatch[1]) {
          const host = mssqlHostMatch[1].trim();
          const portMatch = content.match(/(?:MSSQL_PORT|SQLSERVER_PORT)\s*=\s*(\d+)/i);
          const port = portMatch && portMatch[1] ? parseInt(portMatch[1], 10) : 1433;
          if (!dbEndpointsToCheck.some((e) => e.host === host && e.port === port)) {
            dbEndpointsToCheck.push({ dbType: "mssql", host, port });
          }
        }

        const hostVarMatch = content.match(/(?:MONGO_HOST|MYSQL_HOST|DB_HOST)\s*=\s*([^\s#]+)/i);
        if (hostVarMatch && hostVarMatch[1]) {
          const rawHost = hostVarMatch[1].trim();
          if (rawHost.endsWith(".invalid") || rawHost.includes("fail") || rawHost.includes("unresolvable")) {
            const isMongo = content.toLowerCase().includes("mongo");
            const isPg =
              content.toLowerCase().includes("postgres") ||
              content.toLowerCase().includes("pgsql");
            dbEndpointsToCheck.push({
              dbType: isPg ? "postgresql" : isMongo ? "mongodb" : "mysql",
              host: rawHost,
              port: isPg ? 5432 : isMongo ? 27017 : 3306
            });
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  // Check Prisma schema
  const prismaSchemaPath = path.join(dir, "prisma", "schema.prisma");
  let hasPgPrisma = false;
  if (fs.existsSync(prismaSchemaPath)) {
    try {
      const prismaContent = fs.readFileSync(prismaSchemaPath, "utf-8");
      if (
        /provider\s*=\s*["']postgresql["']/i.test(prismaContent) ||
        /provider\s*=\s*["']postgres["']/i.test(prismaContent)
      ) {
        hasPgPrisma = true;
      }
    } catch {
      // Ignore
    }
  }

  const hasMongoEndpoint =
    dbEndpointsToCheck.some((e) => e.dbType === "mongodb") ||
    envFilesToScan.some((ef) => {
      if (!fs.existsSync(ef)) return false;
      try {
        const c = fs.readFileSync(ef, "utf-8");
        return /MONGO_HOST|mongodb:\/\//i.test(c);
      } catch {
        return false;
      }
    });

  const hasMysqlEndpoint =
    dbEndpointsToCheck.some((e) => e.dbType === "mysql") ||
    envFilesToScan.some((ef) => {
      if (!fs.existsSync(ef)) return false;
      try {
        const c = fs.readFileSync(ef, "utf-8");
        return /MYSQL_HOST|mysql:\/\//i.test(c);
      } catch {
        return false;
      }
    });

  const hasPgEndpoint =
    dbEndpointsToCheck.some((e) => e.dbType === "postgresql") ||
    hasPgPrisma ||
    envFilesToScan.some((ef) => {
      if (!fs.existsSync(ef)) return false;
      try {
        const c = fs.readFileSync(ef, "utf-8");
        return /POSTGRES_HOST|PGHOST|postgres(?:ql)?:\/\//i.test(c);
      } catch {
        return false;
      }
    });

  for (const s of composeServices) {
    if (s.includes("mongo") && !hasMongoEndpoint) {
      dbEndpointsToCheck.push({ dbType: "mongodb", host: "localhost", port: 27017 });
    }
    if (s.includes("mysql") && !hasMysqlEndpoint) {
      dbEndpointsToCheck.push({ dbType: "mysql", host: "localhost", port: 3306 });
    }
    if ((s.includes("postgres") || s.includes("psql")) && !hasPgEndpoint) {
      dbEndpointsToCheck.push({ dbType: "postgresql", host: "localhost", port: 5432 });
    }
    if ((s.includes("mssql") || s.includes("sqlserver")) && !dbEndpointsToCheck.some((e) => e.dbType === "mssql")) {
      dbEndpointsToCheck.push({ dbType: "mssql", host: "localhost", port: 1433 });
    }
  }

  if (hasPgPrisma && !dbEndpointsToCheck.some((e) => e.dbType === "postgresql")) {
    dbEndpointsToCheck.push({ dbType: "postgresql", host: "localhost", port: 5432 });
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

  // SQLite database static inspection
  const sqliteConfigs = findSqliteConfigurations(dir);
  for (const sq of sqliteConfigs) {
    if (sq.errorCategory) {
      dbDiagnostics.push({
        dbType: "sqlite",
        host: "localhost",
        port: 0,
        finalCategory: sq.errorCategory,
        error: sq.error
      });
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

  // 6c. Java & Spring Boot Diagnostics
  const isJava = scanResult.technologies.some((t) => t.name === "Java");
  let javaContext: RuleEvaluationContext["java"];
  let springBootContext: RuleEvaluationContext["springBoot"];

  if (isJava) {
    const javaRuntime = await detectJavaRuntime();
    const javaReq = detectJavaRequirement(dir);
    javaContext = {
      installed: javaRuntime.installed,
      rawVersion: javaRuntime.rawVersion,
      majorVersion: javaRuntime.majorVersion,
      requirement: javaReq
    };

    const springConfig = inspectSpringBootConfig(dir);
    springBootContext = springConfig;

    if (
      springConfig.serverPort &&
      !declaredPorts.some((dp) => dp.port === springConfig.serverPort)
    ) {
      declaredPorts.push({
        port: springConfig.serverPort,
        source: springConfig.configFilePath || "application.properties",
        rawValue: String(springConfig.serverPort),
        valid: true
      });

      const portCheck = await checkPort("127.0.0.1", springConfig.serverPort, 3000);
      portChecks.push({
        port: portCheck.port,
        host: portCheck.host,
        status: portCheck.status,
        conclusive: portCheck.conclusive,
        processInfo: portCheck.processInfo
          ? { pid: portCheck.processInfo.pid, name: portCheck.processInfo.name }
          : undefined,
        error: portCheck.error
      });
    }
  }

  // 6d. PHP, Composer & Laravel Diagnostics
  const isPhp = scanResult.technologies.some((t) => t.name === "PHP");
  let phpContext: RuleEvaluationContext["php"];
  let composerContext: RuleEvaluationContext["composer"];
  let laravelContext: RuleEvaluationContext["laravel"];

  if (isPhp) {
    const phpRuntime = await detectPhpRuntime();
    const phpReq = await detectPhpRequirement(dir);
    phpContext = {
      installed: phpRuntime.available,
      version: phpRuntime.version,
      rawOutput: phpRuntime.rawOutput,
      requirement: phpReq
        ? {
            declared: true,
            requiredVersion: phpReq.requiredVersion,
            sourceFile: phpReq.sourceFile
          }
        : undefined
    };

    composerContext = await inspectComposerDependencies(dir);
    laravelContext = await inspectLaravelConfig(dir);
  }

  // 6e. .NET & ASP.NET Core Diagnostics
  const isDotnet = scanResult.technologies.some(
    (t) => t.name === ".NET" || t.name === "C#" || t.name === "ASP.NET Core"
  );
  let dotnetContext: RuleEvaluationContext["dotnet"];

  if (isDotnet) {
    const dotnetRuntime = await detectDotnetRuntime();
    const dotnetProjects = await inspectDotnetProjects(dir);

    dotnetContext = {
      installed: dotnetRuntime.available,
      version: dotnetRuntime.version,
      majorVersion: dotnetRuntime.majorVersion,
      projects: dotnetProjects
    };

    // If any project defines a launchPort, probe it and register in declaredPorts
    for (const proj of dotnetProjects) {
      if (proj.launchPort && !declaredPorts.some((dp) => dp.port === proj.launchPort)) {
        declaredPorts.push({
          port: proj.launchPort,
          source: `${proj.projectFile} (launchSettings.json)`,
          rawValue: String(proj.launchPort),
          valid: true
        });

        const portCheck = await checkPort("127.0.0.1", proj.launchPort, 3000);
        portChecks.push({
          port: portCheck.port,
          host: portCheck.host,
          status: portCheck.status,
          conclusive: portCheck.conclusive,
          processInfo: portCheck.processInfo
            ? { pid: portCheck.processInfo.pid, name: portCheck.processInfo.name }
            : undefined,
          error: portCheck.error
        });
      }
    }
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
      diagnostics: dbDiagnostics,
      sqlite: sqliteConfigs
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
    },
    java: javaContext,
    springBoot: springBootContext,
    php: phpContext,
    composer: composerContext,
    laravel: laravelContext,
    dotnet: dotnetContext
  };

  return evalCtx;
}
