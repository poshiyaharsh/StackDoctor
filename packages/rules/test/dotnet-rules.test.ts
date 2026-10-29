import { describe, it, expect } from "vitest";
import { dotnetSdkMissingRule } from "../src/rules/dotnet-sdk-missing.js";
import { dotnetTargetFrameworkMismatchRule } from "../src/rules/dotnet-target-framework-mismatch.js";
import { nugetPackagesNotRestoredRule } from "../src/rules/nuget-packages-not-restored.js";
import { aspnetcorePortInUseRule } from "../src/rules/aspnetcore-port-in-use.js";
import type { RuleEvaluationContext } from "../src/types.js";

function createMockContext(overrides: Partial<RuleEvaluationContext> = {}): RuleEvaluationContext {
  return {
    dir: "/mock/project",
    files: {
      packageJson: false,
      packageLock: false,
      pnpmLock: false,
      yarnLock: false,
      env: false,
      envExample: false,
      dockerCompose: false,
      envExampleVarNames: []
    },
    technologies: [],
    evidence: [],
    runtime: {
      nodeVersion: "v20.0.0",
      hasActivePythonVenv: false,
      hasLocalPythonVenv: false
    },
    ports: {
      declaredPorts: [],
      portChecks: []
    },
    config: {
      missingEnvVarNames: [],
      runtimeConflict: {
        hasConflict: false
      },
      compose: {
        hasCompose: false,
        services: [],
        missingReferencedServices: []
      }
    },
    database: {
      diagnostics: []
    },
    ...overrides
  };
}

describe(".NET & ASP.NET Core Diagnostic Rules (FB-DRAFT-003)", () => {
  describe("DOTNET_SDK_MISSING", () => {
    it("flags when .NET project is detected but dotnet CLI is missing", () => {
      const ctx = createMockContext({
        technologies: [{ name: ".NET", confidence: "confirmed", evidence: [] }],
        dotnet: {
          installed: false,
          projects: []
        }
      });

      const finding = dotnetSdkMissingRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("DOTNET_SDK_MISSING");
      expect(finding?.severity).toBe("high");
    });

    it("passes when .NET SDK is installed", () => {
      const ctx = createMockContext({
        technologies: [{ name: ".NET", confidence: "confirmed", evidence: [] }],
        dotnet: {
          installed: true,
          version: "8.0.204",
          majorVersion: 8,
          projects: []
        }
      });

      const finding = dotnetSdkMissingRule.evaluate(ctx);
      expect(finding).toBeNull();
    });
  });

  describe("DOTNET_TARGET_FRAMEWORK_MISMATCH", () => {
    it("flags when project targets net8.0 but installed SDK is .NET 7", () => {
      const ctx = createMockContext({
        technologies: [{ name: ".NET", confidence: "confirmed", evidence: [] }],
        dotnet: {
          installed: true,
          version: "7.0.400",
          majorVersion: 7,
          projects: [
            {
              projectFile: "MyApp.csproj",
              projectName: "MyApp",
              targetFramework: "net8.0",
              targetFrameworkMajor: 8,
              packageReferences: [],
              missingAssetsJson: false
            }
          ]
        }
      });

      const finding = dotnetTargetFrameworkMismatchRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("DOTNET_TARGET_FRAMEWORK_MISMATCH");
      expect(finding?.severity).toBe("high");
      expect(finding?.title).toContain("Installed .NET SDK 7.0.400 does not support target framework net8.0");
    });

    it("passes when installed SDK matches or exceeds target framework", () => {
      const ctx = createMockContext({
        technologies: [{ name: ".NET", confidence: "confirmed", evidence: [] }],
        dotnet: {
          installed: true,
          version: "8.0.204",
          majorVersion: 8,
          projects: [
            {
              projectFile: "MyApp.csproj",
              projectName: "MyApp",
              targetFramework: "net8.0",
              targetFrameworkMajor: 8,
              packageReferences: [],
              missingAssetsJson: false
            }
          ]
        }
      });

      const finding = dotnetTargetFrameworkMismatchRule.evaluate(ctx);
      expect(finding).toBeNull();
    });
  });

  describe("NUGET_PACKAGES_NOT_RESTORED", () => {
    it("flags when package references exist but obj/project.assets.json is missing", () => {
      const ctx = createMockContext({
        technologies: [{ name: ".NET", confidence: "confirmed", evidence: [] }],
        dotnet: {
          installed: true,
          version: "8.0.204",
          majorVersion: 8,
          projects: [
            {
              projectFile: "MyApp.csproj",
              projectName: "MyApp",
              targetFramework: "net8.0",
              targetFrameworkMajor: 8,
              packageReferences: ["Microsoft.EntityFrameworkCore"],
              missingAssetsJson: true
            }
          ]
        }
      });

      const finding = nugetPackagesNotRestoredRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("NUGET_PACKAGES_NOT_RESTORED");
      expect(finding?.severity).toBe("high");
      expect(finding?.recommendations[0]?.commandOrAction).toContain("dotnet restore");
    });

    it("passes when assets JSON exists", () => {
      const ctx = createMockContext({
        technologies: [{ name: ".NET", confidence: "confirmed", evidence: [] }],
        dotnet: {
          installed: true,
          version: "8.0.204",
          majorVersion: 8,
          projects: [
            {
              projectFile: "MyApp.csproj",
              projectName: "MyApp",
              targetFramework: "net8.0",
              targetFrameworkMajor: 8,
              packageReferences: ["Microsoft.EntityFrameworkCore"],
              missingAssetsJson: false
            }
          ]
        }
      });

      const finding = nugetPackagesNotRestoredRule.evaluate(ctx);
      expect(finding).toBeNull();
    });
  });

  describe("ASPNETCORE_PORT_IN_USE", () => {
    it("flags when ASP.NET Core configured launch port is occupied", () => {
      const ctx = createMockContext({
        technologies: [
          { name: ".NET", confidence: "confirmed", evidence: [] },
          { name: "ASP.NET Core", confidence: "confirmed", evidence: [] }
        ],
        ports: {
          declaredPorts: [],
          portChecks: [
            {
              port: 5055,
              host: "127.0.0.1",
              status: "in_use",
              conclusive: true,
              processInfo: { pid: 4321, name: "another-web" }
            }
          ]
        },
        dotnet: {
          installed: true,
          version: "8.0.204",
          majorVersion: 8,
          projects: [
            {
              projectFile: "WebAPI.csproj",
              projectName: "WebAPI",
              targetFramework: "net8.0",
              targetFrameworkMajor: 8,
              packageReferences: [],
              missingAssetsJson: false,
              launchPort: 5055
            }
          ]
        }
      });

      const finding = aspnetcorePortInUseRule.evaluate(ctx);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe("ASPNETCORE_PORT_IN_USE");
      expect(finding?.severity).toBe("high");
      expect(finding?.title).toContain("ASP.NET Core port 5055 is already in use");
    });

    it("passes when configured port is available", () => {
      const ctx = createMockContext({
        technologies: [
          { name: ".NET", confidence: "confirmed", evidence: [] },
          { name: "ASP.NET Core", confidence: "confirmed", evidence: [] }
        ],
        ports: {
          declaredPorts: [],
          portChecks: [
            {
              port: 5055,
              host: "127.0.0.1",
              status: "available",
              conclusive: true
            }
          ]
        },
        dotnet: {
          installed: true,
          version: "8.0.204",
          majorVersion: 8,
          projects: [
            {
              projectFile: "WebAPI.csproj",
              projectName: "WebAPI",
              targetFramework: "net8.0",
              targetFrameworkMajor: 8,
              packageReferences: [],
              missingAssetsJson: false,
              launchPort: 5055
            }
          ]
        }
      });

      const finding = aspnetcorePortInUseRule.evaluate(ctx);
      expect(finding).toBeNull();
    });
  });
});

