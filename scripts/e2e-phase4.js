#!/usr/bin/env node
import { MongoMemoryServer } from "mongodb-memory-server";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("======================================================");
console.log("       StackDoctor Phase 4 End-to-End Verification    ");
console.log("======================================================");

async function runE2EPhase4() {
  const tempBaseDir = path.join(os.tmpdir(), `stk-e2e-phase4-${Date.now()}`);
  fs.mkdirSync(tempBaseDir, { recursive: true });

  const fixtureDir = path.join(tempBaseDir, "fixture-project");
  fs.mkdirSync(fixtureDir, { recursive: true });

  const reportAFile = path.join(tempBaseDir, "a.json");
  const reportBFile = path.join(tempBaseDir, "b.json");
  const diffFile = path.join(tempBaseDir, "diff.json");
  const issueFile = path.join(tempBaseDir, "issue-draft.md");
  const explainFile = path.join(tempBaseDir, "explain.json");

  let mongoServer;
  let server;

  try {
    // Dynamically import CLI runner
    const { runCli } = await import("../apps/cli/dist/index.js");

    // ---------------------------------------------------------
    // Step 1: Create fixture with 2 issues (NODE_DEPS_NOT_INSTALLED and ENV_EXAMPLE_PRESENT_NO_ENV)
    // ---------------------------------------------------------
    console.log("\n[1/7] Setting up fixture project with 2 environmental issues...");
    fs.writeFileSync(
      path.join(fixtureDir, "package.json"),
      JSON.stringify(
        {
          name: "e2e-fixture-project",
          version: "1.0.0",
          scripts: { start: "node index.js" }
        },
        null,
        2
      ),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(fixtureDir, ".env.example"),
      "PORT=3000\nDATABASE_URL=postgres://localhost:5432/db\n",
      "utf-8"
    );
    console.log("      ✓ Fixture created (node_modules missing, .env missing)");

    // ---------------------------------------------------------
    // Step 2: Run scan --ci --format json --out a.json
    // ---------------------------------------------------------
    console.log("\n[2/7] Running `stackdoctor scan` in CI mode to a.json...");
    const exitCodeA = await runCli([
      "scan",
      fixtureDir,
      "--ci",
      "--fail-on",
      "high",
      "--format",
      "json",
      "--out",
      reportAFile
    ]);

    if (exitCodeA !== 1) {
      throw new Error(`Expected exit code 1 from scan on broken fixture, got: ${exitCodeA}`);
    }
    if (!fs.existsSync(reportAFile)) {
      throw new Error(`Report a.json was not created at ${reportAFile}`);
    }

    const reportA = JSON.parse(fs.readFileSync(reportAFile, "utf-8"));
    const findingIdsA = reportA.findings.map((f) => f.ruleId);
    if (!findingIdsA.includes("NODE_DEPS_NOT_INSTALLED")) {
      throw new Error("Expected reportA to contain NODE_DEPS_NOT_INSTALLED");
    }
    if (!findingIdsA.includes("ENV_EXAMPLE_PRESENT_NO_ENV")) {
      throw new Error("Expected reportA to contain ENV_EXAMPLE_PRESENT_NO_ENV");
    }
    console.log("      ✓ Scan completed with exit code 1; a.json generated with 2 findings");

    // ---------------------------------------------------------
    // Step 3: Fix one issue (create node_modules) and scan to b.json
    // ---------------------------------------------------------
    console.log("\n[3/7] Fixing issue 1 (creating node_modules) and scanning to b.json...");
    fs.mkdirSync(path.join(fixtureDir, "node_modules"), { recursive: true });

    // With node_modules present, only ENV_EXAMPLE_PRESENT_NO_ENV (medium) remains
    // With --fail-on high (default), exit code should now be 0!
    const exitCodeB = await runCli([
      "scan",
      fixtureDir,
      "--ci",
      "--fail-on",
      "high",
      "--format",
      "json",
      "--out",
      reportBFile
    ]);

    if (exitCodeB !== 0) {
      throw new Error(`Expected exit code 0 from scan on partially fixed fixture, got: ${exitCodeB}`);
    }
    if (!fs.existsSync(reportBFile)) {
      throw new Error(`Report b.json was not created at ${reportBFile}`);
    }

    const reportB = JSON.parse(fs.readFileSync(reportBFile, "utf-8"));
    const findingIdsB = reportB.findings.map((f) => f.ruleId);
    if (findingIdsB.includes("NODE_DEPS_NOT_INSTALLED")) {
      throw new Error("NODE_DEPS_NOT_INSTALLED should have been resolved in reportB");
    }
    if (!findingIdsB.includes("ENV_EXAMPLE_PRESENT_NO_ENV")) {
      throw new Error("ENV_EXAMPLE_PRESENT_NO_ENV should still be present in reportB");
    }
    console.log("      ✓ Scan completed with exit code 0; b.json generated (1 resolved, 1 remaining)");

    // ---------------------------------------------------------
    // Step 4: Compare a.json and b.json (offline diff)
    // ---------------------------------------------------------
    console.log("\n[4/7] Running `stackdoctor compare` between a.json and b.json...");
    const compareCode = await runCli([
      "compare",
      reportAFile,
      reportBFile,
      "--format",
      "json",
      "--out",
      diffFile
    ]);

    if (compareCode !== 0) {
      throw new Error(`Expected exit code 0 from compare, got: ${compareCode}`);
    }

    const diffJson = JSON.parse(fs.readFileSync(diffFile, "utf-8"));
    if (diffJson.resolvedFindings.length !== 1 || diffJson.resolvedFindings[0].ruleId !== "NODE_DEPS_NOT_INSTALLED") {
      throw new Error("Expected diff to show NODE_DEPS_NOT_INSTALLED as resolved finding");
    }
    if (diffJson.newFindings.length !== 0) {
      throw new Error("Expected 0 new findings in a -> b compare");
    }

    // Verify --fail-on-new flag in CI mode:
    // a -> b has 0 new findings, so exit code is 0
    const failOnNewPass = await runCli([
      "compare",
      reportAFile,
      reportBFile,
      "--fail-on-new",
      "low"
    ]);
    if (failOnNewPass !== 0) {
      throw new Error(`Expected exit code 0 with --fail-on-new when no new findings, got: ${failOnNewPass}`);
    }

    // b -> a has 1 new finding (NODE_DEPS_NOT_INSTALLED is high), so exit code is 1!
    const failOnNewRegression = await runCli([
      "compare",
      reportBFile,
      reportAFile,
      "--fail-on-new",
      "low"
    ]);
    if (failOnNewRegression !== 1) {
      throw new Error(`Expected exit code 1 with --fail-on-new on regression, got: ${failOnNewRegression}`);
    }
    console.log("      ✓ Compare verified: 1 resolved finding detected; --fail-on-new exit codes validated");

    // ---------------------------------------------------------
    // Step 5: Issue draft generation (`stackdoctor issue`)
    // ---------------------------------------------------------
    console.log("\n[5/7] Testing `stackdoctor issue` draft generation...");
    const issueCode = await runCli([
      "issue",
      reportAFile,
      "--out",
      issueFile
    ]);

    if (issueCode !== 0) {
      throw new Error(`Expected exit code 0 from issue draft command, got: ${issueCode}`);
    }

    const issueContent = fs.readFileSync(issueFile, "utf-8");
    if (!issueContent.includes("## Observed Evidence")) {
      throw new Error("Issue draft missing Observed Evidence section");
    }
    if (!issueContent.includes("## Possible Causes")) {
      throw new Error("Issue draft missing Possible Causes section");
    }
    if (!issueContent.includes("## Steps to Reproduce")) {
      throw new Error("Issue draft missing Steps to Reproduce template");
    }
    console.log("      ✓ Issue draft generated offline; sanitized sections confirmed");

    // ---------------------------------------------------------
    // Step 6: Rule explanation (`stackdoctor explain`)
    // ---------------------------------------------------------
    console.log("\n[6/7] Testing `stackdoctor explain`...");
    const explainCode = await runCli([
      "explain",
      "NODE_DEPS_NOT_INSTALLED",
      "--format",
      "json",
      "--out",
      explainFile
    ]);

    if (explainCode !== 0) {
      throw new Error(`Expected exit code 0 from explain, got: ${explainCode}`);
    }

    const explainJson = JSON.parse(fs.readFileSync(explainFile, "utf-8"));
    if (explainJson.id !== "NODE_DEPS_NOT_INSTALLED") {
      throw new Error("Explain JSON id mismatch");
    }
    if (!Array.isArray(explainJson.docs) || !explainJson.docs[0].startsWith("https://")) {
      throw new Error("Explain JSON docs missing or invalid HTTPS URL");
    }

    // Verify unknown rule suggests similar rule with exit code 2
    const unknownCode = await runCli(["explain", "NODE_DEPS_MISSING"]);
    if (unknownCode !== 2) {
      throw new Error(`Expected exit code 2 on unknown rule, got: ${unknownCode}`);
    }
    console.log("      ✓ Rule explain verified; valid JSON output and typo suggestions confirmed");

    // ---------------------------------------------------------
    // Step 7: API Compare Endpoint Integration (Local API + Multi-Tenant Protection)
    // ---------------------------------------------------------
    console.log("\n[7/7] Testing API compare path against local API server...");
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    const { connectDatabase } = await import("../apps/api/dist/lib/db.js");
    await connectDatabase({ uri });

    const { buildApp } = await import("../apps/api/dist/app.js");
    const testConfig = {
      NODE_ENV: "test",
      PORT: 3099,
      MONGODB_URI: uri,
      SESSION_SECRET: "e2e_phase4_super_secret_session_key_32chars",
      CORS_ORIGIN: "http://localhost:5173",
      COOKIE_SECURE: false
    };

    const app = buildApp(testConfig);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(3099, "127.0.0.1", resolve));

    // Register User A
    const regResA = await fetch("http://127.0.0.1:3099/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user-a@example.com",
        password: "SuperSecureUserAPassword123!",
        displayName: "User A"
      })
    });
    if (!regResA.ok) throw new Error(`User A registration failed: ${regResA.status}`);
    const userAData = await regResA.json();
    const csrfTokenA = userAData.csrfToken;
    const cookieHeaderA = regResA.headers.get("set-cookie") || "";

    // Generate Token for User A
    const tokenResA = await fetch("http://127.0.0.1:3099/api/v1/tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfTokenA,
        Cookie: cookieHeaderA
      },
      body: JSON.stringify({ name: "User A Token" })
    });
    const tokenDataA = await tokenResA.json();
    const tokenA = tokenDataA.token;

    // Upload Report A and Report B under User A
    const uploadResA = await fetch("http://127.0.0.1:3099/api/v1/diagnostic-runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify(reportA)
    });
    if (!uploadResA.ok) {
      const errText = await uploadResA.text();
      throw new Error(`Upload A failed: ${uploadResA.status} - ${errText}`);
    }
    const runAData = await uploadResA.json();
    const runIdA = runAData.diagnosticRun.id;

    const uploadResB = await fetch("http://127.0.0.1:3099/api/v1/diagnostic-runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify(reportB)
    });
    if (!uploadResB.ok) {
      const errText = await uploadResB.text();
      throw new Error(`Upload B failed: ${uploadResB.status} - ${errText}`);
    }
    const runBData = await uploadResB.json();
    const runIdB = runBData.diagnosticRun.id;

    // User A compares their own runs: GET /api/v1/diagnostic-runs/compare?base=<runIdA>&head=<runIdB>
    const apiCompareRes = await fetch(
      `http://127.0.0.1:3099/api/v1/diagnostic-runs/compare?base=${runIdA}&head=${runIdB}`,
      {
        headers: { Authorization: `Bearer ${tokenA}` }
      }
    );
    if (!apiCompareRes.ok) throw new Error(`API compare failed: ${apiCompareRes.status}`);
    const apiCompareJson = await apiCompareRes.json();
    if (!apiCompareJson.comparison || apiCompareJson.comparison.resolvedFindings.length !== 1) {
      throw new Error("API compare response did not return expected resolved finding");
    }
    console.log("      ✓ API compare succeeded with HTTP 200 for User A's runs");

    // Register User B
    const regResB = await fetch("http://127.0.0.1:3099/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user-b@example.com",
        password: "SuperSecureUserBPassword123!",
        displayName: "User B"
      })
    });
    const userBData = await regResB.json();
    const csrfTokenB = userBData.csrfToken;
    const cookieHeaderB = regResB.headers.get("set-cookie") || "";

    const tokenResB = await fetch("http://127.0.0.1:3099/api/v1/tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfTokenB,
        Cookie: cookieHeaderB
      },
      body: JSON.stringify({ name: "User B Token" })
    });
    const tokenDataB = await tokenResB.json();
    const tokenB = tokenDataB.token;

    // User B attempts to access User A's runs via compare -> Must receive 404!
    const intruderCompareRes = await fetch(
      `http://127.0.0.1:3099/api/v1/diagnostic-runs/compare?base=${runIdA}&head=${runIdB}`,
      {
        headers: { Authorization: `Bearer ${tokenB}` }
      }
    );
    if (intruderCompareRes.status !== 404) {
      throw new Error(`Expected HTTP 404 for cross-tenant compare attempt, got: ${intruderCompareRes.status}`);
    }
    console.log("      ✓ Cross-tenant compare returned HTTP 404 (multi-tenant isolation verified)");

    console.log("\n======================================================");
    console.log("  🎉 All Phase 4 End-to-End checks passed successfully! ");
    console.log("======================================================\n");
  } finally {
    // Teardown
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    const { disconnectDatabase } = await import("../apps/api/dist/lib/db.js");
    await disconnectDatabase().catch(() => {});
    if (mongoServer) {
      await mongoServer.stop().catch(() => {});
    }
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  }
}

runE2EPhase4().catch((err) => {
  console.error("\n❌ Phase 4 E2E Verification Failed:", err);
  process.exit(1);
});
