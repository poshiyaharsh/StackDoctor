#!/usr/bin/env node
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("======================================================");
console.log("       StackDoctor Phase 3 End-to-End Verification    ");
console.log("======================================================");

async function runE2E() {
  let mongoServer;
  let server;

  try {
    // 1. Start In-Memory MongoDB Server
    console.log("[1/6] Starting in-memory MongoDB database...");
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    const { connectDatabase, disconnectDatabase } = await import("../apps/api/dist/lib/db.js");
    await connectDatabase({ uri });
    console.log("      ✓ MongoDB connected");

    // Dynamically import API components after mongo connection
    const { buildApp } = await import("../apps/api/dist/app.js");
    const testConfig = {
      NODE_ENV: "test",
      PORT: 3088,
      MONGODB_URI: uri,
      SESSION_SECRET: "e2e_phase3_super_secret_session_key_32chars",
      CORS_ORIGIN: "http://localhost:5173",
      COOKIE_SECURE: false
    };

    const app = buildApp(testConfig);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(3088, "127.0.0.1", resolve));
    console.log("      ✓ API server listening on http://127.0.0.1:3088");

    // 2. Register User
    console.log("[2/6] Registering test user account...");
    const regRes = await fetch("http://127.0.0.1:3088/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "e2e-tester@example.com",
        password: "SuperSecureE2EPassword123!",
        displayName: "E2E Auditor"
      })
    });

    if (!regRes.ok) throw new Error(`Registration failed: ${regRes.status}`);
    const regData = await regRes.json();
    const csrfToken = regData.csrfToken;
    const cookieHeader = regRes.headers.get("set-cookie");
    console.log(`      ✓ User registered: ${regData.user.email} (ID: ${regData.user.id})`);

    // 3. Create API Token
    console.log("[3/6] Generating CLI API Token...");
    const tokenRes = await fetch("http://127.0.0.1:3088/api/v1/tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
        "Cookie": cookieHeader
      },
      body: JSON.stringify({ name: "E2E Automated Script" })
    });

    if (!tokenRes.ok) throw new Error(`Token generation failed: ${tokenRes.status}`);
    const tokenData = await tokenRes.json();
    const apiToken = tokenData.token;
    console.log(`      ✓ API Token generated: ${tokenData.tokenInfo?.prefix || apiToken.slice(0, 12)}...`);

    // 4. Scan Fixture Locally (100% Offline)
    console.log("[4/6] Running offline diagnostic scan on fixture...");
    const fixtureDir = path.join(rootDir, "examples", "broken-node-project");
    const { runCli } = await import("../apps/cli/dist/index.js");

    let stdoutData = "";
    const originalLog = console.log;
    console.log = (...args) => {
      stdoutData += args.join(" ") + "\n";
    };

    try {
      await runCli(["scan", fixtureDir, "--json"]);
    } finally {
      console.log = originalLog;
    }

    const report = JSON.parse(stdoutData.trim());
    if (!report || !report.findings || report.findings.length === 0) {
      throw new Error("Scan produced no findings on broken fixture!");
    }
    console.log(`      ✓ Local scan completed: ${report.findings.length} findings detected`);

    // 5. Upload Report with Bearer Token
    console.log("[5/6] Uploading report to API via Bearer token...");
    const { uploadReport } = await import("../apps/cli/dist/uploader.js");
    const uploadResult = await uploadReport(report, {
      serverUrl: "http://127.0.0.1:3088",
      token: apiToken
    });
    if (!uploadResult || !uploadResult.runId) {
      throw new Error("Upload did not return runId");
    }
    const runId = uploadResult.runId;
    console.log(`      ✓ Upload successful. Created DiagnosticRun ID: ${runId}`);

    // 6. Verify Fetch & Delete
    console.log("[6/6] Verifying remote fetch and cascade deletion...");
    const fetchRes = await fetch(`http://127.0.0.1:3088/api/v1/diagnostic-runs/${runId}`, {
      headers: { "Authorization": `Bearer ${apiToken}` }
    });
    if (!fetchRes.ok) throw new Error(`Fetch failed: ${fetchRes.status}`);
    const fetchedData = await fetchRes.json();
    const fetchedRun = fetchedData.diagnosticRun || fetchedData.run;
    if (!fetchedRun || fetchedRun.id !== runId) throw new Error("Fetched run ID mismatch");
    console.log(`      ✓ Verified remote run fetch: status=${fetchedRun.status}, findings=${fetchedRun.findings.length}`);

    // Delete run
    const delRes = await fetch(`http://127.0.0.1:3088/api/v1/diagnostic-runs/${runId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${apiToken}` }
    });
    if (!delRes.ok) throw new Error(`Delete failed: ${delRes.status}`);
    console.log("      ✓ Successfully deleted diagnostic run");

    // Confirm 404 after deletion
    const verifyDelRes = await fetch(`http://127.0.0.1:3088/api/v1/diagnostic-runs/${runId}`, {
      headers: { "Authorization": `Bearer ${apiToken}` }
    });
    if (verifyDelRes.status !== 404) throw new Error(`Expected 404 after deletion, got ${verifyDelRes.status}`);
    console.log("      ✓ Verified 404 Not Found after deletion");

    console.log("======================================================");
    console.log("  PHASE 3 END-TO-END VERIFICATION: PASSED (100% OK)   ");
    console.log("======================================================");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Phase 3 E2E Verification FAILED:");
    console.error(err);
    process.exit(1);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      const { disconnectDatabase } = await import("../apps/api/dist/lib/db.js");
      await disconnectDatabase();
    } catch {
      // Ignore
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

runE2E();
