import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import {
  runDiagnostics,
  validateDirectory,
  scanProject,
  type DiagnosticRule,
  type DiagnosticCheck
} from "@stackdoctor/core";
import { createDefaultRuleRegistry } from "@stackdoctor/rules";
import { validateReport, type Report, CURRENT_TOOL_VERSION } from "@stackdoctor/schemas";
import { formatTerminalReport } from "./format.js";
import { collectEvaluationContext } from "./collector.js";
import {
  saveConfig,
  clearConfig,
  loadConfig,
  validateServerUrl
} from "./config-store.js";
import { formatReportPreview, uploadReport } from "./uploader.js";

export interface CliOptions {
  command: "scan" | "rules" | "login" | "logout" | "upload" | "help" | "version";
  targetPath: string;
  json: boolean;
  outFile?: string;
  noColor: boolean;
  help: boolean;
  version: boolean;
  dbUrlEnv?: string;
  allowProjectCode: boolean;
  serverUrl?: string;
  token?: string;
  yes?: boolean;
  projectName?: string;
}

export function parseCliArgs(argv: string[]): CliOptions {
  let command: "scan" | "rules" | "login" | "logout" | "upload" | "help" | "version" = "scan";
  let targetPath = ".";
  let json = false;
  let outFile: string | undefined;
  let noColor = false;
  let help = false;
  let version = false;
  let dbUrlEnv: string | undefined;
  let allowProjectCode = false;
  let serverUrl: string | undefined;
  let token: string | undefined;
  let yes = false;
  let projectName: string | undefined;

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
    } else if (arg === "--yes" || arg === "-y") {
      yes = true;
    } else if (arg === "--server") {
      if (i + 1 < argv.length) {
        serverUrl = argv[++i];
      } else {
        throw new Error("Missing URL for --server flag");
      }
    } else if (arg?.startsWith("--server=")) {
      serverUrl = arg.slice(9);
    } else if (arg === "--token") {
      if (i + 1 < argv.length) {
        token = argv[++i];
      } else {
        throw new Error("Missing token string for --token flag");
      }
    } else if (arg?.startsWith("--token=")) {
      token = arg.slice(8);
    } else if (arg === "--project") {
      if (i + 1 < argv.length) {
        projectName = argv[++i];
      } else {
        throw new Error("Missing project name for --project flag");
      }
    } else if (arg?.startsWith("--project=")) {
      projectName = arg.slice(10);
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
    } else if (arg === "login") {
      command = "login";
    } else if (arg === "logout") {
      command = "logout";
    } else if (arg === "upload") {
      command = "upload";
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        targetPath = argv[++i] as string;
      }
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
    allowProjectCode,
    serverUrl,
    token,
    yes,
    projectName
  };
}

export function printHelp(): void {
  console.log(`
StackDoctor - Open-source developer environment diagnostics tool
Tagline: "Find the cause. Fix the environment. Ship the code."

USAGE:
  stackdoctor scan [path] [flags]
  stackdoctor rules [flags]
  stackdoctor login --server <url> [flags]
  stackdoctor logout
  stackdoctor upload [reportFile | path] [flags]

COMMANDS:
  scan [path]        Scan and diagnose a project directory (default: current directory, 100% offline)
  rules              List all diagnostic rules supported by StackDoctor
  login              Authenticate with a StackDoctor server and securely store API token
  logout             Remove stored server credentials
  upload [target]    Upload a diagnostic report with interactive preview and confirmation

FLAGS:
  --server <url>     StackDoctor server URL (HTTPS required for remote servers; HTTP only for localhost)
  --token <token>    API token for authentication (or use STACKDOCTOR_TOKEN env var)
  --yes, -y          Skip interactive confirmation prompt on report upload
  --project <name>   Target project name for upload
  --json             Print valid JSON report to stdout
  --out <file>       Write valid JSON report to a file
  --db-url-env <VAR> Opt-in to authenticated database checks using the named environment variable
  --allow-project-code Allow running safe, read-only project inspection commands
  --no-color         Disable ANSI terminal colors
  --version, -v      Print StackDoctor version
  --help, -h         Display this help message

EXIT CODES:
  0                  Success (no critical/high findings or successful command)
  1                  Diagnostics found environment issues (high or critical severity) or auth failure
  2                  Tool error (invalid directory path, schema validation failure, missing argument)
`);
}

async function promptInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Builds diagnostic checks and runs rules on a project directory.
 */
async function generateDirectoryReport(
  realDir: string,
  opts: CliOptions
): Promise<Report> {
  const registry = createDefaultRuleRegistry();
  const rules = registry.list();
  const initialScan = await scanProject(realDir);
  const evaluationContext = await collectEvaluationContext(realDir, opts, initialScan);

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
                source: "fs.existsSync",
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
              description: "node_modules directory missing",
              observed: "node_modules does not exist",
              source: "fs.existsSync",
              collectedAt: new Date().toISOString()
            }
          ]
        };
      }
    }
  ];

  const bridgedRules: DiagnosticRule[] = rules.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category ?? "environment",
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

  const report = await runDiagnostics({
    dir: realDir,
    rules: bridgedRules,
    checks: diagnosticChecks
  });

  const validation = validateReport(report);
  if (!validation.success) {
    throw new Error(`Report failed validation: ${validation.errors.join("; ")}`);
  }

  return report;
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

  // --- COMMAND: rules ---
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

  // --- COMMAND: login ---
  if (opts.command === "login") {
    const serverUrl = opts.serverUrl || process.env.STACKDOCTOR_SERVER || "http://localhost:3000";

    try {
      validateServerUrl(serverUrl);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      return 2;
    }

    let token = opts.token || process.env.STACKDOCTOR_TOKEN;
    if (!token) {
      token = await promptInput("Enter StackDoctor API token: ");
    }

    if (!token) {
      console.error("Error: API token is required to log in.");
      return 2;
    }

    // Verify token with server
    try {
      const parsedUrl = new URL(serverUrl);
      const verifyRes = await fetch(`${parsedUrl.origin}/api/v1/rules`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!verifyRes.ok) {
        console.error("Error: Authentication failed. Invalid or revoked API token.");
        return 1;
      }
    } catch (err) {
      console.error(
        `Error connecting to server at ${serverUrl}: ${err instanceof Error ? err.message : String(err)}`
      );
      return 1;
    }

    saveConfig({ serverUrl, token });
    console.log(`Successfully logged in to ${serverUrl}. Credentials stored securely.`);
    return 0;
  }

  // --- COMMAND: logout ---
  if (opts.command === "logout") {
    clearConfig();
    console.log("Logged out successfully. Removed stored credentials.");
    return 0;
  }

  // --- COMMAND: upload ---
  if (opts.command === "upload") {
    const stored = loadConfig();
    const token = opts.token || process.env.STACKDOCTOR_TOKEN || stored?.token;
    const serverUrl = opts.serverUrl || process.env.STACKDOCTOR_SERVER || stored?.serverUrl;

    if (!token) {
      console.error(
        "Error: Not authenticated. Please run 'stackdoctor login' or set the STACKDOCTOR_TOKEN environment variable."
      );
      return 1;
    }

    if (!serverUrl) {
      console.error(
        "Error: Server URL not configured. Please run 'stackdoctor login --server <url>' or pass --server."
      );
      return 2;
    }

    let report: Report;
    const resolvedTarget = path.resolve(opts.targetPath);

    // If target is an existing json report file
    if (fs.existsSync(resolvedTarget) && fs.statSync(resolvedTarget).isFile()) {
      try {
        const fileContent = fs.readFileSync(resolvedTarget, "utf-8");
        const parsedJson = JSON.parse(fileContent);
        const validated = validateReport(parsedJson);
        if (!validated.success) {
          console.error(`Error: File "${opts.targetPath}" is not a valid StackDoctor report:`);
          for (const err of validated.errors) {
            console.error(`  - ${err}`);
          }
          return 2;
        }
        report = validated.data;
      } catch (err) {
        console.error(`Error reading report file: ${err instanceof Error ? err.message : String(err)}`);
        return 2;
      }
    } else {
      // Target is a directory: generate report
      let realDir: string;
      try {
        realDir = validateDirectory(opts.targetPath);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        return 2;
      }

      try {
        report = await generateDirectoryReport(realDir, opts);
      } catch (err) {
        console.error(`Diagnostic execution failed: ${err instanceof Error ? err.message : String(err)}`);
        return 2;
      }
    }

    if (opts.projectName) {
      report.projectName = opts.projectName;
    }

    // 1. Show preview
    console.log(formatReportPreview(report));

    // 2. Explicit confirmation unless --yes is specified
    if (!opts.yes) {
      const confirm = await promptInput(`\nUpload this report to ${serverUrl}? (y/N): `);
      if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
        console.log("Upload cancelled by user.");
        return 0;
      }
    }

    // 3. Upload report
    console.log(`Uploading report to ${serverUrl}...`);
    try {
      const result = await uploadReport(report, { serverUrl, token });
      console.log(`Report uploaded successfully! Run ID: ${result.runId}`);
      return 0;
    } catch (err) {
      console.error(`Upload error: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
  }

  // --- COMMAND: scan (purely local, 100% offline) ---
  let realDir: string;
  try {
    realDir = validateDirectory(opts.targetPath);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  let report: Report;
  try {
    report = await generateDirectoryReport(realDir, opts);
  } catch (err) {
    console.error(`Diagnostic execution failed: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  const jsonOutput = JSON.stringify(report, null, 2);

  if (opts.outFile) {
    try {
      fs.writeFileSync(path.resolve(opts.outFile), jsonOutput + "\n", "utf-8");
    } catch (err) {
      console.error(
        `Failed to write output to file "${opts.outFile}": ${err instanceof Error ? err.message : String(err)}`
      );
      return 2;
    }
  }

  if (opts.json) {
    console.log(jsonOutput);
  } else {
    const formatted = formatTerminalReport(report, { noColor: opts.noColor });
    console.log(formatted);
  }

  const hasHighOrCritical = report.findings.some(
    (f) => f.severity === "high" || f.severity === "critical"
  );

  return hasHighOrCritical ? 1 : 0;
}

export const CLI_NAME = "stackdoctor";
export const CLI_CORE = "@stackdoctor/core";
