import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const springBootDatasourceMissingRule: Rule = {
  id: "SPRING_BOOT_DATASOURCE_MISSING",
  title: "Spring Boot DataSource URL is not configured",
  category: "configuration",
  description: "Spring Data JPA or JDBC dependencies are present, but no database connection URL (spring.datasource.url) or embedded database is configured.",
  technologies: ["Spring Boot"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_content"],
  recommendedChecks: [
    "Check your `src/main/resources/application.properties` or `application.yml` for `spring.datasource.url`",
    "If using a database, ensure username, password, and driverClassName are also set",
    "If testing locally without an external database, consider adding an embedded database dependency like H2 (`com.h2database:h2`)"
  ],
  remediation: [
    {
      problem: "Missing database connection URL for Spring Data auto-configuration.",
      relevance: "Spring Boot startup fails with `Failed to configure a DataSource: 'url' attribute is not specified`.",
      commandOrAction: "Add `spring.datasource.url=jdbc:postgresql://localhost:5432/yourdb` (or corresponding database JDBC URL) to `application.properties`, or add an embedded database dependency (`h2`).",
      expectedResult: "Spring Boot successfully initializes DataSource auto-configuration.",
      risks: "Configuration change only; harmless to project code.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify `spring.datasource.url` is declared in application properties or environment.",
  docs: ["https://spring.io/guides/gs/accessing-data-jpa"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    if (!ctx.springBoot?.isSpringBoot) {
      return false;
    }
    // Triggers if data dependency exists, but NO embedded db and NO datasource url is configured
    return (
      ctx.springBoot.hasDataDependency &&
      !ctx.springBoot.hasEmbeddedDatabase &&
      !ctx.springBoot.datasourceUrlConfigured
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    if (
      !ctx.springBoot?.isSpringBoot ||
      !ctx.springBoot.hasDataDependency ||
      ctx.springBoot.hasEmbeddedDatabase ||
      ctx.springBoot.datasourceUrlConfigured
    ) {
      return null;
    }

    const configFile = ctx.springBoot.configFilePath || "src/main/resources/application.properties";

    return {
      ruleId: "SPRING_BOOT_DATASOURCE_MISSING",
      title: "Spring Boot DataSource URL is not configured",
      category: "configuration",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-spring-boot-datasource-missing",
          kind: "file_content",
          description: "Spring Boot data auto-configuration inspection",
          observed: "Spring Boot project includes Spring Data JPA/JDBC dependencies, but no `spring.datasource.url` was found in configuration and no embedded database is available.",
          source: configFile,
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "`spring.datasource.url` was omitted from `application.properties` or `application.yml`.",
        "An embedded database like H2, HSQLDB, or Derby was expected during development but is missing from dependencies.",
        "The database URL environment variable (e.g. `SPRING_DATASOURCE_URL`) is not set."
      ],
      recommendations: [
        {
          problem: "Spring Boot DataSource auto-configuration error.",
          relevance: "Application will crash on startup during Spring context initialization.",
          commandOrAction: `Add \`spring.datasource.url\` and credentials to \`${configFile}\`, or add the H2 database dependency for local in-memory persistence.`,
          expectedResult: "Spring Boot context initializes without DataSource errors.",
          risks: "Configuration update only.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://spring.io/guides/gs/accessing-data-jpa"]
    };
  }
};

