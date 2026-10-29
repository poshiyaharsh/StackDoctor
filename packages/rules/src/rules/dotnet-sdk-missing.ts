import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const dotnetSdkMissingRule: Rule = {
  id: "DOTNET_SDK_MISSING",
  title: ".NET SDK is not installed or not available on PATH",
  category: "runtime",
  description: ".NET project or solution files were detected, but the 'dotnet' CLI was not found on PATH.",
  technologies: [".NET", "C#"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Run 'dotnet --version' in your terminal.",
    "Verify your PATH environment variable includes the directory where the .NET SDK is installed.",
    "Download and install the .NET SDK from https://dotnet.microsoft.com/download."
  ],
  remediation: [
    {
      problem: ".NET SDK is not installed or not found in system PATH.",
      relevance: "Cannot build, restore, or run .NET applications without the .NET SDK.",
      commandOrAction: "Install the .NET 8.0 SDK or higher and ensure 'dotnet' is in system PATH.",
      expectedResult: "'dotnet --version' returns the installed SDK version.",
      risks: "None.",
      verification: "dotnet --version && stackdoctor scan"
    }
  ],
  verification: "Verify that 'dotnet --version' runs and prints the installed SDK version.",
  docs: ["https://dotnet.microsoft.com/download"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    const isDotnet = ctx.technologies.some(
      (t) => t.name === ".NET" || t.name === "C#"
    );
    return isDotnet && ctx.dotnet !== undefined && !ctx.dotnet.installed;
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const isDotnet = ctx.technologies.some(
      (t) => t.name === ".NET" || t.name === "C#"
    );

    if (!isDotnet || !ctx.dotnet || ctx.dotnet.installed) {
      return null;
    }

    return {
      ruleId: "DOTNET_SDK_MISSING",
      title: ".NET SDK is not installed or not available on PATH",
      category: "runtime",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-dotnet-sdk-missing",
          kind: "file_presence",
          description: ".NET project detected without a functioning .NET SDK",
          observed: ".NET project configuration found, but 'dotnet' CLI was not found on PATH.",
          source: "PATH",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "The .NET SDK is not installed on this machine.",
        "The .NET SDK is installed in a non-standard directory not added to PATH.",
        "The active shell session has not loaded updated environment variables after installation."
      ],
      recommendations: [
        {
          problem: "Missing .NET SDK.",
          relevance: "Project builds and commands require the 'dotnet' CLI.",
          commandOrAction: "Install the .NET 8 or 9 SDK from https://dotnet.microsoft.com/download.",
          expectedResult: "'dotnet --version' outputs the active SDK version.",
          risks: "None.",
          verification: "dotnet --version && stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://dotnet.microsoft.com/download"]
    };
  }
};

