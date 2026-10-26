import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "packages/*/test/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
      "apps/*/test/**/*.test.tsx"
    ]
  },
  resolve: {
    alias: {
      "@stackdoctor/config": path.resolve(__dirname, "packages/config/src/index.ts"),
      "@stackdoctor/schemas": path.resolve(__dirname, "packages/schemas/src/index.ts"),
      "@stackdoctor/rules": path.resolve(__dirname, "packages/rules/src/index.ts"),
      "@stackdoctor/adapters": path.resolve(__dirname, "packages/adapters/src/index.ts"),
      "@stackdoctor/core/issue-draft": path.resolve(__dirname, "packages/core/src/issue-draft.ts"),
      "@stackdoctor/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "stackdoctor": path.resolve(__dirname, "apps/cli/src/index.ts")
    }
  }
});
