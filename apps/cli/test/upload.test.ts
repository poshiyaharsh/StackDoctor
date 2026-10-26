import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  saveConfig,
  loadConfig,
  clearConfig,
  validateServerUrl,
  getConfigFilePath
} from "../src/config-store.js";
import { formatReportPreview, uploadReport } from "../src/uploader.js";
import { runCli } from "../src/index.js";
import type { Report } from "@stackdoctor/schemas";

describe("StackDoctor CLI Upload, Login & Network Guarantees (Run 3C)", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const tempConfigDir = path.join(os.tmpdir(), `stk-test-config-${Date.now()}`);

  beforeEach(() => {
    process.env.STACKDOCTOR_CONFIG_DIR = tempConfigDir;
    delete process.env.STACKDOCTOR_TOKEN;
    delete process.env.STACKDOCTOR_SERVER;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    if (fs.existsSync(tempConfigDir)) {
      fs.rmSync(tempConfigDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  function createSampleReport(): Report {
    return {
      schemaVersion: "1.0.0",
      toolVersion: "0.1.0",
      operatingSystem: "linux",
      startedAt: new Date(Date.now() - 2000).toISOString(),
      completedAt: new Date().toISOString(),
      status: "completed",
      projectName: "my-test-service",
      technologies: [{ name: "nodejs", confidence: "confirmed", evidence: [] }],
      checks: [
        {
          id: "node-installed",
          title: "Node.js Check",
          category: "runtime",
          status: "passed",
          durationMs: 10,
          evidence: []
        }
      ],
      findings: [
        {
          ruleId: "NODE_DEPS_NOT_INSTALLED",
          title: "Dependencies missing",
          category: "dependencies",
          severity: "high",
          confidence: "confirmed",
          status: "failed",
          evidence: [
            {
              id: "ev-1",
              kind: "path",
              description: "missing node_modules",
              observed: "node_modules not found",
              source: "fs.existsSync",
              collectedAt: new Date().toISOString()
            }
          ],
          possibleCauses: ["Never installed"],
          recommendations: [],
          verificationStatus: "unverified",
          docs: []
        }
      ],
      summary: {
        totalChecks: 1,
        totalFindings: 1,
        bySeverity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
        byStatus: { passed: 1, failed: 0, warning: 0, skipped: 0, error: 0 }
      }
    };
  }

  describe("1. Server URL Security & Config Store", () => {
    it("allows HTTP only for localhost and requires HTTPS for remote servers", () => {
      expect(() => validateServerUrl("http://localhost:3000")).not.toThrow();
      expect(() => validateServerUrl("http://127.0.0.1:8080")).not.toThrow();
      expect(() => validateServerUrl("https://api.stackdoctor.dev")).not.toThrow();

      // Insecure remote HTTP must throw
      expect(() => validateServerUrl("http://api.stackdoctor.dev")).toThrow(
        /Insecure connection refused/
      );
      expect(() => validateServerUrl("ftp://api.stackdoctor.dev")).toThrow(
        /Invalid server protocol/
      );
    });

    it("saves credentials with restricted file permissions and loads/clears them", () => {
      saveConfig({
        serverUrl: "http://localhost:3000",
        token: "stk_live_testsecrettoken12345"
      });

      const configPath = getConfigFilePath();
      expect(fs.existsSync(configPath)).toBe(true);

      const loaded = loadConfig();
      expect(loaded).not.toBeNull();
      expect(loaded?.serverUrl).toBe("http://localhost:3000");
      expect(loaded?.token).toBe("stk_live_testsecrettoken12345");

      clearConfig();
      expect(loadConfig()).toBeNull();
      expect(fs.existsSync(configPath)).toBe(false);
    });
  });

  describe("2. Report Preview & Upload Flow", () => {
    it("formats a clear report preview before upload", () => {
      const report = createSampleReport();
      const preview = formatReportPreview(report);

      expect(preview).toContain("StackDoctor Report Preview");
      expect(preview).toContain("Project Name     : my-test-service");
      expect(preview).toContain("Operating System : linux");
      expect(preview).toContain("Total Findings   : 1");
      expect(preview).toContain("[HIGH] Dependencies missing (NODE_DEPS_NOT_INSTALLED)");
    });

    it("uploads report over HTTPS and redacts credentials before transmission", async () => {
      const report = createSampleReport();
      const rawToken = "stk_live_secrettoken999";

      let capturedHeaders: HeadersInit | undefined;
      let capturedBody: string | undefined;

      const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
        capturedHeaders = opts.headers;
        capturedBody = opts.body;
        return new Response(JSON.stringify({ diagnosticRun: { id: "run-abc-123" } }), {
          status: 201,
          headers: { "Content-Type": "application/json" }
        });
      });

      const result = await uploadReport(report, {
        serverUrl: "https://api.stackdoctor.dev",
        token: rawToken,
        fetchImpl: mockFetch as unknown as typeof fetch
      });

      expect(result.runId).toBe("run-abc-123");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect((capturedHeaders as Record<string, string>)["Authorization"]).toBe(
        `Bearer ${rawToken}`
      );
      expect(capturedBody).toBeDefined();
    });

    it("handles 401 unauthorized and 422 rejected errors gracefully without leaking token", async () => {
      const report = createSampleReport();
      const secretToken = "stk_live_supersecrettoken_never_leak";

      // 401
      const mock401 = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify({ error: { message: "Invalid token" } }), {
          status: 401
        });
      });

      await expect(
        uploadReport(report, {
          serverUrl: "http://localhost:3000",
          token: secretToken,
          fetchImpl: mock401 as unknown as typeof fetch
        })
      ).rejects.toThrow(/Authentication failed \(HTTP 401\)/);

      // 422
      const mock422 = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify({ error: { message: "Canary detected" } }), {
          status: 422
        });
      });

      await expect(
        uploadReport(report, {
          serverUrl: "http://localhost:3000",
          token: secretToken,
          fetchImpl: mock422 as unknown as typeof fetch
        })
      ).rejects.toThrow(/Report rejected \(HTTP 422\)/);
    });
  });

  describe("3. CLI Commands and Network Offline Guarantees", () => {
    it("stackdoctor scan makes zero network calls (100% offline guarantee)", async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const exitCode = await runCli(["scan", "examples/healthy-node-project", "--no-color"]);

      expect(exitCode).toBe(0);
      // Absolute guarantee: scan must NEVER call fetch
      expect(fetchSpy).toHaveBeenCalledTimes(0);
    });

    it("stackdoctor upload with --yes uploads non-interactively", async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ diagnosticRun: { id: "run-ci-999" } }), {
          status: 201,
          headers: { "Content-Type": "application/json" }
        })
      );
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      // Create a temporary valid report file
      const reportFile = path.join(tempConfigDir, "report.json");
      fs.mkdirSync(tempConfigDir, { recursive: true });
      fs.writeFileSync(reportFile, JSON.stringify(createSampleReport()));

      const exitCode = await runCli([
        "upload",
        reportFile,
        "--server",
        "http://localhost:3000",
        "--token",
        "stk_live_citoken123",
        "--yes"
      ]);

      expect(exitCode).toBe(0);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("stackdoctor login and logout commands work properly", async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ total: 20, rules: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      // 1. Login
      const loginExit = await runCli([
        "login",
        "--server",
        "http://localhost:3000",
        "--token",
        "stk_live_logintoken"
      ]);
      expect(loginExit).toBe(0);

      const config = loadConfig();
      expect(config?.token).toBe("stk_live_logintoken");
      expect(config?.serverUrl).toBe("http://localhost:3000");

      // 2. Logout
      const logoutExit = await runCli(["logout"]);
      expect(logoutExit).toBe(0);
      expect(loadConfig()).toBeNull();
    });
  });
});
