import fs from "node:fs";
import path from "node:path";
import { runCommand } from "./exec.js";
import { parseRequirementsTxt, parsePyprojectDependencies } from "./python-deps.js";

export interface DjangoSettingsInfo {
  discovered: boolean;
  moduleName?: string;
  expectedFilePath?: string;
  fileExists: boolean;
}

export interface DjangoMigrationsResult {
  status: "passed" | "pending" | "skipped" | "error";
  reason?: string;
  pendingCount?: number;
  unappliedList?: string[];
}

export interface DjangoDiagnosticInfo {
  isDjangoProject: boolean;
  settings: DjangoSettingsInfo;
  migrations: DjangoMigrationsResult;
}

/**
 * Positively detects if the project is a Django project.
 * Requirements.txt alone does NOT mean Django unless "django" is explicitly listed!
 */
export function isDjangoProject(projectDir: string): boolean {
  // 1. Presence of manage.py
  if (fs.existsSync(path.join(projectDir, "manage.py"))) {
    return true;
  }

  // 2. Explicit django in requirements.txt
  const reqs = parseRequirementsTxt(path.join(projectDir, "requirements.txt"));
  if (reqs.some((r) => r.normalizedName === "django")) {
    return true;
  }

  // 3. Explicit django in pyproject.toml
  const pyproj = parsePyprojectDependencies(path.join(projectDir, "pyproject.toml"));
  if (pyproj.some((r) => r.normalizedName === "django")) {
    return true;
  }

  return false;
}

/**
 * Discovers and validates the DJANGO_SETTINGS_MODULE from manage.py statically.
 * Strictly avoids executing project code.
 */
export function discoverDjangoSettings(projectDir: string): DjangoSettingsInfo {
  const managePyPath = path.join(projectDir, "manage.py");
  if (!fs.existsSync(managePyPath)) {
    return { discovered: false, fileExists: false };
  }

  try {
    const content = fs.readFileSync(managePyPath, "utf-8");
    // Match os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'example.settings')
    const match =
      content.match(/DJANGO_SETTINGS_MODULE['"]\s*,\s*['"]([^'"]+)['"]/) ||
      content.match(/DJANGO_SETTINGS_MODULE\s*=\s*['"]([^'"]+)['"]/);

    if (!match || !match[1]) {
      return { discovered: false, fileExists: false };
    }

    const moduleName = match[1].trim();
    // Convert module path e.g. "myproject.settings" to filesystem paths
    const relativeModulePath = moduleName.replace(/\./g, path.sep);

    const candidatePaths = [
      path.join(projectDir, `${relativeModulePath}.py`),
      path.join(projectDir, relativeModulePath, "__init__.py"),
      path.join(projectDir, `${moduleName}.py`)
    ];

    let foundPath: string | undefined;
    for (const cp of candidatePaths) {
      if (fs.existsSync(cp)) {
        foundPath = cp;
        break;
      }
    }

    return {
      discovered: true,
      moduleName,
      expectedFilePath: candidatePaths[0],
      fileExists: !!foundPath
    };
  } catch {
    return { discovered: false, fileExists: false };
  }
}

/**
 * Checks for unapplied migrations safely.
 * Strictly gated behind allowProjectCode: true.
 * Without the flag, reports check as skipped without executing project code.
 */
export async function checkDjangoMigrations(
  projectDir: string,
  allowProjectCode: boolean = false
): Promise<DjangoMigrationsResult> {
  if (!allowProjectCode) {
    return {
      status: "skipped",
      reason: "requires running project code; use --allow-project-code"
    };
  }

  const managePyPath = path.join(projectDir, "manage.py");
  if (!fs.existsSync(managePyPath)) {
    return {
      status: "skipped",
      reason: "manage.py not found in project directory"
    };
  }

  // Safe read-only execution: python manage.py showmigrations --plan
  const res = await runCommand("python", ["manage.py", "showmigrations", "--plan"], {
    cwd: projectDir,
    timeoutMs: 5000
  });

  if (res.exitCode !== 0) {
    return {
      status: "error",
      reason: res.stderr || res.stdout || "Failed to inspect database schema status"
    };
  }

  const lines = res.stdout.split(/\r?\n/);
  const unappliedList: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    // Lines starting with "[ ]" indicate unapplied migrations
    if (line.startsWith("[ ]")) {
      const name = line.replace(/^\[ \]\s*/, "").trim();
      if (name) {
        unappliedList.push(name);
      }
    }
  }

  if (unappliedList.length > 0) {
    return {
      status: "pending",
      pendingCount: unappliedList.length,
      unappliedList
    };
  }

  return {
    status: "passed"
  };
}

/**
 * Performs full Django diagnostics on a project directory.
 */
export async function diagnoseDjango(
  projectDir: string,
  allowProjectCode: boolean = false
): Promise<DjangoDiagnosticInfo> {
  const isDjango = isDjangoProject(projectDir);
  if (!isDjango) {
    return {
      isDjangoProject: false,
      settings: { discovered: false, fileExists: false },
      migrations: { status: "skipped", reason: "Not a Django project" }
    };
  }

  const settings = discoverDjangoSettings(projectDir);
  const migrations = await checkDjangoMigrations(projectDir, allowProjectCode);

  return {
    isDjangoProject: true,
    settings,
    migrations
  };
}
