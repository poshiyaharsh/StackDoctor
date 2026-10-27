#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const cliDir = path.resolve(rootDir, "apps", "cli");

console.log("======================================================");
console.log("     StackDoctor Fresh Tarball Installation Test      ");
console.log("======================================================\n");

// 1. Pack tarball
console.log("[1/5] Building and packing CLI tarball...");
execSync("node scripts/build-cli.js", { cwd: rootDir, stdio: "inherit" });
const packOutput = execSync("npm pack --json", { cwd: cliDir, encoding: "utf-8" });
const parsed = JSON.parse(packOutput);
const tarballName = Array.isArray(parsed) ? parsed[0].filename : parsed.filename;
const tarballPath = path.join(cliDir, tarballName);

// 2. Create isolated temp directory for prefix installation
const tempInstallDir = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-install-test-"));
const tempPrefixDir = path.join(tempInstallDir, "prefix");
fs.mkdirSync(tempPrefixDir, { recursive: true });

console.log(`[2/5] Installing packed tarball into isolated prefix: ${tempPrefixDir}`);
try {
  // Install into temp prefix
  execSync(`npm install --prefix "${tempPrefixDir}" "${tarballPath}"`, {
    stdio: "inherit"
  });

  // Determine path to installed binary
  let binExecutable;
  if (process.platform === "win32") {
    binExecutable = path.join(tempPrefixDir, "node_modules", ".bin", "stackdoctor.cmd");
    if (!fs.existsSync(binExecutable)) {
      binExecutable = path.join(tempPrefixDir, "stackdoctor.cmd");
    }
    if (!fs.existsSync(binExecutable)) {
      binExecutable = path.join(tempPrefixDir, "node_modules", "@harshposhiya", "stackdoctor", "dist", "bin.js");
    }
    if (!fs.existsSync(binExecutable)) {
      binExecutable = path.join(tempPrefixDir, "node_modules", "stackdoctor", "dist", "bin.js");
    }
  } else {
    binExecutable = path.join(tempPrefixDir, "node_modules", ".bin", "stackdoctor");
    if (!fs.existsSync(binExecutable)) {
      binExecutable = path.join(tempPrefixDir, "bin", "stackdoctor");
    }
  }

  console.log(`\n[3/5] Testing binary: ${binExecutable}`);

  // Test 1: --version
  console.log("\n-> Running: stackdoctor --version");
  const versionCmd = binExecutable.endsWith(".js")
    ? `node "${binExecutable}" --version`
    : `"${binExecutable}" --version`;
  const versionOut = execSync(versionCmd, { encoding: "utf-8" }).trim();
  console.log("Output:", versionOut);
  if (!versionOut.includes("0.1.0")) {
    throw new Error(`Expected version 0.1.0 in output, got: ${versionOut}`);
  }

  // Test 2: rules
  console.log("\n-> Running: stackdoctor rules");
  const rulesCmd = binExecutable.endsWith(".js")
    ? `node "${binExecutable}" rules`
    : `"${binExecutable}" rules`;
  const rulesOut = execSync(rulesCmd, { encoding: "utf-8" });
  if (!rulesOut.includes("ENV_VAR_NAMES_MISSING") || !rulesOut.includes("NODE_DEPS_NOT_INSTALLED")) {
    throw new Error("rules command did not list expected core rules");
  }
  console.log("Rules list verified.");

  // Test 3: explain <ruleId>
  console.log("\n-> Running: stackdoctor explain NODE_DEPS_NOT_INSTALLED");
  const explainCmd = binExecutable.endsWith(".js")
    ? `node "${binExecutable}" explain NODE_DEPS_NOT_INSTALLED`
    : `"${binExecutable}" explain NODE_DEPS_NOT_INSTALLED`;
  const explainOut = execSync(explainCmd, { encoding: "utf-8" });
  if (!explainOut.includes("Node.js dependencies not installed")) {
    throw new Error("explain command output does not describe rule");
  }
  console.log("Rule explanation verified.");

  // Test 4: scan --json on an example fixture
  const fixturePath = path.join(rootDir, "examples", "healthy-node-project");
  console.log(`\n-> Running: stackdoctor scan "${fixturePath}" --json`);
  const scanCmd = binExecutable.endsWith(".js")
    ? `node "${binExecutable}" scan "${fixturePath}" --json`
    : `"${binExecutable}" scan "${fixturePath}" --json`;
  const scanOut = execSync(scanCmd, { encoding: "utf-8" });
  const report = JSON.parse(scanOut);
  if (report.toolVersion !== "0.1.0" || report.status !== "completed" || report.findings.length !== 0) {
    throw new Error(`Unexpected scan report result: ${JSON.stringify(report.summary)}`);
  }
  console.log("Healthy scan report verified (status: completed, findings: 0, toolVersion: 0.1.0).");

  // Test 5: scan on broken fixture exit code
  const brokenPath = path.join(rootDir, "examples", "broken-node-project");
  console.log(`\n-> Running: stackdoctor scan "${brokenPath}" --ci --fail-on high`);
  const brokenCmd = binExecutable.endsWith(".js")
    ? `node "${binExecutable}" scan "${brokenPath}" --ci --fail-on high`
    : `"${binExecutable}" scan "${brokenPath}" --ci --fail-on high`;
  try {
    execSync(brokenCmd, { stdio: "pipe" });
    throw new Error("Expected exit code 1 for broken fixture scan in CI mode, but got 0");
  } catch (err) {
    if (err.status !== 1) {
      throw new Error(`Expected exit code 1, got ${err.status}: ${err.message}`);
    }
    console.log("CI exit code 1 on high findings verified.");
  }

  console.log("\n======================================================");
  console.log("Fresh-Install Test Result: PASSED (All operations verified)");
  console.log("======================================================");
} finally {
  // Cleanup
  if (fs.existsSync(tarballPath)) {
    fs.unlinkSync(tarballPath);
  }
  try {
    fs.rmSync(tempInstallDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup on windows locks
  }
}
