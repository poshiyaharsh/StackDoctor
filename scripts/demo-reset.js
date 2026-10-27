#!/usr/bin/env node
/**
 * scripts/demo-reset.js
 *
 * Resets the demo fixture (examples/broken-node-project) back to its pristine
 * broken state so that screen recordings, VHS tapes, and live demos can be
 * rerun with 100% repeatability.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const demoFixtureDir = path.join(rootDir, "examples", "broken-node-project");

console.log("======================================================");
console.log("          StackDoctor Demo Environment Reset          ");
console.log("======================================================\n");

if (!fs.existsSync(demoFixtureDir)) {
  console.error(`[ERROR] Demo fixture directory not found: ${demoFixtureDir}`);
  process.exit(1);
}

// 1. Remove node_modules if present
const nodeModulesPath = path.join(demoFixtureDir, "node_modules");
if (fs.existsSync(nodeModulesPath)) {
  console.log("-> Removing node_modules...");
  fs.rmSync(nodeModulesPath, { recursive: true, force: true });
}

// 2. Remove package-lock.json if present
const lockfilePath = path.join(demoFixtureDir, "package-lock.json");
if (fs.existsSync(lockfilePath)) {
  console.log("-> Removing package-lock.json...");
  fs.rmSync(lockfilePath, { force: true });
}

// 3. Reset .env to initial incomplete state
const envPath = path.join(demoFixtureDir, ".env");
console.log("-> Resetting .env to incomplete state...");
const initialEnv = `# Incomplete local environment\nNODE_ENV=development\n`;
fs.writeFileSync(envPath, initialEnv, "utf-8");

// 4. Ensure package.json has initial engine requirement
const packageJsonPath = path.join(demoFixtureDir, "package.json");
const initialPackageJson = {
  name: "broken-node-project",
  version: "1.0.0",
  description: "Test fixture with missing dependencies and Node version mismatch",
  engines: {
    node: "^12.0.0"
  },
  scripts: {
    start: "node index.js"
  },
  dependencies: {
    express: "^4.18.2",
    dotenv: "^16.3.1"
  }
};
console.log("-> Resetting package.json...");
fs.writeFileSync(packageJsonPath, JSON.stringify(initialPackageJson, null, 2) + "\n", "utf-8");

console.log("\n[SUCCESS] Demo fixture is reset to its initial broken state.");
console.log("Ready for demo recording! Run: stackdoctor scan ./examples/broken-node-project\n");
