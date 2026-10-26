import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import os from "node:os";
import {
  runDiagnostics,
  validateDirectory,
  scanProject,
  buildIssueDraft,
  compareReports,
  type DiagnosticRule,
  type DiagnosticCheck
} from "@stackdoctor/core";
import { createDefaultRuleRegistry } from "@stackdoctor/rules";
import { validateReport, type Report, type Severity, CURRENT_TOOL_VERSION } from "@stackdoctor/schemas";
import {
  formatTerminalReport,
  formatMarkdownReport,
  formatComparisonTerminal,
  formatComparisonMarkdown
} from "./format.js";
import { collectEvaluationContext } from "./collector.js";
import {
  saveConfig,
  clearConfig,
  loadConfig,
  validateServerUrl
} from "./config-store.js";
import { formatReportPreview, uploadReport } from "./uploader.js";
import { copyToClipboard } from "./clipboard.js";

export class InvalidUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUsageError";
  }
}

export interface CliOptions {
  command: "scan" | "rules" | "login" | "logout" | "upload" | "issue" | "compare" | "help" | "version";
  targetPath: string;
  baseReportPath?: string;
  headReportPath?: string;
  failOnNew?: Severity;
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
  minSeverity?: Severity;
  copy?: boolean;
  noEvidence?: boolean;
  ci: boolean;
  failOn: Severity;
  quiet: boolean;
  format: "text" | "json" | "markdown";
}

export function parseCliArgs(argv: string[]): CliOptions {
  let command: "scan" | "rules" | "login" | "logout" | "upload" | "issue" | "compare" | "help" | "version" = "scan";
  let targetPath = ".";
  let baseReportPath: string | undefined;
  let headReportPath: string | undefined;
  let failOnNew: Severity | undefined;
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
  let minSeverity: Severity | undefined;
  let copy = false;
  let noEvidence = false;
  let ci = false;
  let failOn: Severity = "high";
  let quiet = false;
  let format: "text" | "json" | "markdown" = "text";

  const VALID_SEVERITIES = new Set(["info", "low", "medium", "high", "critical"]);
  const VALID_FORMATS = new Set(["text", "json", "markdown"]);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      help = true;
      command = "help";
    } else if (arg === "--version" || arg === "-v") {
      version = true;
      command = "version";
    } else if (arg === "--ci") {
      ci = true;
      noColor = true;
    } else if (arg === "--quiet" || arg === "-q") {
      quiet = true;
    } else if (arg === "--json") {
      json = true;
      format = "json";
    } else if (arg === "--no-color") {
      noColor = true;
    } else if (arg === "--allow-project-code") {
      allowProjectCode = true;
    } else if (arg === "--yes" || arg === "-y") {
      yes = true;
    } else if (arg === "--copy") {
      copy = true;
    } else if (arg === "--no-evidence") {
      noEvidence = true;
    } else if (arg === "--format") {
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        const val = argv[++i] as "text" | "json" | "markdown";
        if (!VALID_FORMATS.has(val)) {
          throw new InvalidUsageError(`Invalid value "${val}" for --format flag. Must be text|json|markdown`);
        }
        format = val;
        if (format === "json") json = true;
      } else {
        throw new InvalidUsageError("Missing format string for --format flag. Must be text|json|markdown");
      }
    } else if (arg?.startsWith("--format=")) {
      const val = arg.slice(9) as "text" | "json" | "markdown";
      if (!VALID_FORMATS.has(val)) {
        throw new InvalidUsageError(`Invalid value "${val}" for --format flag. Must be text|json|markdown`);
      }
      format = val;
      if (format === "json") json = true;
    } else if (arg === "--fail-on") {
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        const val = argv[++i] as Severity;
        if (!VALID_SEVERITIES.has(val)) {
          throw new InvalidUsageError(`Invalid severity "${val}" for --fail-on flag. Must be info|low|medium|high|critical`);
        }
        failOn = val;
      } else {
        throw new InvalidUsageError("Missing severity value for --fail-on flag. Must be info|low|medium|high|critical");
      }
    } else if (arg?.startsWith("--fail-on=")) {
      const val = arg.slice(10) as Severity;
      if (!VALID_SEVERITIES.has(val)) {
        throw new InvalidUsageError(`Invalid severity "${val}" for --fail-on flag. Must be info|low|medium|high|critical`);
      }
      failOn = val;
    } else if (arg === "--fail-on-new") {
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        const val = argv[++i] as Severity;
        if (!VALID_SEVERITIES.has(val)) {
          throw new InvalidUsageError(`Invalid severity "${val}" for --fail-on-new flag. Must be info|low|medium|high|critical`);
        }
        failOnNew = val;
      } else {
        throw new InvalidUsageError("Missing severity value for --fail-on-new flag. Must be info|low|medium|high|critical");
      }
    } else if (arg?.startsWith("--fail-on-new=")) {
      const val = arg.slice(14) as Severity;
      if (!VALID_SEVERITIES.has(val)) {
        throw new InvalidUsageError(`Invalid severity "${val}" for --fail-on-new flag. Must be info|low|medium|high|critical`);
      }
      failOnNew = val;
    } else if (arg === "--min-severity") {
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        const val = argv[++i] as Severity;
        if (!VALID_SEVERITIES.has(val)) {
          throw new InvalidUsageError(`Invalid severity "${val}" for --min-severity flag. Must be info|low|medium|high|critical`);
        }
        minSeverity = val;
      } else {
        throw new InvalidUsageError("Missing value for --min-severity flag. Must be info|low|medium|high|critical");
      }
    } else if (arg?.startsWith("--min-severity=")) {
      const val = arg.slice(15) as Severity;
      if (!VALID_SEVERITIES.has(val)) {
        throw new InvalidUsageError(`Invalid severity "${val}" for --min-severity flag. Must be info|low|medium|high|critical`);
      }
      minSeverity = val;
    } else if (arg === "--server") {
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        serverUrl = argv[++i];
      } else {
        throw new InvalidUsageError("Missing URL for --server flag");
      }
    } else if (arg?.startsWith("--server=")) {
      serverUrl = arg.slice(9);
    } else if (arg === "--token") {
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        token = argv[++i];
      } else {
        throw new InvalidUsageError("Missing token string for --token flag");
      }
    } else if (arg?.startsWith("--token=")) {
      token = arg.slice(8);
    } else if (arg === "--project") {
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        projectName = argv[++i];
      } else {
        throw new InvalidUsageError("Missing project name for --project flag");
      }
    } else if (arg?.startsWith("--project=")) {
      projectName = arg.slice(10);
    } else if (arg === "--out") {
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        outFile = argv[++i];
      } else {
        throw new InvalidUsageError("Missing file path for --out flag");
      }
    } else if (arg?.startsWith("--out=")) {
      outFile = arg.slice(6);
    } else if (arg === "--db-url-env") {
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        dbUrlEnv = argv[++i];
      } else {
        throw new InvalidUsageError("Missing environment variable name for --db-url-env flag");
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
    } else if (arg === "issue") {
      command = "issue";
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        targetPath = argv[++i] as string;
      }
    } else if (arg === "compare") {
      command = "compare";
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        baseReportPath = argv[++i] as string;
      }
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        headReportPath = argv[++i] as string;
      }
    } else if (arg === "scan") {
      command = "scan";
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        targetPath = argv[++i] as string;
      }
    } else if (arg.startsWith("-")) {
      throw new InvalidUsageError(`Unknown flag "${arg}"`);
    } else {
      if (command === "compare") {
        if (!baseReportPath) {
          baseReportPath = arg as string;
        } else if (!headReportPath) {
          headReportPath = arg as string;
        }
      } else {
        targetPath = arg as string;
      }
    }
  }

  if (command === "compare" && (!baseReportPath || !headReportPath)) {
    throw new InvalidUsageError("Missing required arguments. Usage: stackdoctor compare <baseReport.json> <headReport.json> [flags]");
  }

  return {
    command,
    targetPath,
    baseReportPath,
    headReportPath,
    failOnNew,
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
    projectName,
    minSeverity,
    copy,
    noEvidence,
    ci,
    failOn,
    quiet,
    format
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
  stackdoctor issue [reportFile | path] [flags]
  stackdoctor compare <baseReport.json> <headReport.json> [flags]

COMMANDS:
  scan [path]        Scan and diagnose a project directory (default: current directory, 100% offline)
  rules              List all diagnostic rules supported by StackDoctor
  login              Authenticate with a StackDoctor server and securely store API token
  logout             Remove stored server credentials
  upload [target]    Upload a diagnostic report with interactive preview and confirmation
  issue [target]     Generate sanitized GitHub issue draft (100% offline, never sends data)
  compare <b.json> <h.json> Compare two diagnostic reports (100% offline diff, new/resolved/changed)

FLAGS:
  --ci               Run in CI mode (non-interactive, deterministic ordering, no ANSI colors)
  --fail-on <s>      Fail with exit code 1 if findings meet or exceed severity (info|low|medium|high|critical, default: high)
  --fail-on-new <s>  Fail with exit code 1 if new findings meet or exceed severity (info|low|medium|high|critical)
  --format <fmt>     Output format (text|json|markdown, default: text)
  --quiet, -q        Suppress non-essential console output
  --json             Print valid JSON report to stdout (shorthand for --format json)
  --out <file>       Write report, diff, or issue draft to a file
  --min-severity <s> Filter issue draft findings by minimum severity (info|low|medium|high|critical)
  --copy             Copy generated issue draft to clipboard
  --no-evidence      Omit observed evidence section from issue draft
  --server <url>     StackDoctor server URL (HTTPS required for remote servers; HTTP only for localhost)
  --token <token>    API token for authentication (or use STACKDOCTOR_TOKEN env var)
  --yes, -y          Skip interactive confirmation prompt on report upload
  --project <name>   Target project name for upload
  --db-url-env <VAR> Opt-in to authenticated database checks using the named environment variable
  --allow-project-code Allow running safe, read-only project inspection commands
  --no-color         Disable ANSI terminal colors
  --version, -v      Print StackDoctor version
  --help, -h         Display this help message

EXIT CODES:
  0                  Success (no findings at or above --fail-on / --fail-on-new threshold)
  1                  Findings detected at or above threshold (or auth failure)
  2                  Tool error (invalid directory path, schema validation failure, file I/O error)
  3                  Invalid usage (unknown flag, missing flag argument, invalid flag value)
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
    if (err instanceof InvalidUsageError) {
      console.error(`Usage error: ${err.message}`);
      return 3;
    }
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

  // --- COMMAND: issue (purely local, 100% offline, never makes network calls) ---
  if (opts.command === "issue") {
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
      // Target is a directory: generate report offline
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

    const draft = buildIssueDraft(report, {
      minSeverity: opts.minSeverity,
      includeEvidence: !opts.noEvidence,
      projectPath: path.resolve(opts.targetPath),
      homeDir: os.homedir(),
      username: process.env.USERNAME || process.env.USER,
      hostname: os.hostname()
    });

    const divider = "=".repeat(70);
    const subDivider = "-".repeat(70);
    const preview = [
      divider,
      "  StackDoctor - GitHub Issue Draft Preview",
      divider,
      `Title:  ${draft.title}`,
      `Labels: ${draft.labels.join(", ")}`,
      "",
      "Review before posting. Nothing was sent.",
      subDivider,
      draft.body,
      subDivider,
      "Review before posting. Nothing was sent.",
      divider
    ].join("\n");

    console.log(preview);

    if (opts.outFile) {
      try {
        fs.writeFileSync(path.resolve(opts.outFile), draft.body + "\n", "utf-8");
        console.log(`\n✓ Issue draft written to ${opts.outFile}`);
      } catch (err) {
        console.error(
          `Failed to write issue draft to file "${opts.outFile}": ${err instanceof Error ? err.message : String(err)}`
        );
        return 2;
      }
    }

    if (opts.copy) {
      const copied = copyToClipboard(draft.body);
      if (copied) {
        console.log("\n✓ Issue draft copied to clipboard!");
      } else {
        console.log("\nNotice: Clipboard tool not available. The issue draft is printed above.");
      }
    }

    return 0;
  }

  // --- COMMAND: compare ---
  if (opts.command === "compare") {
    if (!opts.baseReportPath || !opts.headReportPath) {
      console.error("Usage error: stackdoctor compare <baseReport.json> <headReport.json> [flags]");
      return 3;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

    const loadAndValidate = (filePath: string, label: string): Report | null => {
      const resolved = path.resolve(filePath);
      if (!fs.existsSync(resolved)) {
        console.error(`Error: ${label} file "${filePath}" does not exist.`);
        return null;
      }
      try {
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
          console.error(`Error: ${label} path "${filePath}" is a directory, expected a JSON report file.`);
          return null;
        }
        if (stat.size > MAX_FILE_SIZE) {
          console.error(`Error: ${label} file "${filePath}" exceeds the 10MB limit (${stat.size} bytes).`);
          return null;
        }
        const content = fs.readFileSync(resolved, "utf-8");
        const json = JSON.parse(content);
        const validation = validateReport(json);
        if (!validation.success) {
          console.error(`Error: ${label} file "${filePath}" is not a valid StackDoctor report:`);
          for (const err of validation.errors) {
            console.error(`  - ${err}`);
          }
          return null;
        }
        return validation.data;
      } catch (err) {
        console.error(`Error reading ${label} file "${filePath}": ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
    };

    const baseReport = loadAndValidate(opts.baseReportPath, "Base report");
    if (!baseReport) return 2;
    const headReport = loadAndValidate(opts.headReportPath, "Head report");
    if (!headReport) return 2;

    const comparison = compareReports(baseReport, headReport);

    let formattedOutput: string;
    if (opts.format === "json") {
      formattedOutput = JSON.stringify(comparison, null, 2);
    } else if (opts.format === "markdown") {
      formattedOutput = formatComparisonMarkdown(comparison);
    } else {
      formattedOutput = formatComparisonTerminal(comparison, { noColor: opts.noColor });
    }

    if (opts.outFile) {
      try {
        fs.writeFileSync(path.resolve(opts.outFile), formattedOutput + "\n", "utf-8");
      } catch (err) {
        console.error(`Failed to write comparison to file "${opts.outFile}": ${err instanceof Error ? err.message : String(err)}`);
        return 2;
      }
    }

    if (!opts.quiet || opts.format === "json" || opts.format === "markdown") {
      console.log(formattedOutput);
    }

    if (opts.failOnNew) {
      const SEVERITY_LEVELS: Record<Severity, number> = {
        info: 0,
        low: 1,
        medium: 2,
        high: 3,
        critical: 4
      };
      const thresholdLevel = SEVERITY_LEVELS[opts.failOnNew] ?? 0;
      const hasFailingNewFindings = comparison.newFindings.some(
        (f) => (SEVERITY_LEVELS[f.severity] ?? 0) >= thresholdLevel
      );
      return hasFailingNewFindings ? 1 : 0;
    }

    return 0;
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

  let formattedOutput: string;
  if (opts.format === "json") {
    formattedOutput = jsonOutput;
  } else if (opts.format === "markdown") {
    formattedOutput = formatMarkdownReport(report, {
      projectPath: path.resolve(opts.targetPath)
    });
  } else {
    formattedOutput = formatTerminalReport(report, { noColor: opts.noColor });
  }

  if (opts.outFile) {
    try {
      const outputToWrite = opts.format === "markdown" ? formattedOutput : jsonOutput;
      fs.writeFileSync(path.resolve(opts.outFile), outputToWrite + "\n", "utf-8");
    } catch (err) {
      console.error(
        `Failed to write output to file "${opts.outFile}": ${err instanceof Error ? err.message : String(err)}`
      );
      return 2;
    }
  }

  if (!opts.quiet || opts.format === "json" || opts.format === "markdown") {
    console.log(formattedOutput);
  }

  const SEVERITY_LEVELS: Record<Severity, number> = {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
  };

  const thresholdLevel = SEVERITY_LEVELS[opts.failOn || "high"] ?? 3;
  const hasFailingFindings = report.findings.some(
    (f) => (SEVERITY_LEVELS[f.severity] ?? 0) >= thresholdLevel
  );

  return hasFailingFindings ? 1 : 0;
}

export const CLI_NAME = "stackdoctor";
export const CLI_CORE = "@stackdoctor/core";
