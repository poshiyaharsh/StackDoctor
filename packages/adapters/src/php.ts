import fs from "node:fs";
import path from "node:path";
import semver from "semver";
import { runCommand } from "./exec.js";

export interface PhpRuntimeInfo {
  available: boolean;
  version: string | null;
  rawOutput?: string;
}

export interface PhpRequirementInfo {
  requiredVersion: string;
  sourceFile: string;
}

export interface ComposerDependencyInfo {
  hasComposerJson: boolean;
  hasVendor: boolean;
  hasAutoload: boolean;
  declaredDepsCount: number;
  missingVendor: boolean;
}

export interface LaravelConfigInfo {
  isLaravel: boolean;
  hasArtisan: boolean;
  hasAppKey: boolean;
  keyIsMissingOrEmpty: boolean;
}

export function parsePhpVersion(rawOutput: string): string | null {
  if (!rawOutput) return null;
  // Match "PHP 8.2.14 (cli)..." or just "8.2.14"
  const match = rawOutput.match(/(?:PHP\s+)?(\d+\.\d+(?:\.\d+)?)/i);
  if (!match) return null;
  return semver.clean(match[1]) || semver.coerce(match[1])?.version || match[1];
}

export function checkPhpVersionSatisfies(
  installedVersion: string,
  constraint: string
): boolean {
  try {
    const coerced = semver.coerce(installedVersion);
    if (!coerced) return false;
    // Composer uses | or || for multiple constraints, e.g. "^8.1 || ^8.2" or "^8.1|^8.2"
    const parts = constraint
      .split(/\|+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return true;
    return parts.some((part) => {
      try {
        return semver.satisfies(coerced.version, part);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export async function detectPhpRuntime(
  exec: typeof runCommand = runCommand
): Promise<PhpRuntimeInfo> {
  if (process.env.STACKDOCTOR_PHP_VERSION) {
    const version = parsePhpVersion(process.env.STACKDOCTOR_PHP_VERSION);
    return {
      available: Boolean(version),
      version,
      rawOutput: `PHP ${process.env.STACKDOCTOR_PHP_VERSION} (cli)`
    };
  }

  const result = await exec("php", ["-v"], { timeoutMs: 4000 });
  if (result.notFound || result.exitCode !== 0) {
    return {
      available: false,
      version: null,
      rawOutput: result.stderr || result.stdout || undefined
    };
  }

  const combined = `${result.stdout}\n${result.stderr}`;
  const version = parsePhpVersion(combined);
  return {
    available: Boolean(version),
    version,
    rawOutput: combined.trim()
  };
}

export async function detectPhpRequirement(
  projectRoot: string
): Promise<PhpRequirementInfo | null> {
  const composerPath = path.join(projectRoot, "composer.json");
  if (fs.existsSync(composerPath)) {
    try {
      const raw = fs.readFileSync(composerPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.require && typeof parsed.require.php === "string") {
        return {
          requiredVersion: parsed.require.php.trim(),
          sourceFile: "composer.json"
        };
      }
    } catch {
      // Ignore JSON parse error, another rule or caller handles invalid files
    }
  }

  const phpVersionPath = path.join(projectRoot, ".php-version");
  if (fs.existsSync(phpVersionPath)) {
    try {
      const val = fs.readFileSync(phpVersionPath, "utf-8").trim();
      if (val) {
        return {
          requiredVersion: val,
          sourceFile: ".php-version"
        };
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

export async function inspectComposerDependencies(
  projectRoot: string
): Promise<ComposerDependencyInfo> {
  const composerPath = path.join(projectRoot, "composer.json");
  const hasComposerJson = fs.existsSync(composerPath);

  if (!hasComposerJson) {
    return {
      hasComposerJson: false,
      hasVendor: false,
      hasAutoload: false,
      declaredDepsCount: 0,
      missingVendor: false
    };
  }

  let declaredDepsCount = 0;
  try {
    const raw = fs.readFileSync(composerPath, "utf-8");
    const parsed = JSON.parse(raw);
    const requireDeps = Object.keys(parsed.require || {}).filter(
      (dep) => dep.toLowerCase() !== "php" && !dep.toLowerCase().startsWith("ext-")
    );
    declaredDepsCount = requireDeps.length;
  } catch {
    declaredDepsCount = 0;
  }

  const vendorDir = path.join(projectRoot, "vendor");
  const autoloadFile = path.join(vendorDir, "autoload.php");

  const hasVendor = fs.existsSync(vendorDir);
  const hasAutoload = fs.existsSync(autoloadFile);
  const missingVendor = declaredDepsCount > 0 && (!hasVendor || !hasAutoload);

  return {
    hasComposerJson,
    hasVendor,
    hasAutoload,
    declaredDepsCount,
    missingVendor
  };
}

export async function inspectLaravelConfig(
  projectRoot: string
): Promise<LaravelConfigInfo> {
  const artisanPath = path.join(projectRoot, "artisan");
  const hasArtisan = fs.existsSync(artisanPath);

  const composerPath = path.join(projectRoot, "composer.json");
  let hasLaravelFramework = false;
  if (fs.existsSync(composerPath)) {
    try {
      const raw = fs.readFileSync(composerPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.require && parsed.require["laravel/framework"]) {
        hasLaravelFramework = true;
      }
    } catch {
      // Ignore
    }
  }

  const isLaravel = hasArtisan || hasLaravelFramework;
  if (!isLaravel) {
    return {
      isLaravel: false,
      hasArtisan: false,
      hasAppKey: false,
      keyIsMissingOrEmpty: false
    };
  }

  // Inspect .env for APP_KEY
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) {
    // If .env doesn't exist at all, ENV_EXAMPLE_PRESENT_NO_ENV handles it
    return {
      isLaravel,
      hasArtisan,
      hasAppKey: false,
      keyIsMissingOrEmpty: true
    };
  }

  try {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const lines = envContent.split(/\r?\n/);
    const keyLine = lines.find((l) => /^[^\S\r\n]*APP_KEY\s*=/.test(l));
    if (!keyLine) {
      return {
        isLaravel,
        hasArtisan,
        hasAppKey: false,
        keyIsMissingOrEmpty: true
      };
    }

    const keyVal = keyLine
      .replace(/^[^\S\r\n]*APP_KEY\s*=\s*/, "")
      .trim()
      .replace(/^['"](.*)['"]$/, "$1")
      .trim();

    if (!keyVal || keyVal === "null" || keyVal === "undefined") {
      return {
        isLaravel,
        hasArtisan,
        hasAppKey: false,
        keyIsMissingOrEmpty: true
      };
    }

    return {
      isLaravel,
      hasArtisan,
      hasAppKey: true,
      keyIsMissingOrEmpty: false
    };
  } catch {
    return {
      isLaravel,
      hasArtisan,
      hasAppKey: false,
      keyIsMissingOrEmpty: true
    };
  }
}
