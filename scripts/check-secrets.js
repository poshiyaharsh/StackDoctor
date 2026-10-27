#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("======================================================");
console.log("           StackDoctor Automated Secret Scanner        ");
console.log("======================================================\n");

const ALLOWED_TEST_PATHS = [
  "/test/",
  "\\test\\",
  "scripts/eval-ai.js",
  "scripts/check-secrets.js"
];

const SECRET_PATTERNS = [
  { name: "Private Key", regex: /-----BEGIN (?:RSA|OPENSSH|DSA|EC|PGP) PRIVATE KEY-----/ },
  { name: "AWS Access Key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub Personal Access Token", regex: /\bghp_[0-9a-zA-Z]{36}\b/ },
  { name: "GitHub Fine-Grained PAT", regex: /\bgithub_pat_[0-9a-zA-Z_]{22,}\b/ },
  { name: "Slack Token", regex: /\bxox[baprs]-[0-9a-zA-Z]{10,}\b/ },
  { name: "OpenAI API Key", regex: /\bsk-[a-zA-Z0-9]{48}\b/ },
  { name: "Anthropic API Key", regex: /\bsk-ant-[a-zA-Z0-9_-]{32,}\b/ }
];

let findingsCount = 0;

// 1. Scan working tree tracked & untracked files
console.log("[1/2] Scanning working directory files...");

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === "coverage" ||
      entry.name === ".stackdoctor"
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile()) {
      if (ALLOWED_TEST_PATHS.some((p) => relPath.includes(p))) {
        continue;
      }
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        for (const pat of SECRET_PATTERNS) {
          if (pat.regex.test(content)) {
            console.error(`[FAIL] Potential secret found in working tree file: ${relPath} (${pat.name})`);
            findingsCount++;
          }
        }
      } catch {
        // Binary or unreadable files
      }
    }
  }
}

scanDirectory(rootDir);

// 2. Scan git history for committed secrets
console.log("[2/2] Scanning git commit history...");
try {
  const gitLog = execSync("git log --all -p -n 100", { cwd: rootDir, maxBuffer: 32 * 1024 * 1024 }).toString("utf-8");
  const lines = gitLog.split(/\r?\n/);
  let currentCommit = "";
  let currentFile = "";

  for (const line of lines) {
    if (line.startsWith("commit ")) {
      currentCommit = line.split(" ")[1] ?? "";
    } else if (line.startsWith("diff --git ")) {
      const parts = line.split(" ");
      currentFile = parts[2]?.replace(/^a\//, "") ?? "";
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      if (ALLOWED_TEST_PATHS.some((p) => currentFile.includes(p))) {
        continue;
      }
      for (const pat of SECRET_PATTERNS) {
        if (pat.regex.test(line)) {
          console.error(
            `[FAIL] Potential secret in git history: commit ${currentCommit.substring(0, 7)} file ${currentFile} (${pat.name})`
          );
          findingsCount++;
        }
      }
    }
  }
} catch (err) {
  console.warn(`[WARN] Could not inspect full git log: ${err.message}`);
}

console.log("\n======================================================");
if (findingsCount === 0) {
  console.log("Secret Scan Result: PASSED (0 secrets detected)");
  console.log("======================================================");
  process.exit(0);
} else {
  console.error(`Secret Scan Result: FAILED (${findingsCount} potential secret(s) found)`);
  console.error("======================================================");
  process.exit(1);
}
