import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseDotnetVersion,
  parseTargetFramework,
  detectDotnetRuntime,
  inspectDotnetProjects
} from "../src/dotnet.js";

describe(".NET Adapter Unit Tests (FB-DRAFT-003)", () => {
  it("parses dotnet SDK version strings", () => {
    expect(parseDotnetVersion("8.0.204")).toEqual({
      rawVersion: "8.0.204",
      majorVersion: 8
    });
    expect(parseDotnetVersion("9.0.100-preview.7")).toEqual({
      rawVersion: "9.0.100-preview.7",
      majorVersion: 9
    });
    expect(parseDotnetVersion("6.0.400\n")).toEqual({
      rawVersion: "6.0.400",
      majorVersion: 6
    });
    expect(parseDotnetVersion("")).toBe(null);
  });

  it("parses TargetFramework moniker (TFM)", () => {
    expect(parseTargetFramework("net8.0")).toEqual({
      tfm: "net8.0",
      major: 8
    });
    expect(parseTargetFramework("net9.0-windows")).toEqual({
      tfm: "net9.0-windows",
      major: 9
    });
    expect(parseTargetFramework("netcoreapp3.1")).toEqual({
      tfm: "netcoreapp3.1",
      major: 3
    });
    expect(parseTargetFramework("netstandard2.0")).toEqual({
      tfm: "netstandard2.0",
      major: 2
    });
    expect(parseTargetFramework("unknown")).toBe(null);
  });

  it("detects .NET projects, package references, missing assets, and launch port", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stk-dotnet-test-"));
    try {
      const csprojContent = `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
  </ItemGroup>
</Project>`;

      fs.writeFileSync(path.join(tmp, "MyService.csproj"), csprojContent);

      const propsDir = path.join(tmp, "Properties");
      fs.mkdirSync(propsDir);
      fs.writeFileSync(
        path.join(propsDir, "launchSettings.json"),
        JSON.stringify({
          profiles: {
            http: {
              applicationUrl: "http://localhost:5055"
            }
          }
        })
      );

      // Without obj/project.assets.json -> missingAssetsJson should be true
      const projects1 = await inspectDotnetProjects(tmp);
      expect(projects1).toHaveLength(1);
      expect(projects1[0].projectName).toBe("MyService");
      expect(projects1[0].targetFramework).toBe("net8.0");
      expect(projects1[0].targetFrameworkMajor).toBe(8);
      expect(projects1[0].packageReferences).toContain("Microsoft.EntityFrameworkCore");
      expect(projects1[0].packageReferences).toContain("Swashbuckle.AspNetCore");
      expect(projects1[0].missingAssetsJson).toBe(true);
      expect(projects1[0].launchPort).toBe(5055);

      // With obj/project.assets.json -> missingAssetsJson should be false
      const objDir = path.join(tmp, "obj");
      fs.mkdirSync(objDir);
      fs.writeFileSync(path.join(objDir, "project.assets.json"), "{}");

      const projects2 = await inspectDotnetProjects(tmp);
      expect(projects2[0].missingAssetsJson).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("handles mocked detectDotnetRuntime", async () => {
    const mockExecFound = async () => ({
      exitCode: 0,
      stdout: "8.0.204\n",
      stderr: "",
      timedOut: false,
      truncated: false,
      notFound: false
    });

    const runtime1 = await detectDotnetRuntime(mockExecFound as any);
    expect(runtime1.available).toBe(true);
    expect(runtime1.version).toBe("8.0.204");
    expect(runtime1.majorVersion).toBe(8);

    const mockExecNotFound = async () => ({
      exitCode: null,
      stdout: "",
      stderr: "command not found: dotnet",
      timedOut: false,
      truncated: false,
      notFound: true
    });

    const runtime2 = await detectDotnetRuntime(mockExecNotFound as any);
    expect(runtime2.available).toBe(false);
    expect(runtime2.version).toBe(null);
  });
});

