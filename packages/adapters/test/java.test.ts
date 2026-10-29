import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseJavaMajorVersion,
  detectJavaRequirement,
  inspectSpringBootConfig,
  detectJavaRuntime
} from "../src/java.js";

describe("Java Adapter (java.ts)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stk-java-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("parseJavaMajorVersion", () => {
    it("correctly extracts major version numbers across modern and legacy conventions", () => {
      expect(parseJavaMajorVersion('java version "1.8.0_401"')).toBe(8);
      expect(parseJavaMajorVersion('openjdk version "1.8.0_352"')).toBe(8);
      expect(parseJavaMajorVersion('openjdk version "11.0.17"')).toBe(11);
      expect(parseJavaMajorVersion('openjdk version "17.0.2"')).toBe(17);
      expect(parseJavaMajorVersion('java version "21.0.1"')).toBe(21);
      expect(parseJavaMajorVersion('21')).toBe(21);
      expect(parseJavaMajorVersion('17')).toBe(17);
      expect(parseJavaMajorVersion('1.8')).toBe(8);
      expect(parseJavaMajorVersion('invalid_version')).toBeNull();
    });
  });

  describe("detectJavaRequirement", () => {
    it("parses <java.version> from pom.xml", () => {
      fs.writeFileSync(
        path.join(tempDir, "pom.xml"),
        `<project><properties><java.version>17</java.version></properties></project>`,
        "utf-8"
      );
      const req = detectJavaRequirement(tempDir);
      expect(req.declared).toBe(true);
      expect(req.requiredVersion).toBe("17");
      expect(req.requiredMajor).toBe(17);
      expect(req.sourceFile).toBe("pom.xml");
    });

    it("parses <release> from pom.xml", () => {
      fs.writeFileSync(
        path.join(tempDir, "pom.xml"),
        `<project><build><plugins><plugin><configuration><release>21</release></configuration></plugin></plugins></build></project>`,
        "utf-8"
      );
      const req = detectJavaRequirement(tempDir);
      expect(req.declared).toBe(true);
      expect(req.requiredMajor).toBe(21);
    });

    it("parses sourceCompatibility from build.gradle", () => {
      fs.writeFileSync(
        path.join(tempDir, "build.gradle"),
        `plugins { id 'java' }\nsourceCompatibility = '17'\n`,
        "utf-8"
      );
      const req = detectJavaRequirement(tempDir);
      expect(req.declared).toBe(true);
      expect(req.requiredMajor).toBe(17);
      expect(req.sourceFile).toBe("build.gradle");
    });

    it("returns declared: false when no build file is present", () => {
      const req = detectJavaRequirement(tempDir);
      expect(req.declared).toBe(false);
    });
  });

  describe("inspectSpringBootConfig", () => {
    it("detects Spring Boot, data dependencies, and datasource configuration", () => {
      fs.writeFileSync(
        path.join(tempDir, "pom.xml"),
        `<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency></dependencies></project>`,
        "utf-8"
      );
      const resDir = path.join(tempDir, "src", "main", "resources");
      fs.mkdirSync(resDir, { recursive: true });
      fs.writeFileSync(
        path.join(resDir, "application.properties"),
        `spring.datasource.url=jdbc:postgresql://localhost:5432/mydb\nserver.port=8082\n`,
        "utf-8"
      );

      const config = inspectSpringBootConfig(tempDir);
      expect(config.isSpringBoot).toBe(true);
      expect(config.hasDataDependency).toBe(true);
      expect(config.hasEmbeddedDatabase).toBe(false);
      expect(config.datasourceUrlConfigured).toBe(true);
      expect(config.serverPort).toBe(8082);
    });

    it("flags missing datasource when data JPA is used without URL or embedded db", () => {
      fs.writeFileSync(
        path.join(tempDir, "pom.xml"),
        `<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency></dependencies></project>`,
        "utf-8"
      );
      const resDir = path.join(tempDir, "src", "main", "resources");
      fs.mkdirSync(resDir, { recursive: true });
      fs.writeFileSync(
        path.join(resDir, "application.properties"),
        `server.port=8080\n`,
        "utf-8"
      );

      const config = inspectSpringBootConfig(tempDir);
      expect(config.isSpringBoot).toBe(true);
      expect(config.hasDataDependency).toBe(true);
      expect(config.datasourceUrlConfigured).toBe(false);
    });
  });

  describe("detectJavaRuntime", () => {
    it("executes without throwing and reports runtime status", async () => {
      const info = await detectJavaRuntime();
      expect(typeof info.installed).toBe("boolean");
      if (info.installed) {
        expect(info.majorVersion).toBeDefined();
        expect(typeof info.majorVersion).toBe("number");
      }
    });
  });
});

