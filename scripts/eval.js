#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { runCli } from "../apps/cli/dist/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const fixturesDir = path.resolve(rootDir, "examples");
const evalResultsDir = path.resolve(rootDir, "eval-results");
const historyDocPath = path.resolve(rootDir, "docs", "eval-history.md");

async function runEval() {
  console.log("======================================================");
  console.log("     StackDoctor Diagnostic Accuracy & Precision Eval ");
  console.log("======================================================\n");

  const baselineFixtures = [
    { name: "broken-node-project", path: path.join(fixturesDir, "broken-node-project"), sourceId: "Phase 1 Baseline" },
    { name: "broken-django-project", path: path.join(fixturesDir, "broken-django-project"), sourceId: "Phase 2 Baseline" },
    { name: "broken-database-config", path: path.join(fixturesDir, "broken-database-config"), sourceId: "Phase 2 Baseline" },
    { name: "healthy-node-project", path: path.join(fixturesDir, "healthy-node-project"), sourceId: "Healthy Reference" }
  ];

  // Discover dynamic regression fixtures under examples/regressions/
  const regressionsDir = path.join(fixturesDir, "regressions");
  const regressionFixtures = [];
  if (fs.existsSync(regressionsDir)) {
    const entries = fs.readdirSync(regressionsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(regressionsDir, entry.name);
        if (fs.existsSync(path.join(fullPath, "expected.json"))) {
          let sourceId = entry.name;
          const metaPath = path.join(fullPath, "meta.json");
          if (fs.existsSync(metaPath)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
              sourceId = meta.sourceFeedbackId || meta.id || entry.name;
            } catch {
              // Ignore
            }
          }
          regressionFixtures.push({ name: `reg/${entry.name}`, path: fullPath, sourceId });
        }
      }
    }
  }

  const allFixtures = [...baselineFixtures, ...regressionFixtures];

  let totalExpected = 0;
  let totalDetected = 0;
  let totalCorrect = 0;
  let totalMissed = 0;
  let totalFalsePos = 0;

  const ruleStats = {};
  const fixtureResults = [];

  function getRuleStat(id) {
    if (!ruleStats[id]) {
      ruleStats[id] = { expected: 0, detected: 0, tp: 0, fp: 0, fn: 0 };
    }
    return ruleStats[id];
  }

  console.log(
    `${"Fixture".padEnd(36)} ${"Source".padEnd(18)} ${"Exp".padStart(5)} ${"Det".padStart(5)} ${"TP".padStart(5)} ${"FN".padStart(5)} ${"FP".padStart(5)}`
  );
  console.log("-".repeat(84));

  for (const item of allFixtures) {
    const expectedPath = path.join(item.path, "expected.json");
    if (!fs.existsSync(expectedPath)) {
      continue;
    }

    let expectedRuleIds = [];
    try {
      const raw = fs.readFileSync(expectedPath, "utf-8");
      const cleaned = raw.replace(/\/\/.*$/gm, "").trim();
      expectedRuleIds = cleaned ? JSON.parse(cleaned) : [];
    } catch {
      expectedRuleIds = [];
    }
    const expectedSet = new Set(expectedRuleIds);

    for (const id of expectedRuleIds) {
      getRuleStat(id).expected++;
    }

    // If broken-node-project, open port 3000 listener to test port conflict
    let server;
    if (item.name === "broken-node-project") {
      server = net.createServer();
      await new Promise((resolve) => server.listen(3000, "127.0.0.1", () => resolve()));
    }

    let jsonOutput = "";
    const originalLog = console.log;
    console.log = (msg) => {
      jsonOutput += (msg ?? "") + "\n";
    };

    try {
      await runCli(["scan", item.path, "--json"]);
    } finally {
      console.log = originalLog;
      if (server) {
        await new Promise((resolve) => server.close(() => resolve()));
      }
    }

    let detectedRuleIds = [];
    try {
      const parsed = JSON.parse(jsonOutput.trim());
      detectedRuleIds = (parsed.findings || []).map((f) => f.ruleId);
    } catch {
      // JSON parse error
    }

    for (const id of detectedRuleIds) {
      getRuleStat(id).detected++;
    }

    const detectedSet = new Set(detectedRuleIds);

    let correct = 0;
    let missed = 0;
    let falsePos = 0;

    for (const id of expectedSet) {
      if (detectedSet.has(id)) {
        correct++;
        getRuleStat(id).tp++;
      } else {
        missed++;
        getRuleStat(id).fn++;
      }
    }

    for (const id of detectedSet) {
      if (!expectedSet.has(id)) {
        falsePos++;
        getRuleStat(id).fp++;
      }
    }

    totalExpected += expectedRuleIds.length;
    totalDetected += detectedRuleIds.length;
    totalCorrect += correct;
    totalMissed += missed;
    totalFalsePos += falsePos;

    const fixturePassed = missed === 0 && falsePos === 0;
    fixtureResults.push({
      name: item.name,
      sourceId: item.sourceId,
      expected: expectedRuleIds.length,
      detected: detectedRuleIds.length,
      tp: correct,
      fn: missed,
      fp: falsePos,
      passed: fixturePassed
    });

    console.log(
      `${item.name.padEnd(36)} ${item.sourceId.padEnd(18)} ${String(expectedRuleIds.length).padStart(5)} ${String(detectedRuleIds.length).padStart(5)} ${String(correct).padStart(5)} ${String(missed).padStart(5)} ${String(falsePos).padStart(5)}`
    );
  }

  console.log("-".repeat(84));
  console.log(`Total Expected Findings : ${totalExpected}`);
  console.log(`Total Detected Findings : ${totalDetected}`);
  console.log(`True Positives (TP)     : ${totalCorrect}`);
  console.log(`False Negatives (FN)    : ${totalMissed}`);
  console.log(`False Positives (FP)    : ${totalFalsePos}`);

  const accuracy = totalExpected > 0 ? (totalCorrect / totalExpected) * 100 : 100;
  const falsePositiveRate = totalDetected > 0 ? (totalFalsePos / totalDetected) * 100 : 0;
  const missRate = totalExpected > 0 ? (totalMissed / totalExpected) * 100 : 0;

  console.log("\n--- Aggregate Eval Performance ---");
  console.log(`Detection Accuracy (Recall) : ${accuracy.toFixed(1)}% (Target: >= 80.0%)`);
  console.log(`False Positive Rate         : ${falsePositiveRate.toFixed(1)}% (Target: < 10.0%)`);
  console.log(`Miss Rate                   : ${missRate.toFixed(1)}%`);

  // Per-Rule Precision & Recall Table
  const perRuleStats = {};
  const ruleEntries = Object.entries(ruleStats).sort((a, b) => a[0].localeCompare(b[0]));
  if (ruleEntries.length > 0) {
    console.log("\n--- Per-Rule Precision & Recall Table ---");
    console.log(
      `${"Rule ID".padEnd(36)} ${"Exp".padStart(4)} ${"Det".padStart(4)} ${"TP".padStart(4)} ${"FP".padStart(4)} ${"FN".padStart(4)} ${"Precision".padStart(11)} ${"Recall".padStart(10)}`
    );
    console.log("-".repeat(84));

    for (const [id, s] of ruleEntries) {
      const precision = s.tp + s.fp > 0 ? ((s.tp / (s.tp + s.fp)) * 100).toFixed(1) + "%" : "100.0%";
      const recall = s.tp + s.fn > 0 ? ((s.tp / (s.tp + s.fn)) * 100).toFixed(1) + "%" : "100.0%";

      perRuleStats[id] = {
        expected: s.expected,
        detected: s.detected,
        tp: s.tp,
        fp: s.fp,
        fn: s.fn,
        precision: parseFloat(precision),
        recall: parseFloat(recall)
      };

      console.log(
        `${id.padEnd(36)} ${String(s.expected).padStart(4)} ${String(s.detected).padStart(4)} ${String(s.tp).padStart(4)} ${String(s.fp).padStart(4)} ${String(s.fn).padStart(4)} ${precision.padStart(11)} ${recall.padStart(10)}`
      );
    }
  }

  // Ensure eval-results directory exists
  fs.mkdirSync(evalResultsDir, { recursive: true });

  const currentResultPayload = {
    timestamp: new Date().toISOString(),
    os: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    totalFixtures: allFixtures.length,
    metrics: {
      totalExpected,
      totalDetected,
      truePositives: totalCorrect,
      falseNegatives: totalMissed,
      falsePositives: totalFalsePos,
      accuracy: parseFloat(accuracy.toFixed(2)),
      falsePositiveRate: parseFloat(falsePositiveRate.toFixed(2)),
      missRate: parseFloat(missRate.toFixed(2))
    },
    perRule: perRuleStats,
    fixtures: fixtureResults
  };

  // 1. Write eval-results/latest.json
  const latestJsonPath = path.join(evalResultsDir, "latest.json");
  fs.writeFileSync(latestJsonPath, JSON.stringify(currentResultPayload, null, 2), "utf-8");
  console.log(`\n[INFO] Machine-readable summary saved to: eval-results/latest.json`);

  // 2. Check baseline regression
  const baselineJsonPath = path.join(evalResultsDir, "baseline.json");
  let baselineRegression = false;
  let regressionDetails = [];

  if (fs.existsSync(baselineJsonPath)) {
    try {
      const baseline = JSON.parse(fs.readFileSync(baselineJsonPath, "utf-8"));
      if (currentResultPayload.metrics.accuracy < baseline.metrics.accuracy) {
        baselineRegression = true;
        regressionDetails.push(
          `Accuracy dropped: ${currentResultPayload.metrics.accuracy}% vs baseline ${baseline.metrics.accuracy}%`
        );
      }
      if (currentResultPayload.metrics.falsePositiveRate > baseline.metrics.falsePositiveRate) {
        baselineRegression = true;
        regressionDetails.push(
          `False positive rate increased: ${currentResultPayload.metrics.falsePositiveRate}% vs baseline ${baseline.metrics.falsePositiveRate}%`
        );
      }
    } catch {
      // Ignore parse failure on baseline
    }
  } else {
    // Initialize baseline if not present
    fs.writeFileSync(baselineJsonPath, JSON.stringify(currentResultPayload, null, 2), "utf-8");
    console.log(`[INFO] Initialized baseline recorded in: eval-results/baseline.json`);
  }

  // 3. Record in docs/eval-history.md
  const dateStr = new Date().toISOString().slice(0, 10);
  const historyRow = `| ${dateStr} | \`${process.platform}\` | \`${process.version}\` | ${allFixtures.length} | ${accuracy.toFixed(1)}% | ${falsePositiveRate.toFixed(1)}% | ${missRate.toFixed(1)}% | ${accuracy >= 80 && falsePositiveRate < 10 ? "PASS" : "FAIL"} |\n`;

  if (!fs.existsSync(historyDocPath)) {
    const historyHeader = `# StackDoctor Evaluation Benchmark History

This document records historical diagnostic accuracy, false positive, and recall benchmarks produced by \`npm run eval\`.

| Date | Platform | Node Version | Fixtures Audited | Accuracy (Recall) | False Positive Rate | Miss Rate | Status |
|---|---|---|---|---|---|---|---|
`;
    fs.writeFileSync(historyDocPath, historyHeader + historyRow, "utf-8");
  } else {
    fs.appendFileSync(historyDocPath, historyRow, "utf-8");
  }
  console.log(`[INFO] Benchmark history updated in: docs/eval-history.md`);

  const passed = accuracy >= 80 && falsePositiveRate < 10 && !baselineRegression;

  if (baselineRegression) {
    console.error("\n[FAIL] Accuracy Regression Detected vs Baseline:");
    for (const detail of regressionDetails) {
      console.error(`  - ${detail}`);
    }
  }

  console.log(`\nEval Verification Status: ${passed ? "PASSED" : "FAILED"}`);
  console.log("======================================================");

  process.exit(passed ? 0 : 1);
}

runEval().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
