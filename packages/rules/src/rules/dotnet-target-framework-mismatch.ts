import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const dotnetTargetFrameworkMismatchRule: Rule = {
  id: "DOTNET_TARGET_FRAMEWORK_MISMATCH",
  title: "Installed .NET SDK does not support project target framework",
  category: "runtime",
  description: "The active .NET SDK version is lower than the <TargetFramework> major version declared in the project .csproj file.",
  technologies: [".NET", "C#"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["command_output", "file_content"],
  recommendedChecks: [
    "Run 'dotnet --version' to inspect your active .NET SDK version.",
    "Inspect the <TargetFramework> tag in your project .csproj file.",
    "Install the required .NET SDK version or adjust global.json if present."
  ],
  remediation: [
    {
      problem: "Installed .NET SDK is older than project target framework.",
      relevance: ".NET build and run commands will immediately halt with NETSDK1045 ('The current .NET SDK does not support targeting .NET X.X').",
      commandOrAction: "Install the matching .NET SDK version from https://dotnet.microsoft.com/download.",
      expectedResult: "Active .NET SDK satisfies project TargetFramework.",
      risks: "SDK installation only; does not modify source code.",
      verification: "dotnet --version && stackdoctor scan"
    }
  ],
  verification: "Verify active .NET SDK version supports the project's target framework.",
  docs: ["https://dotnet.microsoft.com/download"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    if (!ctx.dotnet?.installed || !ctx.dotnet.majorVersion || !ctx.dotnet.projects.length) {
      return false;
    }

    return ctx.dotnet.projects.some(
      (p) =>
        p.targetFrameworkMajor !== undefined &&
        ctx.dotnet!.majorVersion! < p.targetFrameworkMajor
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    if (!ctx.dotnet?.installed || !ctx.dotnet.majorVersion || !ctx.dotnet.projects.length) {
      return null;
    }

    const mismatched = ctx.dotnet.projects.find(
      (p) =>
        p.targetFrameworkMajor !== undefined &&
        ctx.dotnet!.majorVersion! < p.targetFrameworkMajor
    );

    if (!mismatched) {
      return null;
    }

    const installedVersion = ctx.dotnet.version || String(ctx.dotnet.majorVersion);
    const requiredTfm = mismatched.targetFramework || `net${mismatched.targetFrameworkMajor}.0`;

    return {
      ruleId: "DOTNET_TARGET_FRAMEWORK_MISMATCH",
      title: `Installed .NET SDK ${installedVersion} does not support target framework ${requiredTfm}`,
      category: "runtime",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-dotnet-tfm-mismatch",
          kind: "command_output",
          description: "Installed .NET SDK vs project TargetFramework",
          observed: `Installed .NET SDK is version ${installedVersion} (major: ${ctx.dotnet.majorVersion}), but ${mismatched.projectFile} targets ${requiredTfm} (requires .NET ${mismatched.targetFrameworkMajor}.0 SDK or higher).`,
          source: mismatched.projectFile,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        `The project targets ${requiredTfm}, but the active installed .NET SDK is version ${installedVersion}.`,
        "A global.json file pins an older SDK version than required by this project."
      ],
      recommendations: [
        {
          problem: "Target framework incompatible with SDK.",
          relevance: "dotnet build will fail with error NETSDK1045.",
          commandOrAction: `Install .NET ${mismatched.targetFrameworkMajor}.0 SDK from https://dotnet.microsoft.com/download.`,
          expectedResult: `'dotnet --version' returns version ${mismatched.targetFrameworkMajor}.x.x.`,
          risks: "None.",
          verification: "dotnet --version && stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://dotnet.microsoft.com/download"]
    };
  }
};

