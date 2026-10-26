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

  const fixtureNames = [
    "broken-node-project",
    "broken-django-project",
    "broken-database-config",
    "healthy-node-project"
  ];

  let totalExpected = 0;
  let totalDetected = 0;
  let totalCorrect = 0;
  let totalMissed = 0;
  let totalFalsePos = 0;

  console.log(
    `${"Fixture".padEnd(26)} ${"Expected".padStart(8)} ${"Detected".padStart(8)} ${"Correct".padStart(8)} ${"Missed".padStart(8)} ${"False Pos".padStart(10)}`
  );
  console.log("-".repeat(72));

  for (const name of fixtureNames) {
    const fixturePath = path.join(fixturesDir, name);
    const expectedPath = path.join(fixturePath, "expected.json");

    if (!fs.existsSync(expectedPath)) {
      continue;
    }

    const expectedRuleIds = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));
    const expectedSet = new Set(expectedRuleIds);

    // If broken-node-project, open port 3000 listener to test port conflict
    let server;
    if (name === "broken-node-project") {
      server = net.createServer();
      await new Promise((resolve) => server.listen(3000, "127.0.0.1", () => resolve()));
    }

    let jsonOutput = "";
    const originalLog = console.log;
    console.log = (msg) => {
      jsonOutput += (msg ?? "") + "\n";
    };

    try {
      await runCli(["scan", fixturePath, "--json"]);
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

    const detectedSet = new Set(detectedRuleIds);

    let correct = 0;
    let missed = 0;
    let falsePos = 0;

    for (const id of expectedSet) {
      if (detectedSet.has(id)) {
        correct++;
      } else {
        missed++;
      }
    }

    for (const id of detectedSet) {
      if (!expectedSet.has(id)) {
        falsePos++;
      }
    }

    totalExpected += expectedRuleIds.length;
    totalDetected += detectedRuleIds.length;
    totalCorrect += correct;
    totalMissed += missed;
    totalFalsePos += falsePos;

    console.log(
      `${name.padEnd(26)} ${String(expectedRuleIds.length).padStart(8)} ${String(detectedRuleIds.length).padStart(8)} ${String(correct).padStart(8)} ${String(missed).padStart(8)} ${String(falsePos).padStart(10)}`
    );
  }

  console.log("-".repeat(72));
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

  const passed = accuracy >= 80 && falsePositiveRate < 10;
  console.log(`Status               : ${passed ? "PASSED" : "FAILED"}`);
  console.log("======================================================");

  process.exit(passed ? 0 : 1);
}

runEval().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
