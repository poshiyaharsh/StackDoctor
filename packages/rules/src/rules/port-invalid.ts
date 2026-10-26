import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const portInvalidRule: Rule = {
  id: "PORT_INVALID",
  title: "Declared network port is invalid or out of range",
  category: "configuration",
  description: "A network port specified in project configuration or scripts is not a valid TCP port number (must be an integer between 1 and 65535).",
  technologies: ["*"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["config_value"],
  recommendedChecks: [
    "Scan package.json scripts for port arguments",
    "Scan vite.config and .env.example for PORT values"
  ],
  remediation: [
    {
      problem: "Invalid port number configuration prevents the server from binding or causes startup crashes.",
      relevance: "Operating systems reject socket binding for ports outside 1-65535.",
      commandOrAction: "Update the configuration to specify a valid TCP port number between 1 and 65535 (e.g. 3000, 8080).",
      expectedResult: "Port value is an integer within the 1-65535 range.",
      risks: "Modifies configuration; verify the new port does not conflict with existing services.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that all declared port numbers are valid integers in the 1-65535 range.",
  docs: ["https://en.wikipedia.org/wiki/Port_(computer_networking)"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.ports?.declaredPorts &&
      ctx.ports.declaredPorts.some((p) => !p.valid)
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const invalidPort = ctx.ports?.declaredPorts?.find((p) => !p.valid);
    if (!invalidPort) {
      return null;
    }

    return {
      ruleId: "PORT_INVALID",
      title: `Declared port "${invalidPort.rawValue}" is invalid`,
      category: "configuration",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-port-invalid",
          kind: "config_value",
          description: "Invalid port declaration in configuration",
          observed: `Declared port "${invalidPort.rawValue}" in ${invalidPort.source} is invalid. Valid TCP ports must be integers between 1 and 65535.`,
          source: invalidPort.source,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "A typo or non-numeric placeholder was entered in configuration.",
        "An environment variable was assigned an out-of-range port number (e.g. greater than 65535 or negative)."
      ],
      recommendations: [
        {
          problem: "Invalid port number specification.",
          relevance: "Application will crash on startup when attempting to bind an invalid port.",
          commandOrAction: `Change "${invalidPort.rawValue}" in ${invalidPort.source} to a valid port number (e.g. 3000, 5000, 8080).`,
          expectedResult: "Application binds to a valid port within 1-65535.",
          risks: "Update port configuration; harmless to code.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://en.wikipedia.org/wiki/Port_(computer_networking)"]
    };
  }
};
