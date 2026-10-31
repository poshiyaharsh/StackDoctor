/**
 * scripts/new-regression.js
 *
 * Scaffolds a new synthetic regression fixture and test stub:
 *   npm run new-regression -- --id FB-012 --slug short-name
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export function scaffoldRegressionFixture(options) {
  const { id, slug, root = rootDir } = options;

  if (!id || !/^FB-\d+/i.test(id)) {
    throw new Error(`Invalid or missing --id argument. Expected format: FB-001 (got: "${id}")`);
  }

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`Invalid or missing --slug argument. Expected kebab-case format: my-regression-slug (got: "${slug}")`);
  }

  const normalizedId = id.toUpperCase();
  const folderName = `${normalizedId}-${slug}`;
  const fixtureDir = path.join(root, "examples", "regressions", folderName);
  const testDir = path.join(root, "packages", "rules", "test", "regressions");
  const testFile = path.join(testDir, `${folderName}.test.ts`);

  // 1. Create fixture directory
  fs.mkdirSync(fixtureDir, { recursive: true });

  // 2. Create fixture README.md
  const readmeContent = `# Regression Fixture: ${normalizedId} (${slug})

This synthetic fixture reproduces feedback item \`${normalizedId}\`.
- **Purpose**: Regression test to prevent recurrences of the reported behavior.
- **Reference**: See \`FEEDBACK.md\` entry \`${normalizedId}\`.
- **Privacy Notice**: This directory contains synthetic dummy files only. No user code or secrets.
`;
  fs.writeFileSync(path.join(fixtureDir, "README.md"), readmeContent, "utf-8");

  // 3. Create expected.json stub
  const expectedContent = `[\n  // Add expected Finding rule IDs here, or leave empty [] if this tests a false positive\n]\n`;
  fs.writeFileSync(path.join(fixtureDir, "expected.json"), expectedContent, "utf-8");

  // 4. Create synthetic package.json or dummy file
  const packageJsonContent = JSON.stringify(
    {
      name: `regression-${slug}`,
      version: "1.0.0",
      description: `Synthetic reproduction for ${normalizedId}`,
      private: true
    },
    null,
    2
  ) + "\n";
  fs.writeFileSync(path.join(fixtureDir, "package.json"), packageJsonContent, "utf-8");

  // 5. Create test file in packages/rules/test/regressions
  fs.mkdirSync(testDir, { recursive: true });
  const testContent = `import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureDir = path.resolve(__dirname, "../../../../examples/regressions/${folderName}");

describe("Regression ${normalizedId}: ${slug}", () => {
  it("fixture directory exists and contains expected metadata", () => {
    expect(fs.existsSync(fixtureDir)).toBe(true);
    const expectedPath = path.join(fixtureDir, "expected.json");
    expect(fs.existsSync(expectedPath)).toBe(true);
  });
});
`;
  fs.writeFileSync(testFile, testContent, "utf-8");

  return {
    folderName,
    fixtureDir,
    testFile
  };
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  let id = "";
  let slug = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--id" && args[i + 1]) {
      id = args[i + 1];
      i++;
    } else if (args[i] === "--slug" && args[i + 1]) {
      slug = args[i + 1];
      i++;
    }
  }

  return { id, slug };
}

function main() {
  console.log("======================================================");
  console.log("       StackDoctor Regression Scaffolder              ");
  console.log("======================================================\n");

  const { id, slug } = parseCliArgs();

  if (!id || !slug) {
    console.error("Usage: npm run new-regression -- --id <FB-ID> --slug <slug>");
    console.error("Example: npm run new-regression -- --id FB-002 --slug runtime-conflict\n");
    process.exit(1);
  }

  try {
    const result = scaffoldRegressionFixture({ id, slug });
    console.log(`[SUCCESS] Scaffolded regression fixture: ${result.folderName}`);
    console.log(`  - Fixture directory: ${path.relative(rootDir, result.fixtureDir)}`);
    console.log(`  - Unit test stub   : ${path.relative(rootDir, result.testFile)}`);
    console.log("\nNext Steps (per docs/fix-workflow.md):");
    console.log("  1. Add minimal synthetic dummy files to reproduce the issue in the fixture folder.");
    console.log("  2. Update expected.json with expected rule IDs (or leave [] for false positive).");
    console.log("  3. Write failing test assertion in the test stub.");
    console.log("  4. Implement the fix in packages/rules or packages/adapters.");
    console.log("  5. Run: npm test && npm run eval");
    console.log("  6. Update FEEDBACK.md and CHANGELOG.md.\n");
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
