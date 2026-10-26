import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  extractVariableNamesOnly,
  compareEnvVariableNames,
  detectDeclaredPorts,
  checkRuntimeConflicts,
  inspectComposeServices
} from "@stackdoctor/adapters";

describe("Config Scanner Adapter (config-scanner.ts)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-config-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe("extractVariableNamesOnly & compareEnvVariableNames", () => {
    it("extracts variable names only and strictly discards secret values", () => {
      const envContent = `
        # Comment line
        PORT=3000
        DATABASE_URL=mongodb://admin:superSecretPassword123@localhost:27017/db
        API_KEY=AIzaSyD-XYZ9876543210
        EMPTY_VAR=
        INVALID LINE WITHOUT EQUALS
      `;
      const envPath = path.join(tempDir, ".env");
      fs.writeFileSync(envPath, envContent);

      const names = extractVariableNamesOnly(envPath);
      expect(names).toContain("PORT");
      expect(names).toContain("DATABASE_URL");
      expect(names).toContain("API_KEY");
      expect(names).toContain("EMPTY_VAR");

      // Verify no values leak in returned data
      const joined = names.join(" ");
      expect(joined).not.toContain("superSecretPassword123");
      expect(joined).not.toContain("AIzaSyD");
      expect(joined).not.toContain("3000");
    });

    it("compares .env.example against .env and detects missing keys", () => {
      fs.writeFileSync(
        path.join(tempDir, ".env.example"),
        "PORT=3000\nDATABASE_URL=\nREDIS_HOST=\nJWT_SECRET=\n"
      );
      fs.writeFileSync(
        path.join(tempDir, ".env"),
        "PORT=3000\nDATABASE_URL=postgres://localhost/db\n"
      );

      const comparison = compareEnvVariableNames(tempDir);
      expect(comparison.hasEnvExample).toBe(true);
      expect(comparison.hasEnv).toBe(true);
      expect(comparison.exampleVars).toHaveLength(4);
      expect(comparison.missingVars).toEqual(["REDIS_HOST", "JWT_SECRET"]);
    });
  });

  describe("detectDeclaredPorts", () => {
    it("statically detects valid declared ports from scripts, configs, and compose", () => {
      // package.json scripts
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          scripts: {
            dev: "vite --port 3000",
            start: "node server.js -p 8080",
            preview: "PORT=4173 preview-cmd"
          }
        })
      );

      // vite.config.ts
      fs.writeFileSync(
        path.join(tempDir, "vite.config.ts"),
        "export default { server: { port: 5173 } };\n"
      );

      // .env.example
      fs.writeFileSync(path.join(tempDir, ".env.example"), "PORT=5000\n");

      // docker-compose.yml
      fs.writeFileSync(
        path.join(tempDir, "docker-compose.yml"),
        `
version: '3'
services:
  web:
    image: nginx
    ports:
      - "8000:80"
      - 9000
`
      );

      const declared = detectDeclaredPorts(tempDir);
      const portNumbers = declared.map((d) => d.port);

      expect(portNumbers).toContain(3000);
      expect(portNumbers).toContain(8080);
      expect(portNumbers).toContain(4173);
      expect(portNumbers).toContain(5173);
      expect(portNumbers).toContain(5000);
      expect(portNumbers).toContain(8000);
      expect(portNumbers).toContain(9000);
      expect(declared.every((d) => d.valid)).toBe(true);
    });

    it("flags non-numeric or out-of-range port declarations as valid: false", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          scripts: {
            dev: "vite --port invalidPortName",
            start: "node server.js -p 999999"
          }
        })
      );

      const declared = detectDeclaredPorts(tempDir);
      expect(declared.length).toBeGreaterThan(0);
      const invalid = declared.filter((d) => !d.valid);
      expect(invalid.length).toBe(2);
      expect(invalid[0]?.error).toBeDefined();
    });
  });

  describe("checkRuntimeConflicts", () => {
    it("flags conflicting Node version declarations between .nvmrc and engines.node", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ engines: { node: ">=20.0.0" } })
      );
      fs.writeFileSync(path.join(tempDir, ".nvmrc"), "18.19.0\n");

      const check = checkRuntimeConflicts(tempDir);
      expect(check.hasConflict).toBe(true);
      expect(check.reason).toContain("does not satisfy engines.node");
    });

    it("passes when .nvmrc satisfies engines.node", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ engines: { node: ">=18.0.0" } })
      );
      fs.writeFileSync(path.join(tempDir, ".nvmrc"), "20.10.0\n");

      const check = checkRuntimeConflicts(tempDir);
      expect(check.hasConflict).toBe(false);
    });
  });

  describe("inspectComposeServices", () => {
    it("safely parses Compose YAML and detects undefined service references", () => {
      fs.writeFileSync(
        path.join(tempDir, "docker-compose.yml"),
        `
version: '3.8'
services:
  database:
    image: postgres:15
  cache:
    image: redis:7
`
      );

      fs.writeFileSync(
        path.join(tempDir, ".env.example"),
        `
DATABASE_URL=postgres://database:5432/app
CACHE_URL=redis://cache:6379
AUTH_SERVICE_URL=http://auth-service:4000/api
LOCAL_SERVICE=http://localhost:3000
`
      );

      const inspection = inspectComposeServices(tempDir);
      expect(inspection.hasCompose).toBe(true);
      expect(inspection.services).toContain("database");
      expect(inspection.services).toContain("cache");

      // auth-service is referenced but not in compose services
      expect(inspection.missingReferencedServices.some((s) => s.serviceName === "auth-service")).toBe(true);
      // database and cache are defined so should not be missing
      expect(inspection.missingReferencedServices.some((s) => s.serviceName === "database")).toBe(false);
      // localhost should not be treated as a missing compose service
      expect(inspection.missingReferencedServices.some((s) => s.serviceName === "localhost")).toBe(false);
    });
  });
});
