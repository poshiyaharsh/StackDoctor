import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const nugetPackagesNotRestoredRule: Rule = {
  id: "NUGET_PACKAGES_NOT_RESTORED",
  title: "NuGet packages not restored",
  category: "dependencies",
  description: ".NET project declares package references in .csproj, but obj/project.assets.json is missing, causing NETSDK1004 build failures.",
  technologies: [".NET", "C#"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Check if obj/project.assets.json exists in the project directory.",
    "Run 'dotnet restore' to generate the project assets file and download referenced packages."
  ],
  remediation: [
    {
      problem: "Missing obj/project.assets.json NuGet restore assets file.",
      relevance: ".NET build halts immediately with error NETSDK1004 ('Assets file not found. Run a NuGet package restore').",
      commandOrAction: "dotnet restore",
      expectedResult: "Generates obj/project.assets.json and restores referenced packages.",
      risks: "Downloads NuGet packages from configured package sources; does not modify source code.",
      undo: "rm -rf obj/project.assets.json",
      verification: "test -f obj/project.assets.json",
      operationId: "DOTNET_RESTORE_PACKAGES"
    }
  ],
  verification: "Verify that obj/project.assets.json exists after running dotnet restore.",
  docs: ["https://learn.microsoft.com/nuget/consume-packages/package-restore"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return Boolean(
      ctx.dotnet?.projects &&
        ctx.dotnet.projects.some((p) => p.missingAssetsJson)
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    if (!ctx.dotnet?.projects) {
      return null;
    }

    const missingProj = ctx.dotnet.projects.find((p) => p.missingAssetsJson);
    if (!missingProj) {
      return null;
    }

    return {
      ruleId: "NUGET_PACKAGES_NOT_RESTORED",
      title: "NuGet packages not restored",
      category: "dependencies",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-nuget-missing-assets-json",
          kind: "file_presence",
          description: "NuGet project assets file check",
          observed: `${missingProj.projectFile} declares ${missingProj.packageReferences.length} package reference(s), but obj/project.assets.json does not exist.`,
          source: missingProj.projectFile,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "The project was freshly cloned or cleaned and 'dotnet restore' has not been run.",
        "The 'obj' directory was deleted or excluded from source control."
      ],
      recommendations: [
        {
          problem: "NuGet packages have not been restored locally.",
          relevance: "Build and compilation will fail with NETSDK1004.",
          commandOrAction: "dotnet restore",
          expectedResult: "obj/project.assets.json is generated.",
          risks: "Downloads NuGet packages.",
          undo: "rm -rf obj/project.assets.json",
          verification: "test -f obj/project.assets.json"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://learn.microsoft.com/nuget/consume-packages/package-restore"]
    };
  }
};

