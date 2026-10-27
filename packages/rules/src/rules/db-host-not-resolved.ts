import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const dbHostNotResolvedRule: Rule = {
  id: "DB_HOST_NOT_RESOLVED",
  title: "Database hostname failed DNS resolution",
  category: "database",
  description: "The database hostname configured in project settings could not be resolved to an IP address (ENOTFOUND).",
  technologies: ["MongoDB", "MySQL"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["dns_resolution"],
  recommendedChecks: [
    "Verify spelling of hostname in database URL or environment variable",
    "Check system DNS settings and internet connection",
    "If hostname is a Docker service name, verify containers are running on the same Docker network"
  ],
  remediation: [
    {
      problem: "DNS resolution failed for database host.",
      relevance: "Client cannot establish network sockets without a resolvable IP address.",
      commandOrAction: "Correct the database hostname in your configuration or verify local DNS resolution.",
      expectedResult: "Hostname resolves to a valid IP address.",
      risks: "Configuration update.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify hostname resolves via DNS lookup.",
  docs: ["https://nodejs.org/api/dns.html#error-codes"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.database?.diagnostics &&
      ctx.database.diagnostics.some((d) => d.finalCategory === "dns_failure")
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const diag = ctx.database?.diagnostics?.find((d) => d.finalCategory === "dns_failure");
    if (!diag) {
      return null;
    }

    const { host } = diag;

    return {
      ruleId: "DB_HOST_NOT_RESOLVED",
      title: `Database hostname "${host}" could not be resolved`,
      category: "database",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-dns-failure-${host}`,
          kind: "dns_resolution",
          description: "Database host DNS lookup",
          observed: `DNS lookup failed for database hostname "${host}". No IP address was returned.`,
          source: host,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        `The hostname "${host}" has a typo in project configuration or environment variables.`,
        "The hostname is a container service name but the command was executed outside of the Docker container network.",
        "Local DNS server or internet connectivity is down."
      ],
      recommendations: [
        {
          problem: "Unresolvable database hostname.",
          relevance: "Database connection fails immediately before TCP handshake.",
          commandOrAction: `Update configuration to specify a valid, resolvable hostname or IP address (e.g. "localhost", "127.0.0.1", or valid domain).`,
          expectedResult: `Hostname "${host}" resolves successfully.`,
          risks: "Update hostname in environment or configuration.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://nodejs.org/api/dns.html#error-codes"]
    };
  }
};
