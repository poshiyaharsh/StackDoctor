#!/usr/bin/env node
/**
 * scripts/scorecard.js
 *
 * Reads FEEDBACK.md and calculates data-driven scorecards:
 * - Total feedback entries
 * - Distribution by Category
 * - Distribution by Severity
 * - Distribution by Status
 * - Top diagnostic rules referenced
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const feedbackPath = path.join(rootDir, "FEEDBACK.md");

/**
 * Parses markdown table content from FEEDBACK.md into structured records
 */
export function parseFeedbackTable(content) {
  const lines = content.split("\n");
  const entries = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      if (inTable && trimmed === "") inTable = false;
      continue;
    }

    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    if (cells.length < 10) continue;

    const id = cells[0].replace(/`/g, "").trim();
    if (id.toLowerCase() === "id" || id.startsWith("---")) {
      inTable = true;
      continue;
    }

    if (inTable && id.startsWith("FB-")) {
      const relatedRules = cells[8]
        .split(",")
        .map((r) => r.replace(/`/g, "").trim())
        .filter((r) => r && r !== "-");

      entries.push({
        id,
        date: cells[1],
        source: cells[2],
        environment: cells[3],
        whatHappened: cells[4],
        expected: cells[5],
        version: cells[6],
        category: cells[7].replace(/`/g, "").trim(),
        relatedRules,
        severity: cells[9].replace(/`/g, "").trim(),
        status: cells[10].replace(/`/g, "").trim(),
        linkedIssue: cells[11],
        fixedInVersion: cells[12]
      });
    }
  }

  return entries;
}

export function computeScorecard(entries) {
  const byCategory = {};
  const bySeverity = {};
  const byStatus = {};
  const byRule = {};

  for (const entry of entries) {
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;
    byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;

    for (const rule of entry.relatedRules) {
      if (rule && rule !== "-") {
        byRule[rule] = (byRule[rule] || 0) + 1;
      }
    }
  }

  return {
    total: entries.length,
    byCategory,
    bySeverity,
    byStatus,
    byRule
  };
}

export function formatScorecard(scorecard) {
  let output = "\n======================================================\n";
  output += "           StackDoctor User Feedback Scorecard        \n";
  output += "======================================================\n\n";

  output += `Total Feedback Entries Logged: ${scorecard.total}\n\n`;

  output += "--- Breakdown by Category ---\n";
  for (const [cat, count] of Object.entries(scorecard.byCategory)) {
    const pct = ((count / scorecard.total) * 100).toFixed(1);
    output += `  • ${cat.padEnd(20)} : ${String(count).padStart(3)} (${pct}%)\n`;
  }

  output += "\n--- Breakdown by Severity ---\n";
  for (const [sev, count] of Object.entries(scorecard.bySeverity)) {
    const pct = ((count / scorecard.total) * 100).toFixed(1);
    output += `  • ${sev.padEnd(20)} : ${String(count).padStart(3)} (${pct}%)\n`;
  }

  output += "\n--- Breakdown by Status ---\n";
  for (const [stat, count] of Object.entries(scorecard.byStatus)) {
    const pct = ((count / scorecard.total) * 100).toFixed(1);
    output += `  • ${stat.padEnd(20)} : ${String(count).padStart(3)} (${pct}%)\n`;
  }

  output += "\n--- Top Rules Involved ---\n";
  const sortedRules = Object.entries(scorecard.byRule).sort((a, b) => b[1] - a[1]);
  if (sortedRules.length === 0) {
    output += "  None recorded.\n";
  } else {
    for (const [rule, count] of sortedRules) {
      output += `  • ${rule.padEnd(32)} : ${count} report(s)\n`;
    }
  }

  output += "\n======================================================\n";
  return output;
}

function runCli() {
  if (!fs.existsSync(feedbackPath)) {
    console.error(`[ERROR] FEEDBACK.md not found at ${feedbackPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(feedbackPath, "utf-8");
  const entries = parseFeedbackTable(content);
  const scorecard = computeScorecard(entries);
  console.log(formatScorecard(scorecard));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
