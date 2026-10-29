import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const aspnetcorePortInUseRule: Rule = {
  id: "ASPNETCORE_PORT_IN_USE",
  title: "ASP.NET Core configured application port is already in use",
  category: "network",
  description: "The port configured in Properties/launchSettings.json or appsettings.json is already occupied by another listening process.",
  technologies: [".NET", "ASP.NET Core"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["network_probe"],
  recommendedChecks: [
    "Identify which process is holding the target port.",
    "Verify the 'applicationUrl' setting in Properties/launchSettings.json or 'ASPNETCORE_URLS'.",
    "Change the configured port or stop the conflicting process."
  ],
  remediation: [
    {
      problem: "Target ASP.NET Core port is occupied.",
      relevance: "Kestrel web server will fail to start on application launch with IOException / address in use.",
      commandOrAction: "Change the port in Properties/launchSettings.json or terminate the conflicting process.",
      expectedResult: "Target port is available before application startup.",
      risks: "Port configuration change only.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify target port is free before starting ASP.NET Core application.",
  docs: ["https://learn.microsoft.com/aspnet/core/fundamentals/servers/kestrel/endpoints"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    const projects = ctx.dotnet?.projects;
    const portChecks = ctx.ports?.portChecks;
    if (!projects || !portChecks) {
      return false;
    }

    return projects.some((p) => {
      if (!p.launchPort) return false;
      return portChecks.some(
        (chk) => chk.port === p.launchPort && chk.status === "in_use"
      );
    });
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const projects = ctx.dotnet?.projects;
    const portChecks = ctx.ports?.portChecks;
    if (!projects || !portChecks) {
      return null;
    }

    for (const proj of projects) {
      if (!proj.launchPort) continue;
      const portCheck = portChecks.find(
        (chk) => chk.port === proj.launchPort && chk.status === "in_use"
      );

      if (portCheck) {
        const procDesc = portCheck.processInfo?.pid
          ? ` (PID ${portCheck.processInfo.pid}${portCheck.processInfo.name ? ` - ${portCheck.processInfo.name}` : ""})`
          : "";

        return {
          ruleId: "ASPNETCORE_PORT_IN_USE",
          title: `ASP.NET Core port ${proj.launchPort} is already in use`,
          category: "network",
          severity: "high",
          confidence: "confirmed",
          status: "failed",
          evidence: [
            {
              id: `ev-aspnetcore-port-in-use-${proj.launchPort}`,
              kind: "network_probe",
              description: `TCP probe for port ${proj.launchPort} configured in ${proj.projectFile}`,
              observed: `Port ${proj.launchPort} is actively in use by another process${procDesc}.`,
              source: `127.0.0.1:${proj.launchPort}`,
              collectedAt: new Date().toISOString()
            }
          ],
          possibleCauses: [
            `Another instance of ${proj.projectName} or a different web service is already running on port ${proj.launchPort}.`,
            "A background daemon, Docker container, or IDE process is holding this port."
          ],
          recommendations: [
            {
              problem: `Port ${proj.launchPort} conflict.`,
              relevance: "Kestrel web server will crash on boot with IOException.",
              commandOrAction: `Update applicationUrl in Properties/launchSettings.json to use an unoccupied port, or stop the listening process${procDesc}.`,
              expectedResult: `Port ${proj.launchPort} is released or application targets a free port.`,
              risks: "Port configuration change only.",
              verification: "stackdoctor scan"
            }
          ],
          verificationStatus: "unverified",
          docs: ["https://learn.microsoft.com/aspnet/core/fundamentals/servers/kestrel/endpoints"]
        };
      }
    }

    return null;
  }
};
