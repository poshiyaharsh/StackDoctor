import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const pythonVenvMissingRule: Rule = {
  id: "PYTHON_VENV_MISSING",
  title: "Python virtual environment missing",
  category: "environment",
  description: "Python project detected, but no virtual environment is active in the environment and no local venv directory exists.",
  technologies: ["Python", "Django"],
  severity: "medium",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Check VIRTUAL_ENV environment variable",
    "Scan project root for .venv or venv directories"
  ],
  remediation: [
    {
      problem: "No isolated virtual environment is available for project dependencies.",
      relevance: "Installing or running Python packages outside a virtual environment can corrupt system Python or cause package version conflicts.",
      commandOrAction: "python -m venv .venv",
      expectedResult: "A clean, isolated virtual environment folder (.venv) is initialized.",
      risks: "Creates a local .venv directory; harmless to existing code.",
      undo: "rm -rf .venv",
      verification: "test -d .venv"
    }
  ],
  verification: "Confirm that .venv directory exists or VIRTUAL_ENV is active.",
  docs: ["https://docs.python.org/3/library/venv.html"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return ctx.technologies.some(
      (t) => t.name.toLowerCase() === "python" || t.name.toLowerCase() === "django"
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const hasVenv = !!(ctx.runtime?.hasActivePythonVenv || ctx.runtime?.hasLocalPythonVenv);

    if (!hasVenv) {
      return {
        ruleId: "PYTHON_VENV_MISSING",
        title: "Python virtual environment missing",
        category: "environment",
        severity: "medium",
        confidence: "confirmed",
        status: "warning",
        evidence: [
          {
            id: "ev-python-venv-missing",
            kind: "file_presence",
            description: "No active or local Python virtual environment detected",
            observed: "Python project detected, but VIRTUAL_ENV environment variable is not set and no local virtual environment directory (.venv, venv) exists in project root.",
            source: "environment",
            collectedAt: new Date().toISOString()
          }
        ],
        possibleCauses: [
          "A Python virtual environment has not yet been created for this project.",
          "A virtual environment exists elsewhere on the machine but has not been activated in this shell session."
        ],
        recommendations: [
          {
            problem: "No active Python virtual environment found.",
            relevance: "Isolates Python packages from the global system Python installation.",
            commandOrAction: "python -m venv .venv",
            expectedResult: "Creates an isolated virtual environment directory at .venv.",
            risks: "Creates a local .venv folder; suggestion only.",
            undo: "rm -rf .venv",
            verification: "test -d .venv"
          }
        ],
        verificationStatus: "unverified",
        docs: ["https://docs.python.org/3/library/venv.html"]
      };
    }

    return null;
  }
};
