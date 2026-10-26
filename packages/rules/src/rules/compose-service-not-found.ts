import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const composeServiceNotFoundRule: Rule = {
  id: "COMPOSE_SERVICE_NOT_FOUND",
  title: "Application references Docker Compose service not defined in compose file",
  category: "configuration",
  description: "An application configuration or environment URL references a service name that does not exist in the project's docker-compose.yml services.",
  technologies: ["Docker", "Docker Compose"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Parse docker-compose.yml services definition",
    "Inspect environment hostnames and URLs referenced in project configuration"
  ],
  remediation: [
    {
      problem: "Application cannot resolve or connect to the referenced Docker container hostname.",
      relevance: "DNS lookup for the missing container hostname fails, leading to ECONNREFUSED or ENOTFOUND errors.",
      commandOrAction: "Define the missing service in docker-compose.yml or update configuration to reference an existing service.",
      expectedResult: "All referenced hostnames correspond to defined Compose services.",
      risks: "Update compose configuration; requires restarting compose containers.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that all referenced container hostnames are defined under services in docker-compose.yml.",
  docs: ["https://docs.docker.com/compose/compose-file/"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.config?.compose?.missingReferencedServices &&
      ctx.config.compose.missingReferencedServices.length > 0
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const missing = ctx.config?.compose?.missingReferencedServices;
    if (!missing || missing.length === 0) {
      return null;
    }

    const first = missing[0];
    if (!first) {
      return null;
    }

    const definedServices = ctx.config?.compose?.services?.join(", ") || "none";

    return {
      ruleId: "COMPOSE_SERVICE_NOT_FOUND",
      title: `Referenced Docker Compose service "${first.serviceName}" not found`,
      category: "configuration",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-compose-service-not-found",
          kind: "file_presence",
          description: "Referenced service missing in docker-compose.yml",
          observed: `Service name "${first.serviceName}" referenced in ${first.source} is not defined under services in docker-compose.yml (defined services: ${definedServices}).`,
          source: first.source,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        `The service "${first.serviceName}" was renamed or removed from docker-compose.yml.`,
        "The application configuration has a typo in the service hostname."
      ],
      recommendations: [
        {
          problem: "Missing Docker Compose service definition.",
          relevance: "Application will fail to communicate with dependent container services.",
          commandOrAction: `Add service "${first.serviceName}" to docker-compose.yml or update ${first.source} to match defined services (${definedServices}).`,
          expectedResult: "Referenced hostname matches a running compose service.",
          risks: "Modifies compose file or configuration.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://docs.docker.com/compose/compose-file/"]
    };
  }
};
