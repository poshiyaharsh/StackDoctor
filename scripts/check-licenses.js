#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("======================================================");
console.log("         StackDoctor License & Dependency Audit       ");
console.log("======================================================\n");

const PERMITTED_LICENSES = new Set([
  "MIT",
  "MIT-0",
  "Apache-2.0",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "CC0-1.0",
  "CC-BY-4.0",
  "Python-2.0",
  "Unlicense"
]);

const COPYLEFT_PATTERNS = [
  /GPL/i,
  /AGPL/i,
  /LGPL/i,
  /SSPL/i,
  /EUPL/i
];

function getPackageLicenses(dir) {
  const nm = path.join(dir, "node_modules");
  if (!fs.existsSync(nm)) return [];
  const pkgs = [];
  const seen = new Set();

  function inspectDir(d, prefix = "") {
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      if (e.name.startsWith("@")) {
        inspectDir(path.join(d, e.name), e.name + "/");
      } else {
        const pkgName = prefix + e.name;
        const pkgPath = path.join(d, e.name);
        const pj = path.join(pkgPath, "package.json");
        if (fs.existsSync(pj) && !seen.has(pkgName)) {
          seen.add(pkgName);
          try {
            const data = JSON.parse(fs.readFileSync(pj, "utf-8"));
            let lic = data.license;
            if (!lic && data.licenses) {
              lic = Array.isArray(data.licenses)
                ? data.licenses.map((l) => l.type || l).join(", ")
                : String(data.licenses);
            }
            if (typeof lic === "object" && lic !== null) {
              lic = lic.type || JSON.stringify(lic);
            }
            if (!lic && pkgName.startsWith("@stackdoctor/")) {
              lic = "MIT";
            }
            pkgs.push({
              name: pkgName,
              version: data.version || "unknown",
              license: lic || "UNKNOWN",
              author: typeof data.author === "string" ? data.author : data.author?.name || "N/A"
            });
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }

  inspectDir(nm);
  return pkgs.sort((a, b) => a.name.localeCompare(b.name));
}

const packages = getPackageLicenses(rootDir);
const licenseCounts = {};
const incompatible = [];

for (const p of packages) {
  licenseCounts[p.license] = (licenseCounts[p.license] || 0) + 1;
  const isPermitted = PERMITTED_LICENSES.has(p.license);
  const isCopyleft = COPYLEFT_PATTERNS.some((pat) => pat.test(p.license));

  if (!isPermitted || isCopyleft) {
    incompatible.push(p);
  }
}

console.log(`Audited ${packages.length} total direct and transitive dependencies.\n`);
console.log("License Breakdown:");
for (const [lic, count] of Object.entries(licenseCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  - ${lic.padEnd(20)}: ${count}`);
}

// Generate docs/licenses.md
const docPath = path.join(rootDir, "docs", "licenses.md");
let docContent = `# Dependency License & Security Audit

This document lists all third-party dependencies used in StackDoctor, their licenses, and their compatibility with StackDoctor's **MIT License**.

- **Project License**: MIT
- **Permitted Dependency Licenses**: MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, CC0-1.0, CC-BY-4.0, Python-2.0, Unlicense.
- **Copyleft Policy**: No GPL, AGPL, or strong copyleft licenses are permitted in bundled runtime code.

---

## License Summary

| License | Count | Status |
|---|---|---|
`;

for (const [lic, count] of Object.entries(licenseCounts).sort((a, b) => b[1] - a[1])) {
  const status = PERMITTED_LICENSES.has(lic) ? "Permitted (:white_check_mark:)" : "Review Required (:warning:)";
  docContent += `| ${lic} | ${count} | ${status} |\n`;
}

docContent += `\n---

## Security Audit & Vulnerability Notes

The following upstream vulnerabilities were identified during dependency audit (\`npm audit\`) and are tracked below:

1. **\`tinypool\` (<=2.1.1) / \`@vitest/mocker\` (<=4.1.11)**:
   - **Severity**: Critical / Moderate
   - **Advisories**: GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr, GHSA-82fw-gwwq-j7x9
   - **Component**: Development dependency only (\`vitest\` test runner).
   - **Runtime Exposure**: **None**. Neither Vitest nor Tinypool is bundled into the distributed \`stackdoctor\` CLI or production runtime packages.
   - **Resolution Plan**: Will migrate to Vitest v5 when workspace monorepo test harness is upgraded.

2. **\`zod\` (<4.6.6)**:
   - **Severity**: High (GHSA-mrhx-c7xc-m3w5)
   - **Description**: Memory exhaustion risk when parsing untrusted, extremely oversized collections.
   - **Component**: \`apps/api\` (schema validation).
   - **Runtime Exposure**: StackDoctor limits API request payload body sizes at the Express middleware layer (\`100kb\` JSON body parser cap) before schema parsing occurs.
   - **Resolution Plan**: Tracked for full Zod v4 schema upgrade in Phase 6 roadmap.

---

## Full Dependency Inventory

| Package | Version | License |
|---|---|---|
`;

for (const p of packages) {
  docContent += `| \`${p.name}\` | ${p.version} | ${p.license} |\n`;
}

fs.writeFileSync(docPath, docContent, "utf-8");
console.log(`\nUpdated license documentation in: docs/licenses.md`);

console.log("\n======================================================");
if (incompatible.length === 0) {
  console.log("License Audit Result: PASSED (100% MIT-compatible)");
  console.log("======================================================");
  process.exit(0);
} else {
  console.error(`License Audit Result: FAILED (${incompatible.length} incompatible package(s) detected):`);
  for (const inc of incompatible) {
    console.error(`  - ${inc.name}@${inc.version}: ${inc.license}`);
  }
  console.log("======================================================");
  process.exit(1);
}
