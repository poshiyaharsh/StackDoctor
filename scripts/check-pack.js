#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const cliDir = path.resolve(rootDir, "apps", "cli");

console.log("======================================================");
console.log("         StackDoctor CLI Package Inspection           ");
console.log("======================================================\n");

// Ensure CLI is freshly built
execSync("node scripts/build-cli.js", { cwd: rootDir, stdio: "inherit" });

console.log("\nRunning npm pack --json in apps/cli...");
let packResult;
try {
  const packJson = execSync("npm pack --json", { cwd: cliDir, encoding: "utf-8" });
  const parsed = JSON.parse(packJson);
  packResult = Array.isArray(parsed) ? parsed[0] : parsed;
} catch (err) {
  console.error("Failed to run npm pack:", err.message);
  process.exit(1);
}

const tarballPath = path.join(cliDir, packResult.filename);

console.log("\n--- Package Metadata ---");
console.log(`Package Name       : ${packResult.name}`);
console.log(`Version            : ${packResult.version}`);
console.log(`Tarball Filename   : ${packResult.filename}`);
console.log(`Compressed Size    : ${(packResult.size / 1024).toFixed(1)} KB`);
console.log(`Unpacked Size      : ${(packResult.unpackedSize / 1024).toFixed(1)} KB`);
console.log(`Total Files        : ${packResult.entryCount}`);
console.log(`SHA-1 Checksum     : ${packResult.shasum}`);
console.log(`Integrity (sha512) : ${packResult.integrity}`);

console.log("\n--- File List ---");
for (const f of packResult.files) {
  console.log(`  - ${f.path.padEnd(35)} (${f.size} B)`);
}

// Validation Checks
let hasErrors = false;
const FORBIDDEN_PATTERNS = [
  /test/i,
  /spec/i,
  /example/i,
  /fixture/i,
  /\.env/i,
  /\.map$/i,
  /\.stackdoctor/i,
  /tsconfig/i,
  /\.log$/i
];

for (const f of packResult.files) {
  for (const pat of FORBIDDEN_PATTERNS) {
    if (pat.test(f.path)) {
      console.error(`[FAIL] Forbidden file pattern matched: ${f.path} (${pat})`);
      hasErrors = true;
    }
  }
}

// Size budget: 500 KB compressed, 2000 KB unpacked
const MAX_COMPRESSED_KB = 500;
const MAX_UNPACKED_KB = 2048;

if (packResult.size / 1024 > MAX_COMPRESSED_KB) {
  console.error(`[FAIL] Compressed size exceeds budget: ${(packResult.size / 1024).toFixed(1)} KB > ${MAX_COMPRESSED_KB} KB`);
  hasErrors = true;
}

if (packResult.unpackedSize / 1024 > MAX_UNPACKED_KB) {
  console.error(`[FAIL] Unpacked size exceeds budget: ${(packResult.unpackedSize / 1024).toFixed(1)} KB > ${MAX_UNPACKED_KB} KB`);
  hasErrors = true;
}

// Cleanup tarball
if (fs.existsSync(tarballPath)) {
  fs.unlinkSync(tarballPath);
}

console.log("\n======================================================");
if (!hasErrors) {
  console.log("Package Inspection Result: PASSED (All checks & budgets met)");
  console.log("======================================================");
  process.exit(0);
} else {
  console.error("Package Inspection Result: FAILED");
  console.log("======================================================");
  process.exit(1);
}
