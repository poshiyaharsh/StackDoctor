import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const portInUseRule: Rule = {
  id: "PORT_IN_USE",
  title: "Required network port is already in use",
  category: "network",
  description: "A network port required by the application is already bound by another process or listener on this machine.",
  technologies: ["*"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["network_probe"],
  recommendedChecks: [
    "Run TCP connection probe against required host and port",
    "Identify listening process PID using OS netstat/ss/lsof tools"
  ],
  remediation: [
    {
      problem: "Port collision prevents application server from binding its listening socket.",
      relevance: "Starting the service on a busy port results in EADDRINUSE crash.",
      commandOrAction: "Stop the conflicting application or configure an alternate PORT in your environment.",
      expectedResult: "The port becomes free or the application starts on an alternate available port.",
      risks: "Stopping another process may terminate background services.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that the port is free using TCP probe or netstat.",
  docs: ["https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.ports?.portChecks &&
      ctx.ports.portChecks.some((c) => c.status === "in_use")
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const inUseCheck = ctx.ports?.portChecks?.find((c) => c.status === "in_use");
    if (!inUseCheck) {
      return null;
    }

    const { port, host, conclusive, processInfo } = inUseCheck;
    const processDesc = processInfo?.pid
      ? ` (PID ${processInfo.pid}${processInfo.name ? ` - ${processInfo.name}` : ""})`
      : "";
    const conclusivenessText = conclusive
      ? "Evidence is conclusive: the owning process was identified."
      : "Evidence is not conclusive: the owning process could not be determined.";

    return {
      ruleId: "PORT_IN_USE",
      title: `Port ${port} is already in use`,
      category: "network",
      severity: "high",
      confidence: conclusive ? "confirmed" : "likely",
      status: "failed",
      evidence: [
        {
          id: `ev-port-in-use-${port}`,
          kind: "network_probe",
          description: `Port ${port} listening state on ${host}`,
          observed: `Port ${port} on ${host} is actively listening${processDesc}. ${conclusivenessText}`,
          source: `${host}:${port}`,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        `Another instance of the application or a different development server is already running on port ${port}.`,
        processInfo?.pid
          ? `Process PID ${processInfo.pid} is bound to port ${port}.`
          : `A background service or container is occupying port ${port}.`
      ],
      recommendations: [
        {
          problem: `Port ${port} is occupied by another process.`,
          relevance: "Application will fail to start with EADDRINUSE.",
          commandOrAction: processInfo?.pid
            ? `Stop the application running with PID ${processInfo.pid}, or set PORT to another number.`
            : `Identify the occupying process or set PORT to an available port number.`,
          expectedResult: `Port ${port} is released or an alternate port is utilized.`,
          risks: "Manually terminating a running process will stop that process's workload.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://nodejs.org/api/errors.html#eaddrinuse"]
    };
  }
};
