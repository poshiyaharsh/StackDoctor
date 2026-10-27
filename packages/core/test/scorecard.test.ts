import { describe, it, expect } from "vitest";
// @ts-expect-error importing JavaScript script module for testing
import { parseFeedbackTable, computeScorecard, formatScorecard } from "../../../scripts/scorecard.js";

describe("Feedback Scorecard Parser", () => {
  const sampleMarkdown = `
# Feedback Log

| ID | Date | Source | Environment | What Happened | Expected | Version | Category | Related Rules | Severity | Status | Linked Issue/PR | Fixed in Version |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| \`FB-101\` | 2026-10-27 | Issue #10 | Linux / Node 20 | Crash on startup | Clean report | 0.1.0 | \`crash\` | \`PORT_IN_USE\` | blocker | \`new\` | #10 | - |
| \`FB-102\` | 2026-10-27 | Discord | Windows / Node 22 | False alarm on env | No finding | 0.1.0 | \`false_positive\` | \`ENV_VAR_NAMES_MISSING\`, \`PORT_IN_USE\` | high | \`triaged\` | #12 | - |
| \`FB-103\` | 2026-10-27 | Discussion | macOS / Django | Support Postgres | New rule | 0.1.0 | \`feature_request\` | - | medium | \`triaged\` | #15 | - |
`;

  it("correctly parses markdown table rows into structured objects", () => {
    const entries = parseFeedbackTable(sampleMarkdown);
    expect(entries).toHaveLength(3);

    expect(entries[0].id).toBe("FB-101");
    expect(entries[0].category).toBe("crash");
    expect(entries[0].severity).toBe("blocker");
    expect(entries[0].status).toBe("new");
    expect(entries[0].relatedRules).toEqual(["PORT_IN_USE"]);

    expect(entries[1].id).toBe("FB-102");
    expect(entries[1].category).toBe("false_positive");
    expect(entries[1].relatedRules).toEqual(["ENV_VAR_NAMES_MISSING", "PORT_IN_USE"]);

    expect(entries[2].id).toBe("FB-103");
    expect(entries[2].category).toBe("feature_request");
    expect(entries[2].relatedRules).toEqual([]);
  });

  it("computes accurate aggregates across categories, severities, and rules", () => {
    const entries = parseFeedbackTable(sampleMarkdown);
    const scorecard = computeScorecard(entries);

    expect(scorecard.total).toBe(3);
    expect(scorecard.byCategory.crash).toBe(1);
    expect(scorecard.byCategory.false_positive).toBe(1);
    expect(scorecard.byCategory.feature_request).toBe(1);

    expect(scorecard.bySeverity.blocker).toBe(1);
    expect(scorecard.bySeverity.high).toBe(1);
    expect(scorecard.bySeverity.medium).toBe(1);

    expect(scorecard.byStatus.new).toBe(1);
    expect(scorecard.byStatus.triaged).toBe(2);

    expect(scorecard.byRule.PORT_IN_USE).toBe(2);
    expect(scorecard.byRule.ENV_VAR_NAMES_MISSING).toBe(1);
  });

  it("formats scorecard output into readable terminal report", () => {
    const entries = parseFeedbackTable(sampleMarkdown);
    const scorecard = computeScorecard(entries);
    const output = formatScorecard(scorecard);

    expect(output).toContain("Total Feedback Entries Logged: 3");
    expect(output).toContain("crash");
    expect(output).toContain("blocker");
    expect(output).toContain("PORT_IN_USE");
  });
});
