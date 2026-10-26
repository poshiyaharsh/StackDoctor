import type { Rule } from "./types.js";

const REQUIRED_RULE_FIELDS: Array<keyof Rule> = [
  "id",
  "title",
  "description",
  "technologies",
  "severity",
  "confidence",
  "requiredEvidence",
  "recommendedChecks",
  "remediation",
  "verification",
  "docs",
  "preconditions",
  "evaluate"
];

export class RuleRegistry {
  private rules: Map<string, Rule> = new Map();

  /**
   * Registers a rule after validating required fields and uniqueness.
   */
  register(rule: Rule): void {
    if (!rule || typeof rule !== "object") {
      throw new Error("Invalid rule: rule must be a non-null object");
    }

    for (const field of REQUIRED_RULE_FIELDS) {
      if (rule[field] === undefined || rule[field] === null) {
        throw new Error(`Invalid rule "${rule.id ?? "unknown"}": missing required field "${field}"`);
      }
    }

    if (typeof rule.id !== "string" || rule.id.trim().length === 0) {
      throw new Error("Invalid rule: id must be a non-empty string");
    }

    if (this.rules.has(rule.id)) {
      throw new Error(`Duplicate rule ID: "${rule.id}" is already registered`);
    }

    this.rules.set(rule.id, rule);
  }

  /**
   * Retrieves a rule by its unique ID.
   */
  get(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  /**
   * Lists all currently registered rules.
   */
  list(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Returns all rules matching any of the specified technologies (or wildcard "*").
   */
  forTechnologies(techs: string[]): Rule[] {
    const techSet = new Set(techs.map((t) => t.toLowerCase()));
    return this.list().filter((rule) => {
      if (rule.technologies.length === 0 || rule.technologies.includes("*")) {
        return true;
      }
      return rule.technologies.some((tech) => techSet.has(tech.toLowerCase()));
    });
  }

  /**
   * Clears all registered rules (useful for test isolation).
   */
  clear(): void {
    this.rules.clear();
  }
}
