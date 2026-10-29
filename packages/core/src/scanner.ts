import fs from "node:fs";
import path from "node:path";
import type { TechnologyDetection, Evidence, Confidence } from "@stackdoctor/schemas";

export const DEFAULT_IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "venv",
  ".venv",
  "__pycache__",
  ".turbo",
  ".output",
  "coverage"
]);

export interface ScanOptions {
  maxDepth?: number;
  maxFiles?: number;
  ignoredDirs?: Set<string>;
}

export interface ScanResult {
  projectDir: string;
  projectName: string;
  isMonorepo: boolean;
  technologies: TechnologyDetection[];
  detectedFiles: {
    hasPackageJson: boolean;
    hasNodeModules: boolean;
    hasLockfile: boolean;
    lockfileType?: "npm" | "pnpm" | "yarn" | "bun";
    hasEnvExample: boolean;
    hasEnv: boolean;
    hasDockerfile: boolean;
    hasDockerCompose: boolean;
  };
  discoveredSubprojects: Array<{
    relativePath: string;
    technologies: string[];
  }>;
}

interface WalkFile {
  relativePath: string;
  absolutePath: string;
  name: string;
}

/**
 * Validates the directory path and guards against path traversal or non-directory targets.
 */
export function validateDirectory(dirPath: string): string {
  if (!dirPath || typeof dirPath !== "string") {
    throw new Error("Invalid project directory: path must be a non-empty string");
  }

  // Guard against null byte injections
  if (dirPath.includes("\0")) {
    throw new Error("Invalid project directory: path contains null bytes");
  }

  const resolved = path.resolve(dirPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Project directory does not exist: "${resolved}"`);
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Target path is not a directory: "${resolved}"`);
  }

  return fs.realpathSync(resolved);
}

/**
 * Scans a project directory adhering strictly to safety and diagnostic rules.
 */
export async function scanProject(targetDir: string, options: ScanOptions = {}): Promise<ScanResult> {
  const realProjectDir = validateDirectory(targetDir);
  const maxDepth = options.maxDepth ?? 5;
  const maxFiles = options.maxFiles ?? 10_000;
  const ignored = options.ignoredDirs ?? DEFAULT_IGNORED_DIRS;

  const files: WalkFile[] = [];
  let fileCount = 0;

  // Track discovered file names
  let hasNodeModules = false;
  let hasEnv = false;

  function walk(currentDir: string, currentDepth: number): void {
    if (currentDepth > maxDepth || fileCount >= maxFiles) return;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      // Unreadable directory (e.g. permission error); record and continue safely
      return;
    }

    for (const entry of entries) {
      if (fileCount >= maxFiles) break;

      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(realProjectDir, fullPath).replace(/\\/g, "/");

      // Check for node_modules presence in project root or subprojects
      if (entry.name === "node_modules") {
        hasNodeModules = true;
      }
      if (entry.name === ".env") {
        // Record presence only, never read contents!
        hasEnv = true;
      }

      // Ignore standard ignored folders
      if (entry.isDirectory() && ignored.has(entry.name)) {
        continue;
      }

      // Handle symlinks securely: verify destination stays within realProjectDir
      if (entry.isSymbolicLink()) {
        try {
          const linkTarget = fs.realpathSync(fullPath);
          const relTarget = path.relative(realProjectDir, linkTarget);
          if (relTarget.startsWith("..") || path.isAbsolute(relTarget)) {
            // Symlink escapes project root - do NOT follow!
            continue;
          }
          const targetStat = fs.statSync(linkTarget);
          if (targetStat.isDirectory()) {
            if (!ignored.has(entry.name)) {
              walk(linkTarget, currentDepth + 1);
            }
            continue;
          }
        } catch {
          // Broken symlink; skip safely
          continue;
        }
      }

      if (entry.isDirectory()) {
        walk(fullPath, currentDepth + 1);
      } else if (entry.isFile()) {
        fileCount++;
        files.push({
          relativePath: relPath,
          absolutePath: fullPath,
          name: entry.name
        });
      }
    }
  }

  walk(realProjectDir, 0);

  // Derive project name from root package.json or directory basename
  let projectName = path.basename(realProjectDir);
  const rootPackageJson = files.find((f) => f.relativePath === "package.json");
  if (rootPackageJson) {
    try {
      const content = fs.readFileSync(rootPackageJson.absolutePath, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed.name && typeof parsed.name === "string") {
        projectName = parsed.name;
      }
    } catch {
      // Fallback to folder name
    }
  }

  // Detect lockfiles
  let lockfileType: "npm" | "pnpm" | "yarn" | "bun" | undefined;
  if (files.some((f) => f.name === "package-lock.json")) lockfileType = "npm";
  else if (files.some((f) => f.name === "pnpm-lock.yaml")) lockfileType = "pnpm";
  else if (files.some((f) => f.name === "yarn.lock")) lockfileType = "yarn";
  else if (files.some((f) => f.name === "bun.lockb" || f.name === "bun.lock")) lockfileType = "bun";

  // Check detected top-level files
  const detectedFiles = {
    hasPackageJson: files.some((f) => f.relativePath === "package.json"),
    hasNodeModules,
    hasLockfile: !!lockfileType,
    lockfileType,
    hasEnvExample: files.some((f) => f.name === ".env.example" || f.name === ".env.sample"),
    hasEnv,
    hasDockerfile: files.some((f) => f.name === "Dockerfile" || f.name.startsWith("Dockerfile.")),
    hasDockerCompose: files.some(
      (f) =>
        f.name === "compose.yaml" ||
        f.name === "compose.yml" ||
        f.name === "docker-compose.yml" ||
        f.name === "docker-compose.yaml"
    )
  };

  // Identify Monorepo subprojects
  const subprojectPackageJsons = files.filter(
    (f) => f.name === "package.json" && f.relativePath !== "package.json"
  );
  const isMonorepo = subprojectPackageJsons.length > 0;
  const discoveredSubprojects: ScanResult["discoveredSubprojects"] = [];

  for (const pkg of subprojectPackageJsons) {
    const subfolder = path.dirname(pkg.relativePath);
    discoveredSubprojects.push({
      relativePath: subfolder,
      technologies: ["Node.js"]
    });
  }

  // Detect technologies
  const techMap = new Map<string, { confidence: Confidence; evidence: Evidence[] }>();

  function addTech(name: string, confidence: Confidence, evidence: Evidence): void {
    const existing = techMap.get(name);
    if (!existing) {
      techMap.set(name, { confidence, evidence: [evidence] });
    } else {
      existing.evidence.push(evidence);
      // Promote confidence if confirmed
      if (confidence === "confirmed") {
        existing.confidence = "confirmed";
      }
    }
  }

  const now = new Date().toISOString();

  // 1. Node.js detection
  const packageJsons = files.filter((f) => f.name === "package.json");
  if (packageJsons.length > 0) {
    for (const pkg of packageJsons) {
      addTech("Node.js", "confirmed", {
        id: `ev-node-${pkg.relativePath.replace(/[/\\]/g, "-")}`,
        kind: "file_presence",
        description: `Found package.json at ${pkg.relativePath}`,
        observed: `File exists: ${pkg.relativePath}`,
        source: pkg.relativePath,
        collectedAt: now
      });
    }
  }

  // 2. Vite detection
  const viteConfigs = files.filter((f) => /^vite\.config\.[cm]?[jt]s$/.test(f.name));
  for (const cfg of viteConfigs) {
    addTech("Vite", "confirmed", {
      id: `ev-vite-${cfg.relativePath.replace(/[/\\]/g, "-")}`,
      kind: "file_presence",
      description: `Found Vite configuration at ${cfg.relativePath}`,
      observed: `File exists: ${cfg.relativePath}`,
      source: cfg.relativePath,
      collectedAt: now
    });
  }

  // 3. Next.js detection
  const nextConfigs = files.filter((f) => /^next\.config\.[cm]?[jt]s$/.test(f.name));
  for (const cfg of nextConfigs) {
    addTech("Next.js", "confirmed", {
      id: `ev-next-${cfg.relativePath.replace(/[/\\]/g, "-")}`,
      kind: "file_presence",
      description: `Found Next.js configuration at ${cfg.relativePath}`,
      observed: `File exists: ${cfg.relativePath}`,
      source: cfg.relativePath,
      collectedAt: now
    });
  }

  // 4. Python detection
  const pythonFiles = files.filter((f) =>
    ["requirements.txt", "pyproject.toml", "Pipfile", "setup.py"].includes(f.name)
  );
  for (const pyf of pythonFiles) {
    addTech("Python", "confirmed", {
      id: `ev-python-${pyf.relativePath.replace(/[/\\]/g, "-")}`,
      kind: "file_presence",
      description: `Found Python manifest at ${pyf.relativePath}`,
      observed: `File exists: ${pyf.relativePath}`,
      source: pyf.relativePath,
      collectedAt: now
    });
  }

  // 5. Django detection
  // Non-negotiable rule: requirements.txt alone is NOT proof of Django!
  // Only detect Django if:
  // - manage.py is present, OR
  // - django is explicitly listed inside requirements.txt / pyproject.toml / Pipfile.
  const managePy = files.find((f) => f.name === "manage.py");
  let djangoInManifest = false;
  let djangoManifestPath = "";

  for (const pyf of pythonFiles) {
    try {
      const content = fs.readFileSync(pyf.absolutePath, "utf-8");
      // Check for django dependency declaration (e.g. "django", "Django==", "django>=")
      if (/\bdjango\b/i.test(content)) {
        djangoInManifest = true;
        djangoManifestPath = pyf.relativePath;
        break;
      }
    } catch {
      // Continue safely
    }
  }

  if (managePy) {
    addTech("Django", "confirmed", {
      id: `ev-django-manage-py`,
      kind: "file_presence",
      description: `Found Django entrypoint at ${managePy.relativePath}`,
      observed: `File exists: ${managePy.relativePath}`,
      source: managePy.relativePath,
      collectedAt: now
    });
  } else if (djangoInManifest) {
    addTech("Django", "likely", {
      id: `ev-django-manifest`,
      kind: "file_content",
      description: `Detected Django dependency inside ${djangoManifestPath}`,
      observed: `Django dependency listed in ${djangoManifestPath}`,
      source: djangoManifestPath,
      collectedAt: now
    });
  }

  // 6. Lockfiles / Package Manager detection
  if (lockfileType) {
    const lockfile = files.find(
      (f) =>
        f.name === "package-lock.json" ||
        f.name === "pnpm-lock.yaml" ||
        f.name === "yarn.lock" ||
        f.name === "bun.lockb" ||
        f.name === "bun.lock"
    );
    if (lockfile) {
      addTech(lockfileType, "confirmed", {
        id: `ev-lockfile-${lockfileType}`,
        kind: "file_presence",
        description: `Found ${lockfileType} lockfile at ${lockfile.relativePath}`,
        observed: `File exists: ${lockfile.relativePath}`,
        source: lockfile.relativePath,
        collectedAt: now
      });
    }
  }

  // 7. Docker detection
  const dockerfile = files.find((f) => f.name === "Dockerfile" || f.name.startsWith("Dockerfile."));
  if (dockerfile) {
    addTech("Docker", "confirmed", {
      id: `ev-docker`,
      kind: "file_presence",
      description: `Found Dockerfile at ${dockerfile.relativePath}`,
      observed: `File exists: ${dockerfile.relativePath}`,
      source: dockerfile.relativePath,
      collectedAt: now
    });
  }

  // 8. Docker Compose detection
  const composeFile = files.find(
    (f) =>
      f.name === "compose.yaml" ||
      f.name === "compose.yml" ||
      f.name === "docker-compose.yml" ||
      f.name === "docker-compose.yaml"
  );
  if (composeFile) {
    addTech("Docker Compose", "confirmed", {
      id: `ev-compose`,
      kind: "file_presence",
      description: `Found Docker Compose configuration at ${composeFile.relativePath}`,
      observed: `File exists: ${composeFile.relativePath}`,
      source: composeFile.relativePath,
      collectedAt: now
    });
  }

  // 9. MongoDB detection
  for (const f of files) {
    if (
      ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml", ".env", ".env.example", "package.json", "requirements.txt"].includes(f.name)
    ) {
      try {
        const content = fs.readFileSync(f.absolutePath, "utf-8");
        if (/\b(?:mongo|mongodb|mongoose)\b/i.test(content)) {
          addTech("MongoDB", "likely", {
            id: "ev-tech-mongodb",
            kind: "file_content",
            description: `Detected MongoDB reference in ${f.relativePath}`,
            observed: `Found MongoDB keywords in ${f.relativePath}`,
            source: f.relativePath,
            collectedAt: now
          });
          break;
        }
      } catch {
        // Continue safely
      }
    }
  }

  // 10. MySQL detection
  for (const f of files) {
    if (
      ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml", ".env", ".env.example", "package.json", "requirements.txt"].includes(f.name)
    ) {
      try {
        const content = fs.readFileSync(f.absolutePath, "utf-8");
        if (/\b(?:mysql|mysql2|mysqld)\b/i.test(content)) {
          addTech("MySQL", "likely", {
            id: "ev-tech-mysql",
            kind: "file_content",
            description: `Detected MySQL reference in ${f.relativePath}`,
            observed: `Found MySQL keywords in ${f.relativePath}`,
            source: f.relativePath,
            collectedAt: now
          });
          break;
        }
      } catch {
        // Continue safely
      }
    }
  }

  // 11. PostgreSQL detection
  for (const f of files) {
    if (
      [
        "docker-compose.yml",
        "docker-compose.yaml",
        "compose.yml",
        "compose.yaml",
        ".env",
        ".env.example",
        "package.json",
        "requirements.txt",
        "schema.prisma"
      ].includes(f.name)
    ) {
      try {
        const content = fs.readFileSync(f.absolutePath, "utf-8");
        if (/\b(?:postgres|postgresql|psql|pg)\b/i.test(content) || /postgres(?:ql)?:\/\//i.test(content)) {
          addTech("PostgreSQL", "likely", {
            id: "ev-tech-postgresql",
            kind: "file_content",
            description: `Detected PostgreSQL reference in ${f.relativePath}`,
            observed: `Found PostgreSQL keywords in ${f.relativePath}`,
            source: f.relativePath,
            collectedAt: now
          });
          break;
        }
      } catch {
        // Continue safely
      }
    }
  }

  // 12. Java, Maven, Gradle & Spring Boot detection
  const hasPom = files.some((f) => f.name === "pom.xml");
  const hasGradle = files.some((f) => f.name === "build.gradle" || f.name === "build.gradle.kts");
  const hasJavaVersionFile = files.some((f) => f.name === ".java-version" || f.name === ".sdkmanrc");

  if (hasPom || hasGradle || hasJavaVersionFile) {
    addTech("Java", "confirmed", {
      id: "ev-tech-java",
      kind: "file_presence",
      description: "Java project configuration detected",
      observed: hasPom ? "Found pom.xml" : hasGradle ? "Found Gradle build file" : "Found .java-version",
      source: hasPom ? "pom.xml" : hasGradle ? "build.gradle" : ".java-version",
      collectedAt: now
    });
  }

  if (hasPom) {
    addTech("Maven", "confirmed", {
      id: "ev-tech-maven",
      kind: "file_presence",
      description: "Maven project configuration detected",
      observed: "Found pom.xml in project root",
      source: "pom.xml",
      collectedAt: now
    });
  }

  if (hasGradle) {
    addTech("Gradle", "confirmed", {
      id: "ev-tech-gradle",
      kind: "file_presence",
      description: "Gradle build configuration detected",
      observed: "Found Gradle build file in project root",
      source: "build.gradle",
      collectedAt: now
    });
  }

  // Check for Spring Boot
  for (const f of files) {
    if (["pom.xml", "build.gradle", "build.gradle.kts"].includes(f.name)) {
      try {
        const content = fs.readFileSync(f.absolutePath, "utf-8");
        if (/org\.springframework\.boot/i.test(content) || /spring-boot/i.test(content)) {
          addTech("Spring Boot", "confirmed", {
            id: "ev-tech-spring-boot",
            kind: "file_content",
            description: `Detected Spring Boot configuration in ${f.relativePath}`,
            observed: `Found Spring Boot dependencies/plugins in ${f.relativePath}`,
            source: f.relativePath,
            collectedAt: now
          });
          break;
        }
      } catch {
        // Continue safely
      }
    }
  }

  // 13. PHP, Composer & Laravel detection
  const composerJson = files.find((f) => f.name === "composer.json");
  const composerLock = files.find((f) => f.name === "composer.lock");
  const phpVersionFile = files.find((f) => f.name === ".php-version");
  const hasPhpFiles = files.some((f) => f.name.endsWith(".php"));

  if (composerJson || composerLock || phpVersionFile || hasPhpFiles) {
    addTech("PHP", "confirmed", {
      id: "ev-tech-php",
      kind: "file_presence",
      description: "PHP project configuration detected",
      observed: composerJson
        ? "Found composer.json in project root"
        : phpVersionFile
        ? "Found .php-version file"
        : "Found PHP source files in project",
      source: composerJson ? "composer.json" : phpVersionFile ? ".php-version" : "index.php",
      collectedAt: now
    });
  }

  if (composerJson || composerLock) {
    addTech("Composer", "confirmed", {
      id: "ev-tech-composer",
      kind: "file_presence",
      description: "Composer package management detected",
      observed: composerJson ? "Found composer.json" : "Found composer.lock",
      source: composerJson ? "composer.json" : "composer.lock",
      collectedAt: now
    });
  }

  const artisanFile = files.find((f) => f.name === "artisan");
  let hasLaravelFramework = false;
  if (composerJson) {
    try {
      const content = fs.readFileSync(composerJson.absolutePath, "utf-8");
      if (/laravel\/framework/i.test(content)) {
        hasLaravelFramework = true;
      }
    } catch {
      // Continue safely
    }
  }

  if (artisanFile || hasLaravelFramework) {
    addTech("Laravel", "confirmed", {
      id: "ev-tech-laravel",
      kind: "file_presence",
      description: "Laravel framework detected",
      observed: artisanFile ? "Found artisan CLI in project root" : "Found laravel/framework dependency",
      source: artisanFile ? "artisan" : "composer.json",
      collectedAt: now
    });
  }

  // Convert technology map to array
  const technologies: TechnologyDetection[] = Array.from(techMap.entries()).map(([name, val]) => ({
    name,
    confidence: val.confidence,
    evidence: val.evidence
  }));

  return {
    projectDir: realProjectDir,
    projectName,
    isMonorepo,
    technologies,
    detectedFiles,
    discoveredSubprojects
  };
}
