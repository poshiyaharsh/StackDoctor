import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  runDiagnostics,
  validateDirectory,
  type DiagnosticRule,
  type DiagnosticCheck,
  type DiagnosticContext
} from "@stackdoctor/core";
import {
  createDefaultRuleRegistry,
  extractEnvVarNames,
  type RuleEvaluationContext
} from "@stackdoctor/rules";
import { validateReport, type Report, CURRENT_TOOL_VERSION } from "@stackdoctor/schemas";
import { formatTerminalReport } from "./format.js";

export interface CliOptions {
  command: "scan" | "help" | "version";
  targetPath: string;
  json: boolean;
  outFile?: string;
  noColor: boolean;
  help: boolean;
  version: boolean;
}

export function parseCliArgs(argv: string[]): CliOptions {
  let command: "scan" | "help" | "version" = "scan";
  let targetPath = ".";
  let json = false;
  let outFile: string | undefined;
  let noColor = false;
  let help = false;
  let version = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      help = true;
      command = "help";
    } else if (arg === "--version" || arg === "-v") {
      version = true;
      command = "version";
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--no-color") {
      noColor = true;
    } else if (arg === "--out") {
      if (i + 1 < argv.length) {
        outFile = argv[++i];
      } else {
        throw new Error("Missing file path for --out flag");
      }
    } else if (arg?.startsWith("--out=")) {
      outFile = arg.slice(6);
    } else if (arg === "scan") {
      command = "scan";
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        targetPath = argv[++i] as string;
      }
    } else if (!arg?.startsWith("-")) {
      targetPath = arg as string;
    }
  }

  return {
    command,
    targetPath,
    json,
    outFile,
    noColor,
    help,
    version
  };
}

export function printHelp(): void {
  console.log(`
StackDoctor - Open-source developer environment diagnostics tool
Tagline: "Find the cause. Fix the environment. Ship the code."

USAGE:
  stackdoctor scan [path] [flags]
  stackdoctor [path] [flags]

COMMANDS:
  scan [path]        Scan and diagnose a project directory (default: current directory)

FLAGS:
  --json             Print valid JSON report to stdout
  --out <file>       Write valid JSON report to a file
  --no-color         Disable ANSI terminal colors
  --version, -v      Print StackDoctor version
  --help, -h         Display this help message

EXIT CODES:
  0                  Diagnostics passed with no critical or high severity findings
  1                  Diagnostics found environment issues (high or critical severity)
  2                  Tool error (invalid directory path, schema validation failure)
`);
}

/**
 * Runs the CLI with the provided arguments and returns the process exit code.
 */
export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCliArgs(argv);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  if (opts.version) {
    console.log(`StackDoctor v${CURRENT_TOOL_VERSION}`);
    return 0;
  }

  if (opts.help) {
    printHelp();
    return 0;
  }

  // 1. Validate target directory
  let realDir: string;
  try {
    realDir = validateDirectory(opts.targetPath);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  // 2. Load registry rules
  const registry = createDefaultRuleRegistry();
  const rules = registry.list();

  // 3. Create diagnostic checks and rule bridge
  const diagnosticChecks: DiagnosticCheck[] = [
    {
      id: "check_node_modules",
      title: "Check Node.js dependencies installed",
      category: "dependencies",
      execute: async (ctx: DiagnosticContext) => {
        if (!ctx.scanResult.detectedFiles.hasPackageJson) {
          return { status: "skipped", evidence: [] };
        }
        if (ctx.scanResult.detectedFiles.hasNodeModules) {
          return {
            status: "passed",
            evidence: [
              {
                id: "ev-node-modules-found",
                kind: "file_presence",
                description: "node_modules directory found",
                observed: "node_modules exists",
                source: "filesystem",
                collectedAt: new Date().toISOString()
              }
            ]
          };
        }
        return {
          status: "failed",
          evidence: [
            {
              id: "ev-node-modules-missing",
              kind: "file_presence",
              description: "node_modules directory is absent",
              observed: "package.json exists in the project root, but node_modules does not exist.",
              source: "filesystem",
              collectedAt: new Date().toISOString()
            }
          ]
        };
      }
    },
    {
      id: "check_env_file",
      title: "Check .env configuration presence",
      category: "configuration",
      execute: async (ctx: DiagnosticContext) => {
        if (!ctx.scanResult.detectedFiles.hasEnvExample) {
          return { status: "skipped", evidence: [] };
        }
        if (ctx.scanResult.detectedFiles.hasEnv) {
          return {
            status: "passed",
            evidence: [
              {
                id: "ev-env-found",
                kind: "file_presence",
                description: ".env file exists",
                observed: ".env file is present",
                source: "filesystem",
                collectedAt: new Date().toISOString()
              }
            ]
          };
        }
        return {
          status: "warning",
          evidence: [
            {
              id: "ev-env-missing",
              kind: "file_presence",
              description: ".env file is absent while .env.example exists",
              observed: ".env.example exists, but .env is absent.",
              source: "filesystem",
              collectedAt: new Date().toISOString()
            }
          ]
        };
      }
    }
  ];

  // Convert rules to runner diagnostic rules
  const bridgedRules: DiagnosticRule[] = rules.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    technologies: r.technologies,
    severity: r.severity,
    confidence: r.confidence,
    docs: r.docs,
    evaluate: (ctx: DiagnosticContext) => {
      // Safely extract variable names from .env.example without reading any secrets
      let envExampleVarNames: string[] = [];
      const envExamplePath = path.join(ctx.dir, ".env.example");
      if (fs.existsSync(envExamplePath)) {
        try {
          const content = fs.readFileSync(envExamplePath, "utf-8");
          envExampleVarNames = extractEnvVarNames(content);
        } catch {
          // Ignore read error
        }
      }

      const evalCtx: RuleEvaluationContext = {
        dir: ctx.dir,
        files: {
          ...ctx.scanResult.detectedFiles,
          envExampleVarNames
        },
        technologies: ctx.technologies,
        evidence: ctx.scanResult.technologies.flatMap((t) => t.evidence)
      };

      if (!r.preconditions(evalCtx)) {
        return null;
      }
      return r.evaluate(evalCtx);
    }
  }));

  // 4. Run diagnostics lifecycle
  let report: Report;
  try {
    report = await runDiagnostics({
      dir: realDir,
      rules: bridgedRules,
      checks: diagnosticChecks
    });
  } catch (err) {
    console.error(`Diagnostic execution failed: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  // 5. Validate Report against schema
  const validation = validateReport(report);
  if (!validation.success) {
    console.error(`Internal validation error: report failed schema validation:`);
    for (const msg of validation.errors) {
      console.error(`  - ${msg}`);
    }
    return 2;
  }

  // 6. Output handling
  const jsonOutput = JSON.stringify(report, null, 2);

  if (opts.outFile) {
    try {
      fs.writeFileSync(path.resolve(opts.outFile), jsonOutput + "\n", "utf-8");
    } catch (err) {
      console.error(`Failed to write output to file "${opts.outFile}": ${err instanceof Error ? err.message : String(err)}`);
      return 2;
    }
  }

  if (opts.json) {
    console.log(jsonOutput);
  } else {
    const formatted = formatTerminalReport(report, { noColor: opts.noColor });
    console.log(formatted);
  }

  // 7. Exit code calculation:
  // 0: no failures (no high/critical findings)
  // 1: high or critical findings present
  const hasHighOrCritical = report.findings.some(
    (f) => f.severity === "high" || f.severity === "critical"
  );

  return hasHighOrCritical ? 1 : 0;
}

export const CLI_NAME = "stackdoctor";
export const CLI_CORE = "@stackdoctor/core";

