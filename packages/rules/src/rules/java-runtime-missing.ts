import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const javaRuntimeMissingRule: Rule = {
  id: "JAVA_RUNTIME_MISSING",
  title: "Java runtime is not installed or not available on PATH",
  category: "runtime",
  description: "A Java project build file was detected, but no Java executable (java) was found in the environment.",
  technologies: ["Java"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Verify whether a JDK or JRE is installed on your system",
    "Ensure the `bin` directory of your Java installation is included in PATH",
    "Verify `JAVA_HOME` environment variable points to a valid JDK directory"
  ],
  remediation: [
    {
      problem: "Java executable is not found in PATH.",
      relevance: "Cannot compile or execute Java applications without a Java Development Kit.",
      commandOrAction: "Install a modern JDK via SDKMAN (`sdk install java`), Homebrew (`brew install openjdk`), or download from Adoptium / OpenJDK.",
      expectedResult: "`java -version` returns the installed JDK version.",
      risks: "Installs JDK software package; does not affect application source files.",
      verification: "java -version && stackdoctor scan"
    }
  ],
  verification: "Verify `java -version` executes successfully.",
  docs: ["https://openjdk.org/install/"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    const isJavaProject = ctx.technologies.some((t) => t.name === "Java");
    return isJavaProject && ctx.java !== undefined && !ctx.java.installed;
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const isJavaProject = ctx.technologies.some((t) => t.name === "Java");
    if (!isJavaProject || !ctx.java || ctx.java.installed) {
      return null;
    }

    return {
      ruleId: "JAVA_RUNTIME_MISSING",
      title: "Java runtime (java) not found on PATH",
      category: "runtime",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-java-runtime-missing",
          kind: "file_presence",
          description: "Java project detected without a functioning Java runtime",
          observed: "Java project configuration detected, but `java` executable was not found on PATH.",
          source: ctx.java.requirement?.sourceFile || "pom.xml",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "No Java Development Kit (JDK) is currently installed.",
        "A JDK is installed, but its `bin` folder is missing from the system PATH.",
        "The active shell session has not loaded the JDK environment variables."
      ],
      recommendations: [
        {
          problem: "Missing Java runtime.",
          relevance: "Build tools (Maven, Gradle) and JVM execution cannot run without Java.",
          commandOrAction: "Install a Java Development Kit (JDK 17 or JDK 21 recommended) and verify PATH includes the JDK bin directory.",
          expectedResult: "`java -version` completes with status code 0.",
          risks: "JDK package installation.",
          verification: "java -version && stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://openjdk.org/install/"]
    };
  }
};

