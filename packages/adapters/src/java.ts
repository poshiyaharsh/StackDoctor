import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { runCommand } from "./exec.js";

export interface JavaRuntimeInfo {
  installed: boolean;
  rawVersion?: string;
  majorVersion?: number;
  rawOutput?: string;
  error?: string;
}

export interface JavaRequirementInfo {
  declared: boolean;
  requiredVersion?: string;
  requiredMajor?: number;
  sourceFile?: string;
  sourceProperty?: string;
}

export interface SpringBootConfigInfo {
  isSpringBoot: boolean;
  hasDataDependency: boolean;
  hasEmbeddedDatabase: boolean;
  datasourceUrlConfigured: boolean;
  serverPort?: number;
  serverPortDeclared: boolean;
  configFilePath?: string;
}

/**
 * Extracts the Java major version integer (e.g. "1.8.0_401" -> 8, "17.0.2" -> 17, "21" -> 21).
 */
export function parseJavaMajorVersion(versionStr: string): number | null {
  const match = versionStr.match(/["']?(?:(?:openjdk|java)\s+version\s+)?(\d+)(?:\.(\d+))?/i);
  if (!match || !match[1]) return null;
  const first = parseInt(match[1], 10);
  if (first === 1 && match[2]) {
    return parseInt(match[2], 10);
  }
  return first;
}

/**
 * Checks for an installed Java runtime by running `java -version`.
 * Never throws.
 */
export async function detectJavaRuntime(): Promise<JavaRuntimeInfo> {
  const res = await runCommand("java", ["-version"], { timeoutMs: 10000 });

  if (res.notFound) {
    return {
      installed: false,
      error: "java executable not found on PATH"
    };
  }

  // java -version outputs to stderr on standard JVMs, or stdout on some builds
  const combined = `${res.stderr}\n${res.stdout}`.trim();
  const versionMatch = combined.match(/(?:openjdk|java)\s+version\s+"([^"]+)"/i);
  const rawVersion = versionMatch ? versionMatch[1] : undefined;
  const majorVersion = rawVersion ? parseJavaMajorVersion(rawVersion) ?? undefined : undefined;

  return {
    installed: (res.exitCode === 0 || Boolean(versionMatch)) && !res.notFound,
    rawVersion,
    majorVersion,
    rawOutput: combined,
    error: res.exitCode === 0 || Boolean(versionMatch) ? undefined : res.stderr
  };
}

/**
 * Parses build files (`pom.xml`, `build.gradle`, `build.gradle.kts`, `.java-version`, `.sdkmanrc`)
 * to determine the Java version required by the project.
 */
export function detectJavaRequirement(projectDir: string): JavaRequirementInfo {
  // 1. Check pom.xml
  const pomPath = path.join(projectDir, "pom.xml");
  if (fs.existsSync(pomPath)) {
    try {
      const pom = fs.readFileSync(pomPath, "utf-8");
      // Check <java.version>17</java.version>
      const javaVerMatch = pom.match(/<java\.version>\s*([^<\s]+)\s*<\/java\.version>/i);
      if (javaVerMatch && javaVerMatch[1]) {
        const val = javaVerMatch[1];
        return {
          declared: true,
          requiredVersion: val,
          requiredMajor: parseJavaMajorVersion(val) ?? undefined,
          sourceFile: "pom.xml",
          sourceProperty: "<java.version>"
        };
      }

      // Check <maven.compiler.target>17</maven.compiler.target>
      const targetMatch = pom.match(/<maven\.compiler\.target>\s*([^<\s]+)\s*<\/maven\.compiler\.target>/i);
      if (targetMatch && targetMatch[1]) {
        const val = targetMatch[1];
        return {
          declared: true,
          requiredVersion: val,
          requiredMajor: parseJavaMajorVersion(val) ?? undefined,
          sourceFile: "pom.xml",
          sourceProperty: "<maven.compiler.target>"
        };
      }

      // Check <release>17</release>
      const releaseMatch = pom.match(/<release>\s*(\d+)\s*<\/release>/i);
      if (releaseMatch && releaseMatch[1]) {
        const val = releaseMatch[1];
        return {
          declared: true,
          requiredVersion: val,
          requiredMajor: parseInt(val, 10),
          sourceFile: "pom.xml",
          sourceProperty: "<release>"
        };
      }
    } catch {
      // Ignore read errors
    }
  }

  // 2. Check build.gradle or build.gradle.kts
  for (const gradleName of ["build.gradle", "build.gradle.kts"]) {
    const gradlePath = path.join(projectDir, gradleName);
    if (fs.existsSync(gradlePath)) {
      try {
        const gradle = fs.readFileSync(gradlePath, "utf-8");
        // sourceCompatibility = '17' or sourceCompatibility = JavaVersion.VERSION_17
        const compatMatch = gradle.match(/sourceCompatibility\s*=\s*['"]?([^'"\s]+)['"]?/i);
        if (compatMatch && compatMatch[1]) {
          const val = compatMatch[1].replace(/JavaVersion\.VERSION_/i, "").replace(/_/g, ".");
          return {
            declared: true,
            requiredVersion: val,
            requiredMajor: parseJavaMajorVersion(val) ?? undefined,
            sourceFile: gradleName,
            sourceProperty: "sourceCompatibility"
          };
        }

        // toolchain { languageVersion = JavaLanguageVersion.of(17) }
        const toolchainMatch = gradle.match(/languageVersion(?:\.set)?\(?JavaLanguageVersion\.of\((\d+)\)\)?/i);
        if (toolchainMatch && toolchainMatch[1]) {
          const val = toolchainMatch[1];
          return {
            declared: true,
            requiredVersion: val,
            requiredMajor: parseInt(val, 10),
            sourceFile: gradleName,
            sourceProperty: "jvmToolchain"
          };
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  // 3. Check .java-version or .sdkmanrc
  const javaVersionFile = path.join(projectDir, ".java-version");
  if (fs.existsSync(javaVersionFile)) {
    try {
      const val = fs.readFileSync(javaVersionFile, "utf-8").trim();
      if (val) {
        return {
          declared: true,
          requiredVersion: val,
          requiredMajor: parseJavaMajorVersion(val) ?? undefined,
          sourceFile: ".java-version",
          sourceProperty: ".java-version"
        };
      }
    } catch {
      // Ignore
    }
  }

  return { declared: false };
}

/**
 * Inspects a Spring Boot project configuration statically.
 */
export function inspectSpringBootConfig(projectDir: string): SpringBootConfigInfo {
  let isSpringBoot = false;
  let hasDataDependency = false;
  let hasEmbeddedDatabase = false;

  // Check pom.xml
  const pomPath = path.join(projectDir, "pom.xml");
  if (fs.existsSync(pomPath)) {
    try {
      const pom = fs.readFileSync(pomPath, "utf-8");
      if (/org\.springframework\.boot/i.test(pom) || /spring-boot/i.test(pom)) {
        isSpringBoot = true;
      }
      if (/spring-boot-starter-data|spring-boot-starter-jdbc/i.test(pom)) {
        hasDataDependency = true;
      }
      if (/h2database|hsqldb|derby/i.test(pom)) {
        hasEmbeddedDatabase = true;
      }
    } catch {
      // Ignore
    }
  }

  // Check build.gradle or build.gradle.kts
  for (const gradleName of ["build.gradle", "build.gradle.kts"]) {
    const gradlePath = path.join(projectDir, gradleName);
    if (fs.existsSync(gradlePath)) {
      try {
        const gradle = fs.readFileSync(gradlePath, "utf-8");
        if (/org\.springframework\.boot/i.test(gradle) || /spring-boot/i.test(gradle)) {
          isSpringBoot = true;
        }
        if (/spring-boot-starter-data|spring-boot-starter-jdbc/i.test(gradle)) {
          hasDataDependency = true;
        }
        if (/h2database|hsqldb|derby/i.test(gradle)) {
          hasEmbeddedDatabase = true;
        }
      } catch {
        // Ignore
      }
    }
  }

  let datasourceUrlConfigured = false;
  let serverPort: number | undefined;
  let serverPortDeclared = false;
  let configFilePath: string | undefined;

  // Search application.properties or application.yml
  const candidateConfigPaths = [
    path.join(projectDir, "src", "main", "resources", "application.properties"),
    path.join(projectDir, "src", "main", "resources", "application.yml"),
    path.join(projectDir, "src", "main", "resources", "application.yaml"),
    path.join(projectDir, "application.properties"),
    path.join(projectDir, "application.yml")
  ];

  for (const p of candidateConfigPaths) {
    if (fs.existsSync(p)) {
      configFilePath = p;
      try {
        const content = fs.readFileSync(p, "utf-8");
        if (/spring\.datasource\.url\s*=/i.test(content) || /url:\s*(?:jdbc:|[^\s#]+)/i.test(content)) {
          datasourceUrlConfigured = true;
        }

        const portMatch = content.match(/server\.port\s*=\s*(\d+)/i) || content.match(/port:\s*(\d+)/i);
        if (portMatch && portMatch[1]) {
          serverPort = parseInt(portMatch[1], 10);
          serverPortDeclared = true;
        }
      } catch {
        // Ignore
      }
      break;
    }
  }

  // Also check environment variable for datasource
  if (process.env.SPRING_DATASOURCE_URL || process.env.DATABASE_URL) {
    datasourceUrlConfigured = true;
  }

  return {
    isSpringBoot,
    hasDataDependency,
    hasEmbeddedDatabase,
    datasourceUrlConfigured,
    serverPort,
    serverPortDeclared,
    configFilePath
  };
}

