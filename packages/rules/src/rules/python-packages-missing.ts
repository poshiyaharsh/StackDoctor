import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const pythonPackagesMissingRule: Rule = {
  id: "PYTHON_PACKAGES_MISSING",
  title: "Declared Python dependencies are not installed",
  category: "dependencies",
  description: "One or more packages declared in requirements.txt or pyproject.toml are not installed in the active Python environment.",
  technologies: ["Python", "Django"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["command_output"],
  recommendedChecks: [
    "Scan requirements.txt and pyproject.toml for declared packages",
    "Inspect installed packages via python -m pip list"
  ],
  remediation: [
    {
      problem: "Missing Python dependencies will cause ModuleNotFoundError or ImportError on startup.",
      relevance: "Application runtime depends on third-party libraries declared in dependency manifests.",
      commandOrAction: "pip install -r requirements.txt",
      expectedResult: "All declared packages are installed in the active virtual environment.",
      risks: "Installs packages into current Python environment; ensure a virtualenv is active.",
      verification: "stackdoctor scan",
      operationId: "PYTHON_INSTALL_REQUIREMENTS"
    }
  ],
  verification: "Verify all declared packages are present in pip list.",
  docs: ["https://pip.pypa.io/en/stable/cli/pip_install/"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.python?.missingPackages &&
      ctx.python.missingPackages.length > 0
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const missing = ctx.python?.missingPackages;
    if (!missing || missing.length === 0) {
      return null;
    }

    const packageNames = missing.map((p) => p.name).join(", ");

    return {
      ruleId: "PYTHON_PACKAGES_MISSING",
      title: `${missing.length} declared Python package(s) missing from environment`,
      category: "dependencies",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-python-pkgs-missing",
          kind: "command_output",
          description: "Missing Python packages in environment",
          observed: `The following declared Python package(s) are not installed in the active environment: ${packageNames}.`,
          source: missing[0]?.source || "requirements.txt",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "Dependencies have not yet been installed in this virtual environment.",
        "A different virtual environment or Python interpreter is currently active in the shell.",
        "Packages were recently added to requirements.txt without running installation."
      ],
      recommendations: [
        {
          problem: "Missing Python packages required by project.",
          relevance: "Application will crash when importing missing modules.",
          commandOrAction: "pip install -r requirements.txt",
          expectedResult: "Required packages are installed into environment.",
          risks: "Downloads packages from PyPI.",
          verification: "stackdoctor scan",
          operationId: "PYTHON_INSTALL_REQUIREMENTS"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://pip.pypa.io/en/stable/cli/pip_install/"]
    };
  }
};
