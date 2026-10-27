#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function printUsage() {
  console.log(`
Usage:
  npm run new-rule -- --id <RULE_ID> [--tech <tech>]

Options:
  --id <RULE_ID>   Rule identifier in UPPER_SNAKE_CASE (e.g. NODE_MEMORY_LIMIT) [Required]
  --tech <tech>    Target technology (node, python, django, docker, mongodb, mysql, generic) [Default: node]
  -h, --help       Show this help message

Examples:
  npm run new-rule -- --id NODE_HEAP_OUT_OF_MEMORY --tech node
  npm run new-rule -- --id DJANGO_SECRET_KEY_MISSING --tech django
`);
}

function parseArgs(args) {
  let id = null;
  let tech = "node";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--id") {
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        id = args[++i];
      }
    } else if (arg.startsWith("--id=")) {
      id = arg.slice(5);
    } else if (arg === "--tech") {
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        tech = args[++i];
      }
    } else if (arg.startsWith("--tech=")) {
      tech = arg.slice(7);
    } else if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }
  }

  return { id, tech };
}

function toCamelCase(str) {
  const parts = str.toLowerCase().split("_");
  return (
    parts[0] +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("") +
    "Rule"
  );
}

function toHumanTitle(str) {
  const words = str.toLowerCase().split("_");
  return words.map((w, idx) => (idx === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

const TECH_MAP = {
  node: {
    label: "Node.js",
    category: "dependencies",
    doc: "https://nodejs.org/api/"
  },
  python: {
    label: "Python",
    category: "runtime",
    doc: "https://docs.python.org/3/"
  },
  django: {
    label: "Django",
    category: "configuration",
    doc: "https://docs.djangoproject.com/en/stable/"
  },
  docker: {
    label: "Docker",
    category: "docker",
    doc: "https://docs.docker.com/"
  },
  mongodb: {
    label: "MongoDB",
    category: "database",
    doc: "https://www.mongodb.com/docs/"
  },
  mysql: {
    label: "MySQL",
    category: "database",
    doc: "https://dev.mysql.com/doc/"
  },
  generic: {
    label: "*",
    category: "environment",
    doc: "https://12factor.net/"
  }
};

async function main() {
  const { id, tech } = parseArgs(process.argv.slice(2));

  if (!id) {
    console.error("Error: Missing required argument --id <RULE_ID>");
    printUsage();
    process.exit(1);
  }

  const idPattern = /^[A-Z][A-Z0-9_]*$/;
  if (!idPattern.test(id)) {
    console.error(`Error: Rule ID "${id}" must be in UPPER_SNAKE_CASE (e.g. MY_RULE_ID)`);
    process.exit(1);
  }

  const kebabId = id.toLowerCase().replace(/_/g, "-");
  const camelName = toCamelCase(id);
  const title = toHumanTitle(id);
  const techConfig = TECH_MAP[tech.toLowerCase()] || {
    label: tech.charAt(0).toUpperCase() + tech.slice(1),
    category: "environment",
    doc: "https://nodejs.org/api/"
  };

  const ruleFilePath = path.join(rootDir, "packages", "rules", "src", "rules", `${kebabId}.ts`);
  const testFilePath = path.join(rootDir, "packages", "rules", "test", `${kebabId}.test.ts`);
  const docsFilePath = path.join(rootDir, "docs", "diagnostics.md");

  if (fs.existsSync(ruleFilePath)) {
    console.error(`Error: Rule file already exists: ${ruleFilePath}`);
    process.exit(1);
  }

  if (fs.existsSync(testFilePath)) {
    console.error(`Error: Test file already exists: ${testFilePath}`);
    process.exit(1);
  }

  // 1. Create Rule File
  const ruleTemplate = `import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const ${camelName}: Rule = {
  id: "${id}",
  title: "${title}",
  category: "${techConfig.category}",
  description: "Diagnostic rule for ${title}.",
  technologies: ["${techConfig.label}"],
  severity: "medium",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Verify project configuration and environment requirements"
  ],
  remediation: [
    {
      problem: "Detected misconfiguration or missing dependency.",
      relevance: "Impacts application stability or startup.",
      commandOrAction: "echo 'Apply remediation for ${id}'",
      expectedResult: "Target issue is resolved.",
      risks: "Low risk command.",
      undo: "echo 'Revert remediation'",
      verification: "echo 'Verification step for ${id}'"
    }
  ],
  verification: "Verify that the issue is resolved and environment tests pass.",
  docs: ["${techConfig.doc}"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return Boolean(ctx.dir);
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    // Triggers when trigger evidence is present or package.json is missing
    const shouldTrigger =
      ctx.evidence.some((e) => e.id === "trigger-${kebabId}") ||
      ctx.files.hasPackageJson === false;

    if (!shouldTrigger) {
      return null;
    }

    return {
      ruleId: "${id}",
      title: "${title}",
      category: "${techConfig.category}",
      severity: "medium",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-${kebabId}",
          kind: "file_presence",
          description: "Observed environment state for ${id}",
          observed: "Target condition was observed during environment inspection.",
          source: "filesystem",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "The environment was not properly initialized or dependencies are missing.",
        "Configuration variables are misconfigured."
      ],
      recommendations: [
        {
          problem: "Detected misconfiguration or missing dependency.",
          relevance: "Impacts application stability or startup.",
          commandOrAction: "echo 'Apply remediation for ${id}'",
          expectedResult: "Target issue is resolved.",
          risks: "Low risk command.",
          undo: "echo 'Revert remediation'",
          verification: "echo 'Verification step for ${id}'"
        }
      ],
      verificationStatus: "unverified",
      docs: ["${techConfig.doc}"]
    };
  }
};
`;

  fs.writeFileSync(ruleFilePath, ruleTemplate, "utf-8");

  // 2. Create Test File
  const testTemplate = `import { describe, it, expect } from "vitest";
import { ${camelName} } from "../src/rules/${kebabId}.js";
import { FindingSchema } from "@stackdoctor/schemas";
import type { RuleEvaluationContext } from "../src/types.js";

describe("${id} Rule", () => {
  const triggerContext: RuleEvaluationContext = {
    dir: "/test/app",
    files: {
      hasPackageJson: false,
      hasNodeModules: false,
      hasLockfile: false,
      hasEnvExample: false,
      hasEnv: false
    },
    technologies: [{ name: "${techConfig.label}", confidence: "confirmed", evidence: [] }],
    evidence: []
  };

  const passContext: RuleEvaluationContext = {
    dir: "/test/app",
    files: {
      hasPackageJson: true,
      hasNodeModules: true,
      hasLockfile: true,
      hasEnvExample: false,
      hasEnv: true
    },
    technologies: [{ name: "${techConfig.label}", confidence: "confirmed", evidence: [] }],
    evidence: []
  };

  it("triggers finding when condition is met", () => {
    expect(${camelName}.preconditions(triggerContext)).toBe(true);
    const finding = ${camelName}.evaluate(triggerContext);
    expect(finding).not.toBeNull();
    expect(finding?.ruleId).toBe("${id}");
    expect(finding?.severity).toBe("medium");
    expect(finding?.confidence).toBe("confirmed");

    const parseResult = FindingSchema.safeParse(finding);
    expect(parseResult.success).toBe(true);
  });

  it("does NOT trigger finding when safe condition is met", () => {
    const finding = ${camelName}.evaluate(passContext);
    expect(finding).toBeNull();
  });

  it("strictly separates observed evidence from possible causes (wording test)", () => {
    const finding = ${camelName}.evaluate(triggerContext);
    expect(finding).not.toBeNull();

    // Evidence must NOT contain subjective or hypothesis words
    const hypothesisWords = ["probably", "might", "seems", "maybe", "could be", "likely", "possibly"];
    for (const ev of finding!.evidence) {
      for (const word of hypothesisWords) {
        expect(ev.observed.toLowerCase()).not.toContain(word);
        expect(ev.description.toLowerCase()).not.toContain(word);
      }
    }

    // Possible causes must contain hypotheses
    expect(finding!.possibleCauses.length).toBeGreaterThan(0);
  });
});
`;

  fs.writeFileSync(testFilePath, testTemplate, "utf-8");

  // 3. Append to docs/diagnostics.md
  if (fs.existsSync(docsFilePath)) {
    const docStub = `
---

### \`${id}\`

- **Title**: ${title}
- **Category**: \`${techConfig.category}\`
- **Severity**: \`medium\`
- **Confidence**: \`confirmed\`
- **Technologies**: \`${techConfig.label}\`
- **Description**: Diagnostic rule for ${title}.
- **Preconditions**: Target files or environment variables present.
- **Observed Evidence (Facts)**:
  - Fact: Target condition was observed during environment inspection.
- **Possible Causes (Hypotheses)**:
  - The environment was not properly initialized or dependencies are missing.
- **Remediation**:
  - Command: \`echo 'Apply remediation for ${id}'\`
  - Risks: Low risk command.
  - Undo: \`echo 'Revert remediation'\`
- **Verification**: Verify that the issue is resolved and environment tests pass.
- **References**: [Documentation](${techConfig.doc})
`;
    fs.appendFileSync(docsFilePath, docStub, "utf-8");
  }

  console.log(`
✓ Successfully created new diagnostic rule: ${id}
  • Rule file : packages/rules/src/rules/${kebabId}.ts
  • Test file : packages/rules/test/${kebabId}.test.ts
  • Docs stub : docs/diagnostics.md

Next steps:
  1. Customize evaluate() logic in packages/rules/src/rules/${kebabId}.ts
  2. Register your rule in packages/rules/src/index.ts
  3. Run your rule test: npx vitest run packages/rules/test/${kebabId}.test.ts
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
