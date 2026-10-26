import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { scanProject, redactText } from "@stackdoctor/core";
import { runCommand } from "@stackdoctor/adapters";

describe("Phase 2 Security Test Suite (security.test.ts)", () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-sec-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe("1. Canary Secret Redaction", () => {
    it("redacts canary passwords, tokens, and authorization headers across outputs", () => {
      const canarySecret = "CANARY_SECRET_SUPER_SECRET_999";
      const sampleText = `Connecting to mongodb://admin:${canarySecret}@cluster.mongodb.net/prod with Authorization: Bearer ${canarySecret}`;

      const redacted = redactText(sampleText);
      expect(redacted).not.toContain(canarySecret);
      expect(redacted).toContain("[REDACTED]");
    });
  });

  describe("2. Path Traversal and Symlink Escape Protection", () => {
    it("scans only within target directory and never follows outside symlinks", async () => {
      const outsideDir = path.join(tempBaseDir, "outside");
      const projectDir = path.join(tempBaseDir, "project");

      fs.mkdirSync(outsideDir);
      fs.mkdirSync(projectDir);

      fs.writeFileSync(path.join(outsideDir, "secret_outside.txt"), "OUTSIDE_DATA", "utf-8");
      fs.writeFileSync(path.join(projectDir, "package.json"), '{"name": "inside-app"}', "utf-8");

      // Attempt symlink escape to outside folder if OS permissions allow
      try {
        fs.symlinkSync(outsideDir, path.join(projectDir, "escaped_link"), "junction");
      } catch {
        // If symlink creation not allowed on OS without elevation, continue
      }

      const scanResult = await scanProject(projectDir);
      expect(scanResult.projectName).toBe("inside-app");

      // Verify no outside files leaked into scan technologies or evidence
      const allEvidenceSources = scanResult.technologies
        .flatMap((t) => t.evidence)
        .map((e) => e.source);
      for (const src of allEvidenceSources) {
        expect(src).not.toContain("secret_outside.txt");
      }
    });
  });

  describe("3. Command Injection Immunity", () => {
    it("treats injection strings in arguments as literal string parameters", async () => {
      const injectionArg = "safe_value; echo INJECTED_EXECUTION; rm -rf /";
      const res = await runCommand("node", ["-e", "console.log(process.argv[1])", injectionArg]);

      expect(res.exitCode).toBe(0);
      // The argument is printed verbatim as an argument, never executed as shell syntax
      expect(res.stdout).toContain(injectionArg);
      expect(res.stdout).not.toContain("INJECTED_EXECUTION\n");
    });
  });

  describe("4. Malformed Project Files Resilience", () => {
    it("handles invalid YAML in docker-compose.yml gracefully without throwing", async () => {
      const projectDir = path.join(tempBaseDir, "malformed-yaml");
      fs.mkdirSync(projectDir);
      fs.writeFileSync(
        path.join(projectDir, "docker-compose.yml"),
        ":::INVALID_YAML_CONTENT_THAT_BREAKS_PARSERS:::\n\t\tbad_tabs",
        "utf-8"
      );

      const scanResult = await scanProject(projectDir);
      expect(scanResult.technologies.some((t) => t.name === "Docker Compose")).toBe(true);
    });

    it("handles binary junk and oversized package.json safely", async () => {
      const projectDir = path.join(tempBaseDir, "binary-junk");
      fs.mkdirSync(projectDir);

      // Write random binary buffer as package.json
      const binaryJunk = Buffer.from([0x00, 0xff, 0xfe, 0x12, 0x89, 0x00, 0xaa, 0xbb]);
      fs.writeFileSync(path.join(projectDir, "package.json"), binaryJunk);

      const scanResult = await scanProject(projectDir);
      // Should not throw, should fall back safely to folder basename
      expect(scanResult.projectName).toBe("binary-junk");
    });
  });

  describe("5. Buffer and Timeout Safety", () => {
    it("caps oversized command output to maxOutputBytes and marks truncated", async () => {
      // Generate 20,000 characters
      const script = "console.log('X'.repeat(20000))";
      const res = await runCommand("node", ["-e", script], { maxOutputBytes: 1024 });

      expect(res.truncated).toBe(true);
      expect(res.stdout.length).toBeLessThanOrEqual(1024);
    });

    it("kills processes that exceed timeoutMs and marks timedOut", async () => {
      const script = "setTimeout(() => {}, 10000)";
      const res = await runCommand("node", ["-e", script], { timeoutMs: 200 });

      expect(res.timedOut).toBe(true);
      expect(res.exitCode).not.toBe(0);
    });
  });
});
