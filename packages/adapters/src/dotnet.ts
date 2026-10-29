import fs from "node:fs";
import path from "node:path";
import { runCommand } from "./exec.js";

export interface DotnetRuntimeInfo {
  available: boolean;
  version: string | null;
  majorVersion?: number;
  rawOutput?: string;
}

export interface DotnetProjectInfo {
  projectFile: string;
  projectName: string;
  targetFramework?: string;
  targetFrameworkMajor?: number;
  packageReferences: string[];
  missingAssetsJson: boolean;
  launchPort?: number;
  launchUrl?: string;
}

export function parseDotnetVersion(
  raw: string
): { rawVersion: string; majorVersion: number } | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d+)\.(\d+)(?:\.\d+)?(?:-[a-zA-Z0-9.]+)?/);
  if (!match) return null;
  const major = parseInt(match[1], 10);
  return {
    rawVersion: match[0],
    majorVersion: major
  };
}

export function parseTargetFramework(
  tfm: string
): { tfm: string; major: number } | null {
  if (!tfm) return null;
  const clean = tfm.trim();
  // Matches "net8.0", "net7.0-windows", "net9.0", "netcoreapp3.1", "netstandard2.0", "net6.0"
  const match = clean.match(/^net(?:coreapp|standard)?(\d+)(?:\.(\d+))?/i);
  if (!match) return null;
  return {
    tfm: clean,
    major: parseInt(match[1], 10)
  };
}

export async function detectDotnetRuntime(
  exec: typeof runCommand = runCommand
): Promise<DotnetRuntimeInfo> {
  if (process.env.STACKDOCTOR_DOTNET_VERSION) {
    const parsed = parseDotnetVersion(process.env.STACKDOCTOR_DOTNET_VERSION);
    return {
      available: Boolean(parsed),
      version: parsed ? parsed.rawVersion : null,
      majorVersion: parsed ? parsed.majorVersion : undefined,
      rawOutput: process.env.STACKDOCTOR_DOTNET_VERSION
    };
  }

  const result = await exec("dotnet", ["--version"], { timeoutMs: 4000 });
  if (result.notFound || result.exitCode !== 0) {
    return {
      available: false,
      version: null,
      rawOutput: result.stderr || result.stdout || undefined
    };
  }

  const output = (result.stdout || result.stderr).trim();
  const parsed = parseDotnetVersion(output);
  return {
    available: Boolean(parsed),
    version: parsed ? parsed.rawVersion : null,
    majorVersion: parsed ? parsed.majorVersion : undefined,
    rawOutput: output
  };
}

export function findCsprojFiles(dir: string, maxDepth: number = 3): string[] {
  const results: string[] = [];

  function walk(current: string, depth: number) {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name === "bin" || entry.name === "obj" || entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith(".csproj")) {
        results.push(fullPath);
      }
    }
  }

  walk(dir, 0);
  return results;
}

export async function inspectDotnetProjects(
  projectRoot: string
): Promise<DotnetProjectInfo[]> {
  const csprojPaths = findCsprojFiles(projectRoot);
  const projects: DotnetProjectInfo[] = [];

  for (const csprojPath of csprojPaths) {
    const projectDir = path.dirname(csprojPath);
    const projectName = path.basename(csprojPath, ".csproj");

    let targetFramework: string | undefined;
    let targetFrameworkMajor: number | undefined;
    const packageReferences: string[] = [];

    try {
      const content = fs.readFileSync(csprojPath, "utf-8");

      // Extract <TargetFramework>net8.0</TargetFramework>
      const tfmMatch = content.match(/<TargetFramework>(.*?)<\/TargetFramework>/i);
      if (tfmMatch && tfmMatch[1]) {
        targetFramework = tfmMatch[1].trim();
        const parsedTfm = parseTargetFramework(targetFramework);
        if (parsedTfm) {
          targetFrameworkMajor = parsedTfm.major;
        }
      }

      // Extract <PackageReference Include="Microsoft.EntityFrameworkCore" ... />
      const pkgMatches = content.matchAll(/<PackageReference\s+[^>]*Include=["']([^"']+)["']/gi);
      for (const m of pkgMatches) {
        if (m[1]) {
          packageReferences.push(m[1].trim());
        }
      }
    } catch {
      // Continue safely
    }

    // Check obj/project.assets.json
    const assetsJsonPath = path.join(projectDir, "obj", "project.assets.json");
    const missingAssetsJson =
      packageReferences.length > 0 && !fs.existsSync(assetsJsonPath);

    // Check launchSettings.json for applicationUrl port
    let launchPort: number | undefined;
    let launchUrl: string | undefined;
    const launchSettingsPath = path.join(
      projectDir,
      "Properties",
      "launchSettings.json"
    );

    if (fs.existsSync(launchSettingsPath)) {
      try {
        const raw = fs.readFileSync(launchSettingsPath, "utf-8");
        const parsed = JSON.parse(raw);
        const profiles = parsed.profiles || {};
        for (const pName of Object.keys(profiles)) {
          const profile = profiles[pName];
          if (profile && typeof profile.applicationUrl === "string") {
            launchUrl = profile.applicationUrl;
            // Matches http://localhost:5000 or https://localhost:5001
            const portMatch = profile.applicationUrl.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)/i);
            if (portMatch && portMatch[1]) {
              launchPort = parseInt(portMatch[1], 10);
              break;
            }
          }
        }
      } catch {
        // Ignore parse error
      }
    }

    projects.push({
      projectFile: path.relative(projectRoot, csprojPath).replace(/\\/g, "/"),
      projectName,
      targetFramework,
      targetFrameworkMajor,
      packageReferences,
      missingAssetsJson,
      launchPort,
      launchUrl
    });
  }

  return projects;
}
