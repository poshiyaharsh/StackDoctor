import fs from "node:fs";
import path from "node:path";
import semver from "semver";
import yaml from "yaml";
import { checkPort, type PortCheckResult } from "./ports.js";

export interface DeclaredPort {
  port: number;
  source: string;
  rawValue: string;
  valid: boolean;
  error?: string;
}

export interface EnvNamesComparison {
  hasEnvExample: boolean;
  hasEnv: boolean;
  exampleVars: string[];
  missingVars: string[];
}

export interface RuntimeConflictDetection {
  hasConflict: boolean;
  nodeEngines?: string;
  nvmrc?: string;
  reason?: string;
}

export interface ComposeInspection {
  hasCompose: boolean;
  composeFile?: string;
  services: string[];
  missingReferencedServices: Array<{
    serviceName: string;
    source: string;
  }>;
}

export interface BackendReachabilityResult {
  url: string;
  port: number;
  isReachable: boolean;
  portCheck: PortCheckResult;
}

/**
 * Extracts variable names ONLY from a file (.env or .env.example).
 * Strictly discards all values immediately. Never prints, returns, or stores secret values.
 */
export function extractVariableNamesOnly(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    const names = new Set<string>();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const eqIdx = line.indexOf("=");
      if (eqIdx !== -1) {
        const key = line.slice(0, eqIdx).trim();
        // Variable name should follow valid shell/env identifier conventions
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
          names.add(key);
        }
      }
    }

    return Array.from(names);
  } catch {
    return [];
  }
}

/**
 * Compares variable names present in .env.example against .env.
 * Only compares variable NAMES.
 */
export function compareEnvVariableNames(projectDir: string): EnvNamesComparison {
  const examplePath = path.join(projectDir, ".env.example");
  const envPath = path.join(projectDir, ".env");

  const hasEnvExample = fs.existsSync(examplePath);
  const hasEnv = fs.existsSync(envPath);

  if (!hasEnvExample) {
    return {
      hasEnvExample: false,
      hasEnv,
      exampleVars: [],
      missingVars: []
    };
  }

  const exampleVars = extractVariableNamesOnly(examplePath);

  if (!hasEnv) {
    return {
      hasEnvExample: true,
      hasEnv: false,
      exampleVars,
      missingVars: exampleVars
    };
  }

  const envVars = new Set(extractVariableNamesOnly(envPath));
  const missingVars = exampleVars.filter((v) => !envVars.has(v));

  return {
    hasEnvExample: true,
    hasEnv: true,
    exampleVars,
    missingVars
  };
}

/**
 * Statically extracts declared ports from package.json scripts, vite config, .env.example, and compose files.
 * Never executes scripts or arbitrary code.
 */
export function detectDeclaredPorts(projectDir: string): DeclaredPort[] {
  const ports: DeclaredPort[] = [];

  // Helper to validate and add port
  const addPort = (raw: string, source: string) => {
    const parsed = parseInt(raw, 10);
    const isNum = /^\d+$/.test(raw.trim());
    if (!isNum || isNaN(parsed) || parsed < 1 || parsed > 65535) {
      ports.push({
        port: parsed || 0,
        source,
        rawValue: raw,
        valid: false,
        error: `Declared port "${raw}" is not a valid TCP port number (must be integer 1-65535)`
      });
    } else {
      ports.push({
        port: parsed,
        source,
        rawValue: raw,
        valid: true
      });
    }
  };

  // 1. package.json scripts
  const pkgPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const content = fs.readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(content);
      if (pkg.scripts && typeof pkg.scripts === "object") {
        for (const [scriptName, scriptCmd] of Object.entries(pkg.scripts)) {
          if (typeof scriptCmd === "string") {
            const portMatches = scriptCmd.matchAll(/(?:--port|-p|\bPORT=)\s*["']?(\w+)["']?/g);
            for (const match of portMatches) {
              if (match[1]) {
                addPort(match[1], `package.json (script "${scriptName}")`);
              }
            }
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  // 2. Vite config (vite.config.ts, vite.config.js, etc.)
  const viteFiles = ["vite.config.ts", "vite.config.js", "vite.config.mjs", "vite.config.cjs"];
  for (const vf of viteFiles) {
    const fullPath = path.join(projectDir, vf);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        const portMatch = content.match(/port\s*:\s*([0-9a-zA-Z_-]+)/);
        if (portMatch && portMatch[1]) {
          addPort(portMatch[1], vf);
        }
      } catch {
        // Ignore
      }
      break;
    }
  }

  // 3. .env.example PORT entry
  const envExamplePath = path.join(projectDir, ".env.example");
  if (fs.existsSync(envExamplePath)) {
    try {
      const content = fs.readFileSync(envExamplePath, "utf-8");
      const match = content.match(/^PORT\s*=\s*(.+)$/m);
      if (match && match[1]) {
        const val = match[1].trim().replace(/^["']|["']$/g, "");
        addPort(val, ".env.example");
      }
    } catch {
      // Ignore
    }
  }

  // 4. Docker Compose ports mapping
  const composeFiles = [
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yml",
    "compose.yaml"
  ];
  for (const cf of composeFiles) {
    const fullPath = path.join(projectDir, cf);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        const parsed = yaml.parse(content);
        if (parsed?.services && typeof parsed.services === "object") {
          for (const [sName, sDef] of Object.entries(parsed.services)) {
            const portsList = (sDef as { ports?: unknown[] })?.ports;
            if (Array.isArray(portsList)) {
              for (const p of portsList) {
                if (typeof p === "string" || typeof p === "number") {
                  const str = String(p);
                  // Format "hostPort:containerPort" or "hostPort"
                  const hostPort = str.split(":")[0]?.trim();
                  if (hostPort) {
                    addPort(hostPort, `${cf} (service "${sName}")`);
                  }
                }
              }
            }
          }
        }
      } catch {
        // Safe fallback
      }
      break;
    }
  }

  return ports;
}

/**
 * Detects conflicts between .nvmrc and engines.node declarations.
 */
export function checkRuntimeConflicts(projectDir: string): RuntimeConflictDetection {
  let enginesNode: string | undefined;
  let nvmrc: string | undefined;

  const pkgPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const content = fs.readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(content);
      if (pkg.engines?.node && typeof pkg.engines.node === "string") {
        enginesNode = pkg.engines.node.trim();
      }
    } catch {
      // Ignore
    }
  }

  const nvmrcPath = path.join(projectDir, ".nvmrc");
  if (fs.existsSync(nvmrcPath)) {
    try {
      nvmrc = fs.readFileSync(nvmrcPath, "utf-8").trim();
    } catch {
      // Ignore
    }
  }

  if (!enginesNode || !nvmrc) {
    return { hasConflict: false, nodeEngines: enginesNode, nvmrc };
  }

  // Normalize nvmrc
  let nvmrcVersion = nvmrc.replace(/^v/, "");
  if (/^\d+$/.test(nvmrcVersion)) {
    nvmrcVersion = `${nvmrcVersion}.0.0`;
  }

  const validEngines = semver.validRange(enginesNode);
  const cleanNvm = semver.clean(nvmrcVersion) || semver.coerce(nvmrcVersion)?.version;

  if (validEngines && cleanNvm) {
    if (!semver.satisfies(cleanNvm, validEngines)) {
      return {
        hasConflict: true,
        nodeEngines: enginesNode,
        nvmrc,
        reason: `.nvmrc specifies Node.js "${nvmrc}" which does not satisfy engines.node requirement "${enginesNode}" in package.json.`
      };
    }
  }

  return { hasConflict: false, nodeEngines: enginesNode, nvmrc };
}

/**
 * Inspects Docker Compose configuration and flags referenced service names that are not defined.
 */
export function inspectComposeServices(projectDir: string): ComposeInspection {
  const composeFiles = [
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yml",
    "compose.yaml"
  ];

  let composeFile: string | undefined;
  let parsedYaml: Record<string, unknown> | undefined;

  for (const cf of composeFiles) {
    const fullPath = path.join(projectDir, cf);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        parsedYaml = yaml.parse(content);
        composeFile = cf;
      } catch {
        // Ignore YAML error
      }
      break;
    }
  }

  if (!composeFile || !parsedYaml?.services || typeof parsedYaml.services !== "object") {
    return {
      hasCompose: false,
      services: [],
      missingReferencedServices: []
    };
  }

  const services = Object.keys(parsedYaml.services);
  const serviceSet = new Set(services);
  const missingReferencedServices: Array<{ serviceName: string; source: string }> = [];

  // Check .env.example for service references in URLs/hosts (e.g. http://api:8080, mongodb://database:27017)
  const envExamplePath = path.join(projectDir, ".env.example");
  if (fs.existsSync(envExamplePath)) {
    try {
      const content = fs.readFileSync(envExamplePath, "utf-8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        if (!line || line.trim().startsWith("#")) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx !== -1) {
          const val = line.slice(eqIdx + 1).trim();
          // Extract host from url like protocol://hostname:port or protocol://hostname/
          const urlMatch = val.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^:/@]+)(?::\d+)?/);
          if (urlMatch && urlMatch[1]) {
            const host = urlMatch[1].toLowerCase();
            const isLocal =
              host === "localhost" ||
              host === "127.0.0.1" ||
              host === "0.0.0.0" ||
              host === "host.docker.internal" ||
              /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
              host.includes(".");
            if (!isLocal && !serviceSet.has(host)) {
              missingReferencedServices.push({
                serviceName: host,
                source: ".env.example"
              });
            }
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return {
    hasCompose: true,
    composeFile,
    services,
    missingReferencedServices
  };
}

/**
 * Checks reachability of localhost backend URLs declared in .env.example or configuration.
 */
export async function checkLocalhostBackendReachability(
  projectDir: string
): Promise<BackendReachabilityResult[]> {
  const results: BackendReachabilityResult[] = [];
  const envExamplePath = path.join(projectDir, ".env.example");

  if (!fs.existsSync(envExamplePath)) {
    return results;
  }

  try {
    const content = fs.readFileSync(envExamplePath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.trim().startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx !== -1) {
        const val = line.slice(eqIdx + 1).trim();
        const match = val.match(/https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)/i);
        if (match && match[1]) {
          const port = parseInt(match[1], 10);
          if (port >= 1 && port <= 65535) {
            const portCheck = await checkPort("127.0.0.1", port, 400);
            results.push({
              url: val,
              port,
              isReachable: portCheck.status === "in_use",
              portCheck
            });
          }
        }
      }
    }
  } catch {
    // Ignore
  }

  return results;
}
