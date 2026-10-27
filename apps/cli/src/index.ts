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
import { handleAiExplain, handleAiSetup, handleAiStatus } from "./ai-explain.js";
import { handleFix } from "./fix.js";
import type { AiProvider } from "@stackdoctor/ai";

export class InvalidUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUsageError";
  }
}

export interface CliOptions {
  command: "scan" | "rules" | "login" | "logout" | "upload" | "issue" | "compare" | "explain" | "ai-explain" | "ai-setup" | "ai-status" | "fix" | "help" | "version";
  targetPath: string;
  fixTarget?: string;
  apply?: boolean;
  askConfirmation?: (promptText: string) => Promise<string>;
  baseReportPath?: string;
  headReportPath?: string;
  failOnNew?: Severity;
  ruleId?: string;
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
  aiProvider?: "anthropic" | "openai" | "openai-compatible" | "mock";
  aiModel?: string;
  aiBaseUrl?: string;
  aiKeyEnv?: string;
  showPayload?: boolean;
  customMockProvider?: AiProvider;
}

export function parseCliArgs(argv: string[]): CliOptions {
  let command: "scan" | "rules" | "login" | "logout" | "upload" | "issue" | "compare" | "explain" | "ai-explain" | "ai-setup" | "ai-status" | "fix" | "help" | "version" = "scan";
  let targetPath = ".";
  let fixTarget: string | undefined;
  let apply = false;
  let baseReportPath: string | undefined;
  let headReportPath: string | undefined;
  let failOnNew: Severity | undefined;
  let ruleId: string | undefined;
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
  let aiProvider: "anthropic" | "openai" | "openai-compatible" | "mock" | undefined;
  let aiModel: string | undefined;
  let aiBaseUrl: string | undefined;
  let aiKeyEnv: string | undefined;
  let showPayload = false;

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
    } else if (arg === "--provider") {
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        aiProvider = argv[++i] as "anthropic" | "openai" | "openai-compatible" | "mock";
      } else {
        throw new InvalidUsageError("Missing provider name for --provider flag");
      }
    } else if (arg?.startsWith("--provider=")) {
      aiProvider = arg.slice(11) as "anthropic" | "openai" | "openai-compatible" | "mock";
    } else if (arg === "--model") {
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        aiModel = argv[++i];
      } else {
        throw new InvalidUsageError("Missing model name for --model flag");
      }
    } else if (arg?.startsWith("--model=")) {
      aiModel = arg.slice(8);
    } else if (arg === "--base-url") {
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        aiBaseUrl = argv[++i];
      } else {
        throw new InvalidUsageError("Missing URL for --base-url flag");
      }
    } else if (arg?.startsWith("--base-url=")) {
      aiBaseUrl = arg.slice(11);
    } else if (arg === "--key-env") {
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        aiKeyEnv = argv[++i];
      } else {
        throw new InvalidUsageError("Missing environment variable name for --key-env flag");
      }
    } else if (arg?.startsWith("--key-env=")) {
      aiKeyEnv = arg.slice(10);
    } else if (arg === "--show-payload") {
      showPayload = true;
    } else if (arg === "ai") {
      if (i + 1 < argv.length && argv[i + 1] === "setup") {
        command = "ai-setup";
        i++;
      } else if (i + 1 < argv.length && argv[i + 1] === "status") {
        command = "ai-status";
        i++;
      } else {
        throw new InvalidUsageError("Unknown ai subcommand. Usage: 'stackdoctor ai setup' or 'stackdoctor ai status'");
      }
    } else if (arg === "ai-setup") {
      command = "ai-setup";
    } else if (arg === "ai-status") {
      command = "ai-status";
    } else if (arg === "ai-explain") {
      command = "ai-explain";
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        targetPath = argv[++i] as string;
      }
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
    } else if (arg === "explain") {
      command = "explain";
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        ruleId = argv[++i] as string;
      }
    } else if (arg === "--apply") {
      apply = true;
    } else if (arg === "fix") {
      command = "fix";
      if (i + 1 < argv.length && !argv[i + 1]?.startsWith("-")) {
        fixTarget = argv[++i] as string;
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
      } else if (command === "explain") {
        if (!ruleId) {
          ruleId = arg as string;
        }
      } else if (command === "fix") {
        if (!fixTarget) {
          fixTarget = arg as string;
        } else {
          targetPath = arg as string;
        }
      } else {
        targetPath = arg as string;
      }
    }
  }

  if (command === "compare" && (!baseReportPath || !headReportPath)) {
    throw new InvalidUsageError("Missing required arguments. Usage: stackdoctor compare <baseReport.json> <headReport.json> [flags]");
  }

  if (command === "explain" && !ruleId) {
    throw new InvalidUsageError("Missing rule ID. Usage: stackdoctor explain <ruleId>");
  }

  return {
    command,
    targetPath,
    fixTarget,
    apply,
    baseReportPath,
    headReportPath,
    failOnNew,
    ruleId,
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
    format,
    aiProvider,
    aiModel,
    aiBaseUrl,
    aiKeyEnv,
    showPayload
  };
}

export function printHelp(): void {
  console.log(`
StackDoctor - Open-source developer environment diagnostics tool
Tagline: "Find the cause. Fix the environment. Ship the code."

USAGE:
  stackdoctor scan [path] [flags]
  stackdoctor rules [flags]
  stackdoctor explain <ruleId> [flags]
  stackdoctor ai setup [flags]
  stackdoctor ai status
  stackdoctor ai-explain [reportFile | path] [flags]
  stackdoctor login --server <url> [flags]
  stackdoctor logout
  stackdoctor upload [reportFile | path] [flags]
  stackdoctor issue [reportFile | path] [flags]
  stackdoctor compare <baseReport.json> <headReport.json> [flags]
  stackdoctor fix <ruleId | operationId> [path] [--apply]

COMMANDS:
  scan [path]        Scan and diagnose a project directory (default: current directory, 100% offline)
  rules              List all diagnostic rules supported by StackDoctor
  explain <ruleId>   Explain rule details, evidence requirements, remediation, and docs
  ai setup           Interactively configure optional AI provider and privacy settings
  ai status          Display current AI configuration and environment key availability
  ai-explain [path]  Generate evidence-grounded AI explanation with consent preview
  fix <id> [path]    Approve and run safe, allowlisted remediation (DRY RUN by default)
  login              Authenticate with a StackDoctor server and securely store API token
  logout             Remove stored server credentials
  upload [target]    Upload a diagnostic report with interactive preview and confirmation
  issue [target]     Generate sanitized GitHub issue draft (100% offline, never sends data)
  compare <b.json> <h.json> Compare two diagnostic reports (100% offline diff, new/resolved/changed)

FLAGS:
  --apply            Execute approved remediation (requires interactive confirmation; refused in --ci)
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
  --provider <p>     AI provider (anthropic|openai|openai-compatible|mock)
  --model <m>        AI model name
  --base-url <url>   Base endpoint URL for OpenAI-compatible or local Ollama servers
  --key-env <NAME>   Environment variable name providing API key (never stores key on disk)
  --show-payload     Display full sanitized payload JSON in consent preview
  --server <url>     StackDoctor server URL (HTTPS required for remote servers; HTTP only for localhost)
  --token <token>    API token for authentication (or use STACKDOCTOR_TOKEN env var)
  --yes, -y          Skip interactive confirmation prompt on report upload and AI explain
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
export async function runCli(
  argv: string[] = process.argv.slice(2),
  overrides?: Partial<CliOptions>
): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCliArgs(argv);
    if (overrides) {
      opts = { ...opts, ...overrides };
    }
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

  // --- COMMAND: explain ---
  if (opts.command === "explain") {
    if (!opts.ruleId) {
      console.error("Usage error: Missing ruleId. Usage: stackdoctor explain <ruleId>");
      return 3;
    }

    const registry = createDefaultRuleRegistry();
    const allRules = registry.list();
    const rule = allRules.find(
      (r) => r.id.toLowerCase() === opts.ruleId!.toLowerCase()
    );

    if (!rule) {
      console.error(`Error: Unknown diagnostic rule ID "${opts.ruleId}".`);
      const suggestions = findSimilarRuleIds(
        opts.ruleId,
        allRules.map((r) => r.id)
      );
      if (suggestions.length > 0) {
        console.error("\nDid you mean one of these?");
        for (const s of suggestions) {
          console.error(`  • ${s}`);
        }
      }
      console.error("\nRun `stackdoctor rules` to list all supported diagnostic rules.");
      return 2;
    }

    if (opts.json || opts.format === "json") {
      const output = JSON.stringify(
        {
          id: rule.id,
          title: rule.title,
          category: rule.category ?? "general",
          description: rule.description,
          technologies: rule.technologies,
          severity: rule.severity,
          confidence: rule.confidence,
          requiredEvidence: rule.requiredEvidence,
          recommendedChecks: rule.recommendedChecks,
          remediation: rule.remediation,
          verification: rule.verification,
          docs: rule.docs
        },
        null,
        2
      );
      console.log(output);
      if (opts.outFile) {
        fs.writeFileSync(path.resolve(opts.outFile), output + "\n", "utf-8");
      }
      return 0;
    }

    const lines: string[] = [];
    lines.push(`=== StackDoctor Diagnostic Rule: ${rule.id} ===`);
    lines.push(`Title        : ${rule.title}`);
    lines.push(`Category     : ${rule.category ?? "general"}`);
    lines.push(`Severity     : ${rule.severity.toUpperCase()}`);
    lines.push(`Confidence   : ${rule.confidence}`);
    lines.push(`Technologies : ${rule.technologies.join(", ")}`);
    lines.push("");

    lines.push("--- Description ---");
    lines.push(rule.description);
    lines.push("");

    lines.push("--- Evidence Required (Observed Facts) ---");
    if (rule.requiredEvidence.length === 0) {
      lines.push("  None specified.");
    } else {
      for (const ev of rule.requiredEvidence) {
        lines.push(`  • ${ev}`);
      }
    }
    lines.push("");

    lines.push("--- Recommended Checks ---");
    if (rule.recommendedChecks.length === 0) {
      lines.push("  None specified.");
    } else {
      for (const chk of rule.recommendedChecks) {
        lines.push(`  • ${chk}`);
      }
    }
    lines.push("");

    lines.push("--- Remediation Actions ---");
    if (rule.remediation.length === 0) {
      lines.push("  No remediation steps defined.");
    } else {
      rule.remediation.forEach((rec, idx) => {
        lines.push(`[Action ${idx + 1}] ${rec.commandOrAction}`);
        lines.push(`  Problem      : ${rec.problem}`);
        lines.push(`  Relevance    : ${rec.relevance}`);
        lines.push(`  Risks        : ${rec.risks}`);
        lines.push(`  Verification : ${rec.verification}`);
        if (rec.undo) {
          lines.push(`  Undo         : ${rec.undo}`);
        }
        lines.push("");
      });
    }

    lines.push("--- Verification ---");
    lines.push(rule.verification);
    lines.push("");

    lines.push("--- Documentation References ---");
    if (rule.docs.length === 0) {
      lines.push("  No documentation links.");
    } else {
      for (const doc of rule.docs) {
        lines.push(`  • ${doc}`);
      }
    }

    const output = lines.join("\n");
    console.log(output);

    if (opts.outFile) {
      fs.writeFileSync(path.resolve(opts.outFile), output + "\n", "utf-8");
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

  // --- COMMAND: ai-setup ---
  if (opts.command === "ai-setup") {
    return handleAiSetup({
      provider: opts.aiProvider,
      model: opts.aiModel,
      baseUrl: opts.aiBaseUrl,
      keyEnv: opts.aiKeyEnv,
      yes: opts.yes
    });
  }

  // --- COMMAND: ai-status ---
  if (opts.command === "ai-status") {
    return handleAiStatus();
  }

  // --- COMMAND: ai-explain ---
  if (opts.command === "ai-explain") {
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

    return handleAiExplain({
      report,
      provider: opts.aiProvider,
      model: opts.aiModel,
      baseUrl: opts.aiBaseUrl,
      keyEnv: opts.aiKeyEnv,
      yes: opts.yes,
      showPayload: opts.showPayload,
      json: opts.json || opts.format === "json",
      customMockProvider: opts.customMockProvider
    });
  }

  // --- COMMAND: fix (Safe, allowlisted remediation) ---
  if (opts.command === "fix") {
    return handleFix(opts.fixTarget || opts.ruleId, opts.targetPath, {
      apply: opts.apply,
      ci: opts.ci,
      yes: opts.yes,
      askConfirmation: opts.askConfirmation
    });
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

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

export function findSimilarRuleIds(
  target: string,
  candidates: string[],
  maxSuggestions = 3
): string[] {
  const targetLower = target.toLowerCase();
  const targetTokens = targetLower.split(/[_-]/).filter(Boolean);

  const scored = candidates.map((cand) => {
    const candLower = cand.toLowerCase();
    const candTokens = candLower.split(/[_-]/).filter(Boolean);

    const commonTokens = targetTokens.filter((t) => candTokens.includes(t)).length;
    const isSubstring = candLower.includes(targetLower) || targetLower.includes(candLower);
    const dist = levenshteinDistance(targetLower, candLower);

    let score = dist - commonTokens * 5;
    if (isSubstring) {
      score -= 5;
    }

    return { candidate: cand, score, commonTokens, dist };
  });

  scored.sort((a, b) => a.score - b.score || a.dist - b.dist);

  const filtered = scored.filter(
    (s) => s.commonTokens > 0 || s.dist <= Math.max(5, Math.floor(target.length * 0.5))
  );

  return filtered.slice(0, maxSuggestions).map((s) => s.candidate);
}

export const CLI_NAME = "stackdoctor";
export const CLI_CORE = "@stackdoctor/core";

