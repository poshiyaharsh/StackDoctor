import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isDjangoProject,
  discoverDjangoSettings,
  checkDjangoMigrations
} from "@stackdoctor/adapters";

describe("Django Diagnostics Adapter (django.ts)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stackdoctor-django-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe("isDjangoProject", () => {
    it("CRITICAL RULE: requirements.txt alone does NOT mean Django unless django is explicitly listed", () => {
      // requirements.txt without django
      fs.writeFileSync(
        path.join(tempDir, "requirements.txt"),
        "flask==2.3.0\nrequests>=2.28.0\npydantic>=2.0\n"
      );

      expect(isDjangoProject(tempDir)).toBe(false);
    });

    it("identifies Django project when django is present in requirements.txt", () => {
      fs.writeFileSync(
        path.join(tempDir, "requirements.txt"),
        "Django==4.2.11\npsycopg2>=2.9\n"
      );

      expect(isDjangoProject(tempDir)).toBe(true);
    });

    it("identifies Django project when manage.py exists", () => {
      fs.writeFileSync(path.join(tempDir, "manage.py"), "#!/usr/bin/env python\n");
      expect(isDjangoProject(tempDir)).toBe(true);
    });
  });

  describe("discoverDjangoSettings", () => {
    it("statically parses DJANGO_SETTINGS_MODULE from manage.py and checks file presence", () => {
      const managePyContent = `
import os
import sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError:
        pass
`;
      fs.writeFileSync(path.join(tempDir, "manage.py"), managePyContent);

      // Settings file does not exist yet
      const settingsMissing = discoverDjangoSettings(tempDir);
      expect(settingsMissing.discovered).toBe(true);
      expect(settingsMissing.moduleName).toBe("myproject.settings");
      expect(settingsMissing.fileExists).toBe(false);

      // Now create settings file at myproject/settings.py
      const projectDir = path.join(tempDir, "myproject");
      fs.mkdirSync(projectDir);
      fs.writeFileSync(path.join(projectDir, "settings.py"), "SECRET_KEY = 'secret'\n");

      const settingsPresent = discoverDjangoSettings(tempDir);
      expect(settingsPresent.discovered).toBe(true);
      expect(settingsPresent.fileExists).toBe(true);
    });
  });

  describe("checkDjangoMigrations", () => {
    it("CRITICAL RULE: Without --allow-project-code, no project code is executed", async () => {
      fs.writeFileSync(path.join(tempDir, "manage.py"), "import sys; sys.exit(0)\n");

      // By default (allowProjectCode = false)
      const result = await checkDjangoMigrations(tempDir, false);
      expect(result.status).toBe("skipped");
      expect(result.reason).toContain("requires running project code; use --allow-project-code");
    });
  });
});
