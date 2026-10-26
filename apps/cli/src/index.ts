import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  runDiagnostics,
  validateDirectory,
  scanProject,
  type DiagnosticRule,
  type DiagnosticCheck
} from "@stackdoctor/core";
import {
  createDefaultRuleRegistry
} from "@stackdoctor/rules";
import { validateReport, type Report, CURRENT_TOOL_VERSION } from "@stackdoctor/schemas";
import { formatTerminalReport } from "./format.js";
import { collectEvaluationContext } from "./collector.js";

export interface CliOptions {
  command: "scan" | "rules" | "help" | "version";
  targetPath: string;
  json: boolean;
  outFile?: string;
  noColor: boolean;
  help: boolean;
  version: boolean;
  dbUrlEnv?: string;
  allowProjectCode: boolean;
}

export function parseCliArgs(argv: string[]): CliOptions {
  let command: "scan" | "rules" | "help" | "version" = "scan";
  let targetPath = ".";
  let json = false;
  let outFile: string | undefined;
  let noColor = false;
  let help = false;
  let version = false;
  let dbUrlEnv: string | undefined;
  let allowProjectCode = false;

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
    } else if (arg === "--allow-project-code") {
      allowProjectCode = true;
    } else if (arg === "--out") {
      if (i + 1 < argv.length) {
        outFile = argv[++i];
      } else {
        throw new Error("Missing file path for --out flag");
      }
    } else if (arg?.startsWith("--out=")) {
      outFile = arg.slice(6);
    } else if (arg === "--db-url-env") {
      if (i + 1 < argv.length) {
        dbUrlEnv = argv[++i];
      } else {
        throw new Error("Missing environment variable name for --db-url-env flag");
      }
    } else if (arg?.startsWith("--db-url-env=")) {
      dbUrlEnv = arg.slice(13);
    } else if (arg === "rules") {
      command = "rules";
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
    version,
    dbUrlEnv,
    allowProjectCode
  };
}

export function printHelp(): void {
  console.log(`
StackDoctor - Open-source developer environment diagnostics tool
Tagline: "Find the cause. Fix the environment. Ship the code."

USAGE:
  stackdoctor scan [path] [flags]
  stackdoctor rules [flags]
  stackdoctor [path] [flags]

COMMANDS:
  scan [path]        Scan and diagnose a project directory (default: current directory)
  rules              List all diagnostic rules supported by StackDoctor

FLAGS:
  --json             Print valid JSON report to stdout
  --out <file>       Write valid JSON report to a file
  --db-url-env <VAR> Opt-in to authenticated database checks using the named environment variable
  --allow-project-code Allow running safe, read-only project inspection commands
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

  if (opts.command === "rules") {
    const registry = createDefaultRuleRegistry();
    const rules = registry.list();
    if (opts.json) {
      console.log(
        JSON.stringify(
          rules.map((r) => ({
            id: r.id,
            title: r.title,
            severity: r.severity,
            technologies: r.technologies
          })),
          null,
          2
        )
      );
      return 0;
    }

    console.log(`\nStackDoctor Diagnostic Rules (${rules.length} total):\n`);
    for (const r of rules) {
      console.log(`• [${r.id}] (${r.severity.toUpperCase()})`);
      console.log(`  Title       : ${r.title}`);
      console.log(`  Technologies: ${r.technologies.join(", ")}`);
      console.log("");
    }
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

  // 3. Collect comprehensive evidence and build evaluation context
  let initialScan;
  try {
    initialScan = await scanProject(realDir);
  } catch (err) {
    console.error(`Project scan failed: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  const evaluationContext = await collectEvaluationContext(realDir, opts, initialScan);

  // 4. Create diagnostic checks and rule bridge
  const diagnosticChecks: DiagnosticCheck[] = [
    {
      id: "check_node_modules",
      title: "Check Node.js dependencies installed",
      category: "dependencies",
      execute: async () => {
        if (!evaluationContext.files.hasPackageJson) {
          return { status: "skipped", evidence: [] };
        }
        if (evaluationContext.files.hasNodeModules) {
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
      execute: async () => {
        if (!evaluationContext.files.hasEnvExample) {
          return { status: "skipped", evidence: [] };
        }
        if (evaluationContext.files.hasEnv) {
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
    evaluate: () => {
      if (!r.preconditions(evaluationContext)) {
        return null;
      }
      return r.evaluate(evaluationContext);
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

