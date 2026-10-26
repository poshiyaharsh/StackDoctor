import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const djangoSettingsNotFoundRule: Rule = {
  id: "DJANGO_SETTINGS_NOT_FOUND",
  title: "Django settings module file not found",
  category: "configuration",
  description: "The DJANGO_SETTINGS_MODULE specified in manage.py does not correspond to an existing Python settings file.",
  technologies: ["Django"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Read DJANGO_SETTINGS_MODULE declaration in manage.py",
    "Verify target settings.py file exists at expected path"
  ],
  remediation: [
    {
      problem: "Django startup fails with ModuleNotFoundError when attempting to import settings.",
      relevance: "Django cannot boot without a valid settings module.",
      commandOrAction: "Create the missing settings file or correct the DJANGO_SETTINGS_MODULE path in manage.py.",
      expectedResult: "The settings file exists and can be imported by Django.",
      risks: "File creation or configuration change.",
      verification: "stackdoctor scan"
    }
  ],
  verification: "Verify settings file exists at specified path.",
  docs: ["https://docs.djangoproject.com/en/stable/topics/settings/"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return !!(
      ctx.django?.settings?.discovered &&
      !ctx.django.settings.fileExists
    );
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const settings = ctx.django?.settings;
    if (!settings || !settings.discovered || settings.fileExists) {
      return null;
    }

    const moduleName = settings.moduleName || "settings";
    const expectedPath = settings.expectedFilePath || "settings.py";

    return {
      ruleId: "DJANGO_SETTINGS_NOT_FOUND",
      title: `Django settings module "${moduleName}" not found on disk`,
      category: "configuration",
      severity: "high",
      confidence: "confirmed",
      status: "failed",
      evidence: [
        {
          id: "ev-django-settings-not-found",
          kind: "file_presence",
          description: "Django settings module presence check",
          observed: `manage.py specifies DJANGO_SETTINGS_MODULE="${moduleName}", but no corresponding file was found at "${expectedPath}".`,
          source: "manage.py",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        `The settings file was moved or renamed without updating manage.py.`,
        "The project directory structure differs from the default Django layout.",
        "DJANGO_SETTINGS_MODULE in manage.py has a typo in the module path."
      ],
      recommendations: [
        {
          problem: "Missing Django settings module.",
          relevance: "Django application cannot initialize without configuration.",
          commandOrAction: `Create "${expectedPath}" or update DJANGO_SETTINGS_MODULE in manage.py to point to your settings file.`,
          expectedResult: "Django settings file is located successfully.",
          risks: "Update configuration or create settings file.",
          verification: "stackdoctor scan"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://docs.djangoproject.com/en/stable/topics/settings/"]
    };
  }
};
