import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@stackdoctor/schemas": path.resolve(__dirname, "../../packages/schemas/src/index.ts"),
      "@stackdoctor/core/issue-draft": path.resolve(__dirname, "../../packages/core/src/issue-draft.ts"),
      "@stackdoctor/core/compare": path.resolve(__dirname, "../../packages/core/src/compare.ts"),
      "@stackdoctor/core": path.resolve(__dirname, "../../packages/core/src/issue-draft.ts")
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3000",
        changeOrigin: true,
        secure: false
      }
    }
  }
});
