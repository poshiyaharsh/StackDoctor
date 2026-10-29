import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { buildApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/lib/db.js";
import { User } from "../src/models/user.js";
import { Project } from "../src/models/project.js";
import { DiagnosticRun } from "../src/models/diagnostic-run.js";
import { ApiToken, hashToken } from "../src/models/api-token.js";
import type { ApiConfig } from "../src/config.js";

describe("StackDoctor Security Hardening & Authorization Matrix (Run 3F)", () => {
  let mongoServer: MongoMemoryServer;
  let app: ReturnType<typeof buildApp>;

  const testConfig: ApiConfig = {
    NODE_ENV: "test",
    PORT: 3005,
    MONGODB_URI: "mongodb://127.0.0.1:27017/test_security_matrix",
    SESSION_SECRET: "secure_security_hardening_session_secret_32chars_long",
    CORS_ORIGIN: "http://localhost:5173",
    COOKIE_SECURE: false
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    testConfig.MONGODB_URI = uri;

    await connectDatabase({ uri });
    app = buildApp(testConfig);
  });

  afterAll(async () => {
    await disconnectDatabase();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({});
      await Project.deleteMany({});
      await DiagnosticRun.deleteMany({});
      await ApiToken.deleteMany({});
    }
  });

  async function registerUser(email: string, password = "Password12345!", displayName = "User") {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password, displayName });
    return {
      cookies: res.headers["set-cookie"] as unknown as string[],
      csrfToken: res.body.csrfToken as string,
      user: res.body.user as { id: string; email: string; displayName: string }
    };
  }

  describe("1. Comprehensive Authorization Matrix", () => {
    it("enforces strict anonymous rejection (401) on all protected resource routes", async () => {
      const dummyId = new mongoose.Types.ObjectId().toString();

      const endpoints = [
        { method: "get", path: "/api/v1/projects" },
        { method: "post", path: "/api/v1/projects" },
        { method: "get", path: `/api/v1/projects/${dummyId}` },
        { method: "patch", path: `/api/v1/projects/${dummyId}` },
        { method: "delete", path: `/api/v1/projects/${dummyId}` },
        { method: "get", path: "/api/v1/diagnostic-runs" },
        { method: "post", path: "/api/v1/diagnostic-runs" },
        { method: "get", path: `/api/v1/diagnostic-runs/${dummyId}` },
        { method: "delete", path: `/api/v1/diagnostic-runs/${dummyId}` },
        { method: "get", path: "/api/v1/stats" },
        { method: "get", path: "/api/v1/tokens" },
        { method: "post", path: "/api/v1/tokens" },
        { method: "delete", path: `/api/v1/tokens/${dummyId}` },
        { method: "get", path: "/api/v1/rules" },
        { method: "get", path: "/api/v1/rules/NODE_DEPS_NOT_INSTALLED" },
        { method: "patch", path: "/api/v1/auth/preferences" },
        { method: "patch", path: "/api/v1/auth/password" },
        { method: "post", path: "/api/v1/auth/retention-cleanup" },
        { method: "delete", path: "/api/v1/auth/account" }
      ];

      for (const ep of endpoints) {
        const req = request(app)[ep.method as "get" | "post" | "patch" | "delete"](ep.path);
        const res = await req;
        expect(res.status, `Expected 401 for anonymous ${ep.method.toUpperCase()} ${ep.path}`).toBe(401);
      }
    });

    it("enforces strict isolation (404 Not Found) when User B accesses User A resources", async () => {
      const userA = await registerUser("owner-a@example.com", "Password12345!", "Owner A");
      const userB = await registerUser("intruder-b@example.com", "Password12345!", "Intruder B");

      // User A creates project and run
      const projA = await Project.create({
        ownerId: new mongoose.Types.ObjectId(userA.user.id),
        name: "Private Project A",
        detectedTechnologies: ["node"]
      });

      const runA = await DiagnosticRun.create({
        projectId: projA._id,
        ownerId: new mongoose.Types.ObjectId(userA.user.id),
        toolVersion: "0.1.0",
        operatingSystem: "linux",
        startedAt: new Date(),
        completedAt: new Date(),
        status: "passed",
        summary: {},
        findings: []
      });

      const tokenA = await ApiToken.create({
        ownerId: new mongoose.Types.ObjectId(userA.user.id),
        name: "User A Token",
        prefix: "stk_live_aaaa",
        tokenHash: hashToken("stk_live_aaaa1111222233334444555566667777")
      });

      // User B attempts to GET User A's project
      const getProj = await request(app)
        .get(`/api/v1/projects/${projA._id}`)
        .set("Cookie", userB.cookies);
      expect(getProj.status).toBe(404);

      // User B attempts to PATCH User A's project
      const patchProj = await request(app)
        .patch(`/api/v1/projects/${projA._id}`)
        .set("Cookie", userB.cookies)
        .set("X-CSRF-Token", userB.csrfToken)
        .send({ name: "Hacked Project" });
      expect(patchProj.status).toBe(404);

      // User B attempts to DELETE User A's project
      const delProj = await request(app)
        .delete(`/api/v1/projects/${projA._id}`)
        .set("Cookie", userB.cookies)
        .set("X-CSRF-Token", userB.csrfToken);
      expect(delProj.status).toBe(404);

      // User B attempts to GET User A's diagnostic run
      const getRun = await request(app)
        .get(`/api/v1/diagnostic-runs/${runA._id}`)
        .set("Cookie", userB.cookies);
      expect(getRun.status).toBe(404);

      // User B attempts to DELETE User A's diagnostic run
      const delRun = await request(app)
        .delete(`/api/v1/diagnostic-runs/${runA._id}`)
        .set("Cookie", userB.cookies)
        .set("X-CSRF-Token", userB.csrfToken);
      expect(delRun.status).toBe(404);

      // User B attempts to revoke User A's token
      const revokeToken = await request(app)
        .delete(`/api/v1/tokens/${tokenA._id}`)
        .set("Cookie", userB.cookies)
        .set("X-CSRF-Token", userB.csrfToken);
      expect(revokeToken.status).toBe(404);
    }, 15000);
  });

  describe("2. CSRF & State-Changing Protections", () => {
    it("rejects state-changing requests missing X-CSRF-Token with 403 Forbidden", async () => {
      const { cookies } = await registerUser("csrf-victim@example.com", "Password12345!", "Victim");

      const res = await request(app)
        .post("/api/v1/projects")
        .set("Cookie", cookies)
        // Omit X-CSRF-Token
        .send({ name: "Attacker Created Project" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("InvalidCsrfToken");
    });
  });

  describe("3. Session Fixation & Token Security", () => {
    it("regenerates session ID upon registration and login", async () => {
      // 1. Initial anonymous session
      const anonRes = await request(app).get("/api/v1/auth/csrf");
      const initialCookie = anonRes.headers["set-cookie"]?.[0];
      const initialCsrf = anonRes.body.csrfToken as string;
      expect(initialCookie).toBeDefined();

      // 2. Register
      const regRes = await request(app)
        .post("/api/v1/auth/register")
        .set("Cookie", [initialCookie!])
        .set("X-CSRF-Token", initialCsrf)
        .send({ email: "session-fixation@example.com", password: "Password12345!", displayName: "Fixed" });

      const regCookie = regRes.headers["set-cookie"]?.[0];
      const regCsrf = regRes.body.csrfToken as string;
      expect(regCookie).toBeDefined();
      expect(regCookie).not.toEqual(initialCookie);

      // 3. Login
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .set("Cookie", [regCookie!])
        .set("X-CSRF-Token", regCsrf)
        .send({ email: "session-fixation@example.com", password: "Password12345!" });

      const loginCookie = loginRes.headers["set-cookie"]?.[0];
      expect(loginCookie).toBeDefined();
      expect(loginCookie).not.toEqual(regCookie);
    });

    it("rejects revoked and expired API tokens", async () => {
      const user = await registerUser("token-tester@example.com", "Password12345!", "Token User");

      // Revoked token
      const revokedHash = hashToken("stk_live_revoked_token_123456789012");
      await ApiToken.create({
        ownerId: new mongoose.Types.ObjectId(user.user.id),
        name: "Revoked Token",
        prefix: "stk_live_revo",
        tokenHash: revokedHash,
        revokedAt: new Date()
      });

      const revokedRes = await request(app)
        .get("/api/v1/projects")
        .set("Authorization", "Bearer stk_live_revoked_token_123456789012");
      expect(revokedRes.status).toBe(401);

      // Expired token
      const expiredHash = hashToken("stk_live_expired_token_123456789012");
      await ApiToken.create({
        ownerId: new mongoose.Types.ObjectId(user.user.id),
        name: "Expired Token",
        prefix: "stk_live_expi",
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() - 3600000) // 1 hr ago
      });

      const expiredRes = await request(app)
        .get("/api/v1/projects")
        .set("Authorization", "Bearer stk_live_expired_token_123456789012");
      expect(expiredRes.status).toBe(401);
    });
  });

  describe("4. NoSQL Operator Injections & Canary Rejections", () => {
    it("rejects NoSQL query operator objects", async () => {
      const user = await registerUser("nosql-victim@example.com", "Password12345!", "NoSQL User");

      const res = await request(app)
        .get("/api/v1/projects?name[$ne]=null")
        .set("Cookie", user.cookies);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("InvalidQueryParams");
    });

    it("rejects canary secrets across payload, returns 422 and stores zero records", async () => {
      const user = await registerUser("canary-user@example.com", "Password12345!", "Canary User");

      const canaryReport = {
        toolVersion: "0.1.0",
        operatingSystem: "linux",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: "failed",
        project: {
          name: "Canary Project",
          detectedTechnologies: ["node"]
        },
        summary: { totalChecks: 1, passedChecks: 0, failedChecks: 1, warningChecks: 0, totalFindings: 1 },
        findings: [
          {
            id: "finding-canary",
            ruleId: "NODE_DEPS_NOT_INSTALLED",
            title: "Dependencies not installed",
            category: "dependency",
            severity: "high",
            confidence: "confirmed",
            status: "failed",
            evidence: [
              {
                id: "ev-canary",
                kind: "file_existence",
                description: "Leaked secret in evidence: CANARY_SECRET_12345",
                observed: "Found secret value CANARY_SECRET_12345"
              }
            ]
          }
        ]
      };

      const res = await request(app)
        .post("/api/v1/diagnostic-runs")
        .set("Cookie", user.cookies)
        .set("X-CSRF-Token", user.csrfToken)
        .send(canaryReport);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("UnprocessableEntity");
      // Confirm canary secret is NOT echoed back in response
      expect(JSON.stringify(res.body)).not.toContain("CANARY_SECRET_12345");

      // Verify zero runs were stored
      const runCount = await DiagnosticRun.countDocuments({ ownerId: new mongoose.Types.ObjectId(user.user.id) });
      expect(runCount).toBe(0);
    });
  });
});
