import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const javaVersionMismatchRule: Rule = {
  id: "JAVA_VERSION_MISMATCH",
  title: "Installed Java version does not satisfy project requirement",
  category: "runtime",
  description: "The active Java runtime does not satisfy the Java version required in the project build configuration.",
  technologies: ["Java"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["command_output"],
  recommendedChecks: [
    "Check your active Java version with `java -version`",
    "Verify the required Java version declared in pom.xml (<java.version>) or build.gradle (sourceCompatibility)",
    "If using a version manager, activate the matching JDK (e.g., `sdk use java 17...` or set JAVA_HOME)"
  ],
  remediation: [
    {
      problem: "Installed Java version is incompatible with project requirements.",
      relevance: "Java compilers and frameworks like Spring Boot refuse to build or run when targeting an incompatible JVM.",
      commandOrAction: "Switch to a matching Java runtime via SDKMAN (`sdk use java <version>`) or update JAVA_HOME to point to an installed JDK of the required version.",
      expectedResult: "Active Java version matches or satisfies the project build requirement.",
      risks: "Environment variable change; does not modify source code.",
      verification: "java -version && stackdoctor scan"
    }
  ],
  verification: "Verify active Java version satisfies project build configuration.",
  docs: ["https://openjdk.org/projects/jdk/"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    if (!ctx.java?.installed || !ctx.java.requirement?.declared) {
      return false;
    }
    const installedMajor = ctx.java.majorVersion;
    const requiredMajor = ctx.java.requirement.requiredMajor;
    if (installedMajor === undefined || requiredMajor === undefined) {
      return false;
    }
    // Mismatch when installed version is lower than required version
    return installedMajor < requiredMajor;
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    if (!ctx.java?.installed || !ctx.java.requirement?.declared) {
      return null;
    }
    const installedMajor = ctx.java.majorVersion;
    const requiredMajor = ctx.java.requirement.requiredMajor;
    if (installedMajor === undefined || requiredMajor === undefined || installedMajor >= requiredMajor) {
      return null;
    }

    const req = ctx.java.requirement;
    const rawInstalled = ctx.java.rawVersion || String(installedMajor);
    const rawRequired = req.requiredVersion || String(requiredMajor);

    return {
      ruleId: "JAVA_VERSION_MISMATCH",
      title: `Installed Java ${rawInstalled} does not satisfy requirement ${rawRequired}`,
      category: "runtime",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-java-version-mismatch",
          kind: "command_output",
          description: "Active Java version versus declared requirement",
          observed: `Active Java runtime is version ${rawInstalled} (major: ${installedMajor}), but ${req.sourceFile} requires Java ${rawRequired} (${req.sourceProperty}).`,
          source: req.sourceFile || "pom.xml",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        `The project targets Java ${rawRequired}, but PATH points to an older Java ${rawInstalled} runtime.`,
        "The JAVA_HOME environment variable points to a different JDK installation.",
        "A version manager like SDKMAN or asdf has not set the active Java version for this directory."
      ],
      recommendations: [
        {
          problem: "Java runtime version mismatch.",
          relevance: "Build will fail with compilation or class file version errors (e.g. class file has wrong version).",
          commandOrAction: `Install and switch to Java ${rawRequired} using SDKMAN (\`sdk install java ${rawRequired}-tem && sdk use java ${rawRequired}-tem\`) or configure your IDE/shell JAVA_HOME.`,
          expectedResult: `\`java -version\` reports Java ${rawRequired}.`,
          risks: "Environment configuration change only.",
          verification: "java -version && stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://openjdk.org/projects/jdk/"]
    };
  }
};

