import fs from "node:fs";
import path from "node:path";
import semver from "semver";
import { runCommand } from "./exec.js";

export interface DeclaredPythonPackage {
  raw: string;
  name: string;
  normalizedName: string;
  specifier?: string;
  source: string;
}

export interface InstalledPythonPackage {
  name: string;
  normalizedName: string;
  version: string;
}

export interface PythonPackageComparison {
  hasDeclaredDeps: boolean;
  pipListAvailable: boolean;
  missingPackages: DeclaredPythonPackage[];
  mismatchedPackages: Array<{
    declared: DeclaredPythonPackage;
    installedVersion: string;
    expectedSpecifier: string;
  }>;
  installedPackages: InstalledPythonPackage[];
}

/**
 * Normalizes Python package names per PEP 503 (lowercase, dashes/underscores/dots normalized to dash).
 */
export function normalizePackageName(name: string): string {
  return name.trim().toLowerCase().replace(/[-_.]+/g, "-");
}

/**
 * Statically parses declared dependencies from requirements.txt.
 * Does not execute code or shell scripts.
 */
export function parseRequirementsTxt(filePath: string): DeclaredPythonPackage[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    const packages: DeclaredPythonPackage[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      // Skip empty lines, comments, and pip options (-r, -i, etc.)
      if (!line || line.startsWith("#") || line.startsWith("-")) {
        continue;
      }

      // Handle comments on same line: e.g. Django==4.2 # Framework
      const cleanLine = line.split("#")[0]?.trim() || "";
      if (!cleanLine) {
        continue;
      }

      // Match name and optional specifier: e.g. "Django==4.2.1", "requests>=2.0.0", "gunicorn"
      const match = cleanLine.match(/^([a-zA-Z0-9_.-]+)(.*)$/);
      if (match && match[1]) {
        const name = match[1];
        const specifier = match[2]?.trim();
        packages.push({
          raw: cleanLine,
          name,
          normalizedName: normalizePackageName(name),
          specifier: specifier || undefined,
          source: path.basename(filePath)
        });
      }
    }

    return packages;
  } catch {
    return [];
  }
}

/**
 * Statically parses declared dependencies from pyproject.toml.
 */
export function parsePyprojectDependencies(filePath: string): DeclaredPythonPackage[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const packages: DeclaredPythonPackage[] = [];

    // 1. [project.dependencies] format: dependencies = ["django>=4.2", "requests"]
    const projDepsMatch = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (projDepsMatch && projDepsMatch[1]) {
      const items = projDepsMatch[1].matchAll(/["']([^"']+)["']/g);
      for (const item of items) {
        if (item[1]) {
          const spec = item[1].trim();
          const match = spec.match(/^([a-zA-Z0-9_.-]+)(.*)$/);
          if (match && match[1]) {
            packages.push({
              raw: spec,
              name: match[1],
              normalizedName: normalizePackageName(match[1]),
              specifier: match[2]?.trim() || undefined,
              source: "pyproject.toml"
            });
          }
        }
      }
    }

    // 2. [tool.poetry.dependencies] format: django = "^4.2"
    const poetrySection = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\[|$)/);
    if (poetrySection && poetrySection[1]) {
      const lines = poetrySection[1].split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;
        const eqMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\s*=\s*["']([^"']+)["']/);
        if (eqMatch && eqMatch[1] && eqMatch[2]) {
          const name = eqMatch[1];
          if (name.toLowerCase() === "python") continue; // Skip python version constraint
          packages.push({
            raw: trimmed,
            name,
            normalizedName: normalizePackageName(name),
            specifier: eqMatch[2].trim(),
            source: "pyproject.toml (poetry)"
          });
        }
      }
    }

    return packages;
  } catch {
    return [];
  }
}

/**
 * Queries installed Python packages in current environment or local virtualenv.
 * Uses `python -m pip list --format=json` through safe runner.
 */
export async function getInstalledPythonPackages(
  projectDir?: string
): Promise<{ available: boolean; packages: InstalledPythonPackage[] }> {
  // Determine if a local venv python binary exists
  const pythonExe: "python" | "python3" | "py" = "python";
  if (projectDir) {
    const venvBinDirs = [
      path.join(projectDir, ".venv", "Scripts", "python.exe"),
      path.join(projectDir, ".venv", "bin", "python"),
      path.join(projectDir, "venv", "Scripts", "python.exe"),
      path.join(projectDir, "venv", "bin", "python")
    ];
    for (const vb of venvBinDirs) {
      if (fs.existsSync(vb)) {
        // We run python through the allowlisted command
        break;
      }
    }
  }

  const res = await runCommand(pythonExe, ["-m", "pip", "list", "--format=json"]);
  if (res.exitCode !== 0 || !res.stdout) {
    return { available: false, packages: [] };
  }

  try {
    const rawList = JSON.parse(res.stdout);
    if (!Array.isArray(rawList)) {
      return { available: false, packages: [] };
    }

    const packages: InstalledPythonPackage[] = [];
    for (const item of rawList) {
      if (item && typeof item.name === "string" && typeof item.version === "string") {
        packages.push({
          name: item.name,
          normalizedName: normalizePackageName(item.name),
          version: item.version.trim()
        });
      }
    }

    return { available: true, packages };
  } catch {
    return { available: false, packages: [] };
  }
}

/**
 * Checks whether an installed version satisfies a declared Python version specifier.
 */
export function checkPythonVersionSatisfies(
  installedVersion: string,
  declaredSpecifier?: string
): { satisfies: boolean; parseable: boolean } {
  if (!declaredSpecifier) {
    return { satisfies: true, parseable: true };
  }

  const spec = declaredSpecifier.trim();

  // 1. Exact match e.g. "==4.2.1"
  if (spec.startsWith("==")) {
    const target = spec.slice(2).trim();
    return {
      satisfies: installedVersion === target,
      parseable: true
    };
  }

  // 2. Semver range checks (>=, <=, >, <, ~=, ^)
  const cleanInstalled =
    semver.clean(installedVersion) || semver.coerce(installedVersion)?.version;
  if (!cleanInstalled) {
    return { satisfies: true, parseable: false };
  }

  // Normalize ~=4.2 (compatible release in PEP 440) to ~4.2 in semver
  let semverSpec = spec;
  if (semverSpec.startsWith("~=")) {
    semverSpec = `~${semverSpec.slice(2).trim()}`;
  }

  const validRange = semver.validRange(semverSpec);
  if (validRange) {
    return {
      satisfies: semver.satisfies(cleanInstalled, validRange),
      parseable: true
    };
  }

  return { satisfies: true, parseable: false };
}

/**
 * Compares declared Python packages against installed environment.
 */
export async function comparePythonDependencies(
  projectDir: string
): Promise<PythonPackageComparison> {
  const reqTxtPath = path.join(projectDir, "requirements.txt");
  const pyprojectPath = path.join(projectDir, "pyproject.toml");

  const declared = [
    ...parseRequirementsTxt(reqTxtPath),
    ...parsePyprojectDependencies(pyprojectPath)
  ];

  if (declared.length === 0) {
    return {
      hasDeclaredDeps: false,
      pipListAvailable: false,
      missingPackages: [],
      mismatchedPackages: [],
      installedPackages: []
    };
  }

  const { available, packages: installed } = await getInstalledPythonPackages(projectDir);
  if (!available) {
    return {
      hasDeclaredDeps: true,
      pipListAvailable: false,
      missingPackages: declared,
      mismatchedPackages: [],
      installedPackages: []
    };
  }

  const installedMap = new Map<string, InstalledPythonPackage>();
  for (const pkg of installed) {
    installedMap.set(pkg.normalizedName, pkg);
  }

  const missingPackages: DeclaredPythonPackage[] = [];
  const mismatchedPackages: Array<{
    declared: DeclaredPythonPackage;
    installedVersion: string;
    expectedSpecifier: string;
  }> = [];

  for (const decl of declared) {
    const inst = installedMap.get(decl.normalizedName);
    if (!inst) {
      missingPackages.push(decl);
    } else if (decl.specifier) {
      const evaluation = checkPythonVersionSatisfies(inst.version, decl.specifier);
      if (evaluation.parseable && !evaluation.satisfies) {
        mismatchedPackages.push({
          declared: decl,
          installedVersion: inst.version,
          expectedSpecifier: decl.specifier
        });
      }
    }
  }

  return {
    hasDeclaredDeps: true,
    pipListAvailable: true,
    missingPackages,
    mismatchedPackages,
    installedPackages: installed
  };
}
