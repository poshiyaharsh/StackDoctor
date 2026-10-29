import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const springBootPortInUseRule: Rule = {
  id: "SPRING_BOOT_PORT_IN_USE",
  title: "Spring Boot server port is already in use by another process",
  category: "network",
  description: "The configured Spring Boot server port is actively occupied by another process, which will cause startup failure with PortInUseException.",
  technologies: ["Spring Boot"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["network_probe"],
  recommendedChecks: [
    "Check which process is listening on the target port using `netstat -ano` or `lsof -i`",
    "Verify the `server.port` configured in `src/main/resources/application.properties` or `application.yml`",
    "Terminate the colliding process or configure an alternative port (e.g., `server.port=8081` or `server.port=0` for random)"
  ],
  remediation: [
    {
      problem: "Target Spring Boot port is occupied by another process.",
      relevance: "Embedded Tomcat, Jetty, or Undertow server fails on startup with `PortInUseException: Web server failed to start. Port was already in use.`",
      commandOrAction: "Terminate the existing process running on the port or set `server.port=8081` in `application.properties`.",
      expectedResult: "Target port is released or application binds to an available alternative port.",
      risks: "Port reassignment; harmless to application code.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify target Spring Boot port is free and available.",
  docs: ["https://spring.io/guides/gs/spring-boot"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    if (!ctx.springBoot?.isSpringBoot) {
      return false;
    }
    const targetPort = ctx.springBoot.serverPort ?? 8080;
    return !!(
      ctx.ports?.portChecks &&
      ctx.ports.portChecks.some(
        (pc) => pc.port === targetPort && pc.status === "in_use" && pc.conclusive
      )
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    if (!ctx.springBoot?.isSpringBoot) {
      return null;
    }

    const targetPort = ctx.springBoot.serverPort ?? 8080;
    const portCheck = ctx.ports?.portChecks?.find(
      (pc) => pc.port === targetPort && pc.status === "in_use" && pc.conclusive
    );

    if (!portCheck) {
      return null;
    }

    const pidInfo = portCheck.processInfo?.pid ? ` (PID: ${portCheck.processInfo.pid})` : "";
    const procName = portCheck.processInfo?.name ? ` by ${portCheck.processInfo.name}` : "";

    return {
      ruleId: "SPRING_BOOT_PORT_IN_USE",
      title: `Spring Boot server port ${targetPort} is already in use`,
      category: "network",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-spring-boot-port-${targetPort}-in-use`,
          kind: "network_probe",
          description: "Spring Boot port reachability check",
          observed: `Port ${targetPort} is actively in use${procName}${pidInfo}. Embedded server will fail with PortInUseException.`,
          source: `127.0.0.1:${targetPort}`,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        `Another instance of the Spring Boot application or another service is already listening on port ${targetPort}.`,
        "A previous process run was not terminated completely and still holds the socket.",
        `A system daemon is bound to port ${targetPort}.`
      ],
      recommendations: [
        {
          problem: "Target Spring Boot port is occupied.",
          relevance: "Embedded web server fails to bind address on application launch.",
          commandOrAction: `Stop the process using port ${targetPort} or change \`server.port\` in application.properties to an unused port (e.g. \`server.port=8081\` or \`server.port=0\`).`,
          expectedResult: `Port ${targetPort} is free or Spring Boot binds to alternative port.`,
          risks: "Port reassignment.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://spring.io/guides/gs/spring-boot"]
    };
  }
};

