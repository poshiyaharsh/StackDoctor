#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultRuleRegistry } from "../packages/rules/dist/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const docsPath = path.join(rootDir, "docs", "diagnostics.md");

const isCheckMode = process.argv.includes("--check");

console.log("======================================================");
console.log("       StackDoctor Diagnostic Rules Documentation     ");
console.log("======================================================\n");

const registry = createDefaultRuleRegistry();
const rules = registry.list().sort((a, b) => a.id.localeCompare(b.id));

let md = `# StackDoctor Diagnostic Rule Catalog

This catalog is **automatically generated** from the canonical rule registry in \`packages/rules\`.
To update or verify this document, run:
\`\`\`bash
npm run docs:rules
\`\`\`

Total Built-in Rules: **${rules.length}**

---

## Rule Summary Table

| Rule ID | Category | Severity | Confidence | Technologies | Description |
|---|---|---|---|---|---|
`;

for (const r of rules) {
  const techs = r.technologies.join(", ");
  md += `| [\`${r.id}\`](#${r.id.toLowerCase().replace(/_/g, "-")}) | \`${r.category}\` | **${r.severity}** | \`${r.confidence}\` | ${techs} | ${r.description} |\n`;
}

md += `\n---

## Detailed Rule Reference

`;

for (let i = 0; i < rules.length; i++) {
  const r = rules[i];
  const anchorId = r.id.toLowerCase().replace(/_/g, "-");
  md += `<a id="${anchorId}"></a>\n### ${i + 1}. \`${r.id}\`\n\n`;
  md += `**Title**: ${r.title}\n\n`;
  md += `- **Category**: \`${r.category}\`\n`;
  md += `- **Default Severity**: \`${r.severity}\`\n`;
  md += `- **Confidence**: \`${r.confidence}\`\n`;
  md += `- **Target Technologies**: ${r.technologies.map((t) => `\`${t}\``).join(", ")}\n`;
  md += `- **Evidence Types**: ${r.requiredEvidence.map((e) => `\`${e}\``).join(", ")}\n\n`;

  md += `#### Description\n${r.description}\n\n`;

  if (r.recommendedChecks && r.recommendedChecks.length > 0) {
    md += `#### Diagnostic Checks\n`;
    for (const c of r.recommendedChecks) {
      md += `- ${c}\n`;
    }
    md += `\n`;
  }

  if (r.remediation && r.remediation.length > 0) {
    md += `#### Remediation Guidance\n`;
    for (const rem of r.remediation) {
      md += `- **Problem**: ${rem.problem}\n`;
      md += `  - **Relevance**: ${rem.relevance}\n`;
      md += `  - **Action**: \`${rem.commandOrAction}\`\n`;
      md += `  - **Expected Result**: ${rem.expectedResult}\n`;
      md += `  - **Risks**: ${rem.risks}\n`;
      if (rem.verification) {
        md += `  - **Verification**: \`${rem.verification}\`\n`;
      }
    }
    md += `\n`;
  }

  if (r.verification) {
    md += `#### Verification Principle\n${r.verification}\n\n`;
  }

  if (r.docs && r.docs.length > 0) {
    md += `#### Documentation References\n`;
    for (const d of r.docs) {
      md += `- [${d}](${d})\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
}

if (isCheckMode) {
  if (!fs.existsSync(docsPath)) {
    console.error("[FAIL] docs/diagnostics.md does not exist. Run 'npm run docs:rules' to generate.");
    process.exit(1);
  }
  const existing = fs.readFileSync(docsPath, "utf-8");
  if (existing.trim() !== md.trim()) {
    console.error("[FAIL] docs/diagnostics.md is out of date with the rule registry. Run 'npm run docs:rules'.");
    process.exit(1);
  }
  console.log("[PASS] docs/diagnostics.md is up to date with the canonical rule registry.");
} else {
  fs.writeFileSync(docsPath, md, "utf-8");
  console.log(`[SUCCESS] Generated documentation for ${rules.length} rules in docs/diagnostics.md`);
}
