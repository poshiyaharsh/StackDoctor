import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const pythonPackageVersionMismatchRule: Rule = {
  id: "PYTHON_PACKAGE_VERSION_MISMATCH",
  title: "Installed Python package version does not satisfy requirement",
  category: "dependencies",
  description: "An installed Python package version does not satisfy the parseable version constraint declared in requirements.txt or pyproject.toml.",
  technologies: ["Python", "Django"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["version_check"],
  recommendedChecks: [
    "Check declared package version specifiers in requirements.txt",
    "Inspect installed versions from pip list"
  ],
  remediation: [
    {
      problem: "Installed package version is incompatible with project code expectations.",
      relevance: "Version mismatches lead to API incompatibilities or missing functions.",
      commandOrAction: "pip install --upgrade -r requirements.txt",
      expectedResult: "Package versions in the virtual environment satisfy declared constraints.",
      risks: "Upgrades or downgrades packages in active virtual environment.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify that installed package versions satisfy declared requirements.",
  docs: ["https://peps.python.org/pep-0440/"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.python?.mismatchedPackages &&
      ctx.python.mismatchedPackages.length > 0
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const mismatches = ctx.python?.mismatchedPackages;
    if (!mismatches || mismatches.length === 0) {
      return null;
    }

    const first = mismatches[0];
    if (!first) {
      return null;
    }

    const { name, installedVersion, expectedSpecifier } = first;

    return {
      ruleId: "PYTHON_PACKAGE_VERSION_MISMATCH",
      title: `Python package "${name}" version mismatch (installed ${installedVersion}, expected ${expectedSpecifier})`,
      category: "dependencies",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: `ev-python-pkg-mismatch-${name}`,
          kind: "version_check",
          description: `Version mismatch for ${name}`,
          observed: `Package "${name}" has installed version "${installedVersion}", but project requires "${expectedSpecifier}".`,
          source: first.source || "requirements.txt",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        `Package "${name}" was installed with an older or newer version than required.`,
        "Requirements file was updated after packages were installed."
      ],
      recommendations: [
        {
          problem: "Incompatible package version installed.",
          relevance: "May lead to missing attributes or deprecated function calls.",
          commandOrAction: `pip install "${name}${expectedSpecifier}"`,
          expectedResult: `Installed version of ${name} satisfies ${expectedSpecifier}.`,
          risks: "Replaces installed package version in active environment.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://peps.python.org/pep-0440/"]
    };
  }
};
