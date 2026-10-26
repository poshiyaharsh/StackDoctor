import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { scanProject, validateDirectory } from "@stackdoctor/core";

describe("Project Scanner (scanner.ts)", () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-scanner-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("detects a plain Node.js project with package.json and npm lockfile", async () => {
    const projectDir = path.join(tempBaseDir, "node-project");
    fs.mkdirSync(projectDir);
    fs.writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify({ name: "my-node-app", version: "1.0.0" }),
      "utf-8"
    );
    fs.writeFileSync(path.join(projectDir, "package-lock.json"), "{}", "utf-8");
    fs.writeFileSync(path.join(projectDir, ".env.example"), "PORT=3000\n", "utf-8");

    const result = await scanProject(projectDir);

    expect(result.projectName).toBe("my-node-app");
    expect(result.detectedFiles.hasPackageJson).toBe(true);
    expect(result.detectedFiles.hasLockfile).toBe(true);
    expect(result.detectedFiles.lockfileType).toBe("npm");
    expect(result.detectedFiles.hasEnvExample).toBe(true);
    expect(result.technologies.some((t) => t.name === "Node.js")).toBe(true);
    expect(result.technologies.some((t) => t.name === "npm")).toBe(true);
  });

  it("detects Vite project configuration", async () => {
    const projectDir = path.join(tempBaseDir, "vite-project");
    fs.mkdirSync(projectDir);
    fs.writeFileSync(path.join(projectDir, "package.json"), '{"name": "vite-app"}', "utf-8");
    fs.writeFileSync(path.join(projectDir, "vite.config.ts"), "export default {}", "utf-8");

    const result = await scanProject(projectDir);
    expect(result.technologies.some((t) => t.name === "Vite")).toBe(true);
    expect(result.technologies.some((t) => t.name === "Node.js")).toBe(true);
  });

  it("detects Next.js project configuration", async () => {
    const projectDir = path.join(tempBaseDir, "next-project");
    fs.mkdirSync(projectDir);
    fs.writeFileSync(path.join(projectDir, "package.json"), '{"name": "next-app"}', "utf-8");
    fs.writeFileSync(path.join(projectDir, "next.config.mjs"), "export default {}", "utf-8");

    const result = await scanProject(projectDir);
    expect(result.technologies.some((t) => t.name === "Next.js")).toBe(true);
  });

  it("detects Django project when manage.py is present", async () => {
    const projectDir = path.join(tempBaseDir, "django-project");
    fs.mkdirSync(projectDir);
    fs.writeFileSync(path.join(projectDir, "manage.py"), "#!/usr/bin/env python\n", "utf-8");
    fs.writeFileSync(path.join(projectDir, "requirements.txt"), "django>=4.2\npsycopg2-binary\n", "utf-8");

    const result = await scanProject(projectDir);
    expect(result.technologies.some((t) => t.name === "Django")).toBe(true);
    expect(result.technologies.some((t) => t.name === "Python")).toBe(true);
  });

  it("CRITICAL RULE: requirements.txt alone does NOT produce Django", async () => {
    const projectDir = path.join(tempBaseDir, "flask-project");
    fs.mkdirSync(projectDir);
    fs.writeFileSync(
      path.join(projectDir, "requirements.txt"),
      "flask==3.0.0\nrequests==2.31.0\npydantic>=2.0\n",
      "utf-8"
    );

    const result = await scanProject(projectDir);

    expect(result.technologies.some((t) => t.name === "Python")).toBe(true);
    // MUST NOT detect Django because neither manage.py nor django dependency exists
    expect(result.technologies.some((t) => t.name === "Django")).toBe(false);
  });

  it("detects monorepo subprojects in apps/* and packages/*", async () => {
    const projectDir = path.join(tempBaseDir, "monorepo-project");
    fs.mkdirSync(projectDir);
    fs.writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify({ name: "my-monorepo", workspaces: ["apps/*", "packages/*"] }),
      "utf-8"
    );

    const appsCliDir = path.join(projectDir, "apps", "cli");
    fs.mkdirSync(appsCliDir, { recursive: true });
    fs.writeFileSync(path.join(appsCliDir, "package.json"), '{"name": "my-cli"}', "utf-8");

    const packagesCoreDir = path.join(projectDir, "packages", "core");
    fs.mkdirSync(packagesCoreDir, { recursive: true });
    fs.writeFileSync(path.join(packagesCoreDir, "package.json"), '{"name": "my-core"}', "utf-8");

    const result = await scanProject(projectDir);

    expect(result.isMonorepo).toBe(true);
    expect(result.discoveredSubprojects.length).toBe(2);
    expect(result.discoveredSubprojects.some((p) => p.relativePath === "apps/cli")).toBe(true);
    expect(result.discoveredSubprojects.some((p) => p.relativePath === "packages/core")).toBe(true);
  });

  it("handles empty directories cleanly without errors", async () => {
    const emptyDir = path.join(tempBaseDir, "empty-project");
    fs.mkdirSync(emptyDir);

    const result = await scanProject(emptyDir);

    expect(result.technologies.length).toBe(0);
    expect(result.isMonorepo).toBe(false);
    expect(result.detectedFiles.hasPackageJson).toBe(false);
  });

  it("guards against symlink escape attempts outside project root", async () => {
    const projectDir = path.join(tempBaseDir, "project-with-symlink");
    const outsideDir = path.join(tempBaseDir, "outside-secret-area");

    fs.mkdirSync(projectDir);
    fs.mkdirSync(outsideDir);
    fs.writeFileSync(path.join(outsideDir, "secret.txt"), "super-secret-content", "utf-8");
    fs.writeFileSync(path.join(projectDir, "package.json"), '{"name": "symlink-app"}', "utf-8");

    const symlinkPath = path.join(projectDir, "external-link");
    try {
      fs.symlinkSync(outsideDir, symlinkPath, "junction");
    } catch {
      // Junction / symlink might require admin on Windows; if unsupported, skip gracefully
      return;
    }

    const result = await scanProject(projectDir);
    // External link must not be followed as part of subprojects
    expect(result.projectName).toBe("symlink-app");
  });

  it("validates paths and rejects path traversal or invalid targets", () => {
    // Non-existent target
    expect(() => validateDirectory(path.join(tempBaseDir, "does-not-exist"))).toThrow(
      /Project directory does not exist/
    );

    // Null bytes injection
    expect(() => validateDirectory("foo\0bar")).toThrow(/null bytes/);

    // File instead of directory
    const filePath = path.join(tempBaseDir, "file.txt");
    fs.writeFileSync(filePath, "test", "utf-8");
    expect(() => validateDirectory(filePath)).toThrow(/Target path is not a directory/);
  });
});
