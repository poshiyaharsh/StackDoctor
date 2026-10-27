#!/usr/bin/env node
/**
 * scripts/verify-release.js
 *
 * Runs the complete release verification chain (build, lint, typecheck, tests,
 * accuracy evals, AI safety evals, secret scan, license audit, tarball check,
 * fresh-install test, documentation links, and scorecard) in a single command.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const steps = [
  { name: "Build TypeScript Monorepo & Bundle CLI", cmd: "npm run build" },
  { name: "Code Linting (ESLint)", cmd: "npm run lint" },
  { name: "TypeScript Project Typecheck", cmd: "npm run typecheck" },
  { name: "Vitest Test Suite (Unit & Integration)", cmd: "npm test" },
  { name: "Diagnostic Accuracy Benchmark (Fixtures & Regressions)", cmd: "npm run eval" },
  { name: "AI Safety Evaluation Suite", cmd: "npm run eval:ai" },
  { name: "Automated Secret Scanner", cmd: "npm run check:secrets" },
  { name: "Dependency License Audit", cmd: "npm run check:licenses" },
  { name: "CLI Package Tarball & Budget Inspection", cmd: "npm run check:pack" },
  { name: "Fresh Install in Clean Prefix Verification", cmd: "npm run test:install" },
  { name: "Documentation Link & Snippet Test", cmd: "npm run test:docs" },
  { name: "Rule Catalog Synchronization Check", cmd: "npm run docs:rules -- --check" },
  { name: "Feedback Scorecard Integrity", cmd: "npm run scorecard" }
];

console.log("======================================================");
console.log("       StackDoctor Full Release Verification Chain     ");
console.log("======================================================\n");

let currentStep = 1;
const startTime = Date.now();

for (const step of steps) {
  process.stdout.write(`[${currentStep}/${steps.length}] Running: ${step.name}... `);
  const stepStart = Date.now();
  try {
    execSync(step.cmd, { cwd: rootDir, stdio: "pipe" });
    const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
    console.log(`PASSED (${elapsed}s)`);
  } catch (err) {
    console.log("FAILED!\n");
    console.error(`\n[ERROR] Step failed: ${step.cmd}`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }
  currentStep++;
}

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log("\n======================================================");
console.log(`   Release Verification Chain: 100% SUCCESS (${totalElapsed}s)  `);
console.log("   The repository is verified and ready for release!  ");
console.log("======================================================\n");
