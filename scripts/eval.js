#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { runCli } from "../apps/cli/dist/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, "../examples");

async function runEval() {
  console.log("======================================================");
  console.log("           StackDoctor Diagnostic Accuracy Eval");
  console.log("======================================================");

  const baselineFixtures = [
    { name: "broken-node-project", path: path.join(fixturesDir, "broken-node-project") },
    { name: "broken-django-project", path: path.join(fixturesDir, "broken-django-project") },
    { name: "broken-database-config", path: path.join(fixturesDir, "broken-database-config") },
    { name: "healthy-node-project", path: path.join(fixturesDir, "healthy-node-project") }
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
          regressionFixtures.push({ name: `reg/${entry.name}`, path: fullPath });
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

  function getRuleStat(id) {
    if (!ruleStats[id]) {
      ruleStats[id] = { expected: 0, detected: 0, tp: 0, fp: 0, fn: 0 };
    }
    return ruleStats[id];
  }

  console.log(
    `${"Fixture".padEnd(30)} ${"Expected".padStart(8)} ${"Detected".padStart(8)} ${"Correct".padStart(8)} ${"Missed".padStart(8)} ${"False Pos".padStart(10)}`
  );
  console.log("-".repeat(76));

  for (const item of allFixtures) {
    const expectedPath = path.join(item.path, "expected.json");
    if (!fs.existsSync(expectedPath)) {
      continue;
    }

    let expectedRuleIds = [];
    try {
      const raw = fs.readFileSync(expectedPath, "utf-8");
      // Strip possible comments
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

    console.log(
      `${item.name.padEnd(30)} ${String(expectedRuleIds.length).padStart(8)} ${String(detectedRuleIds.length).padStart(8)} ${String(correct).padStart(8)} ${String(missed).padStart(8)} ${String(falsePos).padStart(10)}`
    );
  }

  console.log("-".repeat(76));
  console.log(`Total Expected  : ${totalExpected}`);
  console.log(`Total Detected  : ${totalDetected}`);
  console.log(`Correct (TP)    : ${totalCorrect}`);
  console.log(`Missed (FN)     : ${totalMissed}`);
  console.log(`False Pos (FP)  : ${totalFalsePos}`);
  console.log("");

  const accuracy = totalExpected > 0 ? (totalCorrect / totalExpected) * 100 : 100;
  const falsePositiveRate = totalDetected > 0 ? (totalFalsePos / totalDetected) * 100 : 0;

  console.log(`Detection Accuracy   : ${accuracy.toFixed(1)}% (Target: >= 80%)`);
  console.log(`False Positive Rate  : ${falsePositiveRate.toFixed(1)}% (Target: < 10%)`);

  // Optional: print per-rule breakdown if rules were evaluated
  const ruleEntries = Object.entries(ruleStats).sort((a, b) => a[0].localeCompare(b[0]));
  if (ruleEntries.length > 0) {
    console.log("\n--- Per-Rule Accuracy & Detection Stats ---");
    console.log(`${"Rule ID".padEnd(36)} ${"Exp".padStart(4)} ${"Det".padStart(4)} ${"TP".padStart(4)} ${"FP".padStart(4)} ${"FN".padStart(4)}`);
    for (const [id, s] of ruleEntries) {
      console.log(`${id.padEnd(36)} ${String(s.expected).padStart(4)} ${String(s.detected).padStart(4)} ${String(s.tp).padStart(4)} ${String(s.fp).padStart(4)} ${String(s.fn).padStart(4)}`);
    }
  }

  const passed = accuracy >= 80 && falsePositiveRate < 10;
  console.log(`\nStatus               : ${passed ? "PASSED" : "FAILED"}`);
  console.log("======================================================");

  process.exit(passed ? 0 : 1);
}

runEval().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
