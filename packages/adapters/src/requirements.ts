import fs from "node:fs";
import path from "node:path";
import semver from "semver";

export interface NodeRequirement {
  declared: boolean;
  rawRange?: string;
  sourceFile?: string;
}

export interface NodeVersionEvaluation {
  matches: boolean;
  installedVersion: string;
  declaredRange?: string;
  sourceFile?: string;
  warning?: string;
}

export interface PythonRequirement {
  declared: boolean;
  rawRequirement?: string;
  sourceFile?: string;
}

/**
 * Detects explicitly declared Node.js version requirements from the project.
 * Declared requirements only: engines.node, .nvmrc, or .node-version.
 * Never invents a requirement if none is declared.
 */
export function detectNodeRequirement(projectDir: string): NodeRequirement {
  // 1. package.json engines.node
  const pkgPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const content = fs.readFileSync(pkgPath, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed.engines && typeof parsed.engines.node === "string") {
        return {
          declared: true,
          rawRange: parsed.engines.node.trim(),
          sourceFile: "package.json (engines.node)"
        };
      }
    } catch {
      // Ignore parse failure
    }
  }

  // 2. .nvmrc
  const nvmrcPath = path.join(projectDir, ".nvmrc");
  if (fs.existsSync(nvmrcPath)) {
    try {
      const content = fs.readFileSync(nvmrcPath, "utf-8").trim();
      if (content.length > 0) {
        return {
          declared: true,
          rawRange: content,
          sourceFile: ".nvmrc"
        };
      }
    } catch {
      // Ignore
    }
  }

  // 3. .node-version
  const nodeVersionPath = path.join(projectDir, ".node-version");
  if (fs.existsSync(nodeVersionPath)) {
    try {
      const content = fs.readFileSync(nodeVersionPath, "utf-8").trim();
      if (content.length > 0) {
        return {
          declared: true,
          rawRange: content,
          sourceFile: ".node-version"
        };
      }
    } catch {
      // Ignore
    }
  }

  return { declared: false };
}

/**
 * Evaluates whether an installed Node.js version satisfies the declared requirement.
 * If range is unparseable, issues a warning without failing.
 */
export function evaluateNodeVersion(
  installedVersionRaw: string,
  requirement: NodeRequirement
): NodeVersionEvaluation {
  const installedClean = semver.clean(installedVersionRaw) || semver.coerce(installedVersionRaw)?.version || installedVersionRaw;

  if (!requirement.declared || !requirement.rawRange) {
    return {
      matches: true,
      installedVersion: installedClean
    };
  }

  let range = requirement.rawRange;
  // If .nvmrc contains e.g. "20" or "v20.10.0", convert to valid semver range
  if (/^v?\d+$/.test(range)) {
    const major = range.replace(/^v/, "");
    range = `^${major}.0.0`;
  } else if (/^v\d+\.\d+\.\d+/.test(range)) {
    range = range.replace(/^v/, "");
  }

  const validRange = semver.validRange(range);
  if (!validRange) {
    return {
      matches: true,
      installedVersion: installedClean,
      declaredRange: requirement.rawRange,
      sourceFile: requirement.sourceFile,
      warning: `could not interpret declared range "${requirement.rawRange}"`
    };
  }

  const satisfies = semver.satisfies(installedClean, validRange);
  return {
    matches: satisfies,
    installedVersion: installedClean,
    declaredRange: requirement.rawRange,
    sourceFile: requirement.sourceFile
  };
}

/**
 * Detects explicitly declared Python version requirements from the project.
 * Declared requirements only: .python-version, pyproject.toml, or runtime.txt.
 */
export function detectPythonRequirement(projectDir: string): PythonRequirement {
  // 1. .python-version
  const pyVerPath = path.join(projectDir, ".python-version");
  if (fs.existsSync(pyVerPath)) {
    try {
      const content = fs.readFileSync(pyVerPath, "utf-8").trim();
      if (content.length > 0) {
        return {
          declared: true,
          rawRequirement: content,
          sourceFile: ".python-version"
        };
      }
    } catch {
      // Ignore
    }
  }

  // 2. pyproject.toml
  const pyprojectPath = path.join(projectDir, "pyproject.toml");
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, "utf-8");
      const match =
        content.match(/requires-python\s*=\s*["']([^"']+)["']/) ||
        content.match(/python\s*=\s*["']([^"']+)["']/);
      if (match && match[1]) {
        return {
          declared: true,
          rawRequirement: match[1].trim(),
          sourceFile: "pyproject.toml"
        };
      }
    } catch {
      // Ignore
    }
  }

  // 3. runtime.txt (e.g. python-3.11.4)
  const runtimePath = path.join(projectDir, "runtime.txt");
  if (fs.existsSync(runtimePath)) {
    try {
      const content = fs.readFileSync(runtimePath, "utf-8").trim();
      if (content.startsWith("python-")) {
        return {
          declared: true,
          rawRequirement: content.replace("python-", "").trim(),
          sourceFile: "runtime.txt"
        };
      }
    } catch {
      // Ignore
    }
  }

  return { declared: false };
}
