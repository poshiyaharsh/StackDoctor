import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const djangoMigrationsPendingRule: Rule = {
  id: "DJANGO_MIGRATIONS_PENDING",
  title: "Unapplied database schema changes detected",
  category: "database",
  description: "Django project has unapplied schema changes that have not yet been applied to the database.",
  technologies: ["Django"],
  severity: "medium",
  confidence: "confirmed",
  requiredEvidence: ["command_output"],
  recommendedChecks: [
    "Run python manage.py showmigrations --plan (requires --allow-project-code)",
    "Inspect database schema state"
  ],
  remediation: [
    {
      problem: "Database schema is out of sync with application model definitions.",
      relevance: "Missing database columns or tables cause database query exceptions at runtime.",
      commandOrAction: "Apply pending schema changes using Django management tooling.",
      expectedResult: "Database schema is synchronized with application model definitions.",
      risks: "Modifies database schema; create a database backup prior to applying changes.",
      verification: "stackdoctor scan --allow-project-code"
    }
  ],
  verification: "Confirm showmigrations --plan reports no unapplied changes.",
  docs: ["https://docs.djangoproject.com/en/stable/topics/migrations/"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return ctx.django?.migrations?.status === "pending";
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    const migrations = ctx.django?.migrations;
    if (!migrations || migrations.status !== "pending") {
      return null;
    }

    const count = migrations.pendingCount || migrations.unappliedList?.length || 1;
    const names = migrations.unappliedList?.join(", ") || "unapplied changes";

    return {
      ruleId: "DJANGO_MIGRATIONS_PENDING",
      title: `${count} unapplied database schema change(s) pending`,
      category: "database",
      severity: "medium",
      confidence: "confirmed",
      status: "warning",
      evidence: [
        {
          id: "ev-django-pending-migrations",
          kind: "command_output",
          description: "Django showmigrations plan output",
          observed: `showmigrations reported ${count} unapplied change(s): ${names}.`,
          source: "python manage.py showmigrations --plan",
          collectedAt: new Date().toISOString()
        }
      ],
      possibleCauses: [
        "New schema definitions were created or pulled from version control without updating the local database.",
        "A fresh database was initialized but pending schema operations were not applied."
      ],
      recommendations: [
        {
          problem: "Database tables or columns are missing for current models.",
          relevance: "Application queries will fail against an outdated database schema.",
          commandOrAction: "Apply pending schema operations to synchronize your database.",
          expectedResult: "All schema definitions are applied to the target database.",
          risks: "Alters database schema.",
          verification: "stackdoctor scan --allow-project-code"
        }
      ],
      verificationStatus: "unverified",
      docs: ["https://docs.djangoproject.com/en/stable/topics/migrations/"]
    };
  }
};
