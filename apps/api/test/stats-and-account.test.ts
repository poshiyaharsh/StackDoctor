import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { buildApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/lib/db.js";
import { User } from "../src/models/user.js";
import { Project } from "../src/models/project.js";
import { DiagnosticRun } from "../src/models/diagnostic-run.js";
import { ApiToken } from "../src/models/api-token.js";
import type { ApiConfig } from "../src/config.js";

describe("StackDoctor Stats & Account Management API (Run 3E)", () => {
  let mongoServer: MongoMemoryServer;
  let app: ReturnType<typeof buildApp>;

  const testConfig: ApiConfig = {
    NODE_ENV: "test",
    PORT: 3004,
    MONGODB_URI: "mongodb://127.0.0.1:27017/test_stats_account",
    SESSION_SECRET: "this_is_a_secure_test_session_secret_32chars_long",
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

  // Helper to register and return cookies + csrf token
  async function registerUser(email = "alice@example.com", password = "SecurePassword123!", displayName = "Alice") {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password, displayName });
    const cookies = res.headers["set-cookie"] as unknown as string[];
    const csrfToken = res.body.csrfToken as string;
    const user = res.body.user as { id: string; email: string; displayName: string };
    return { cookies, csrfToken, user };
  }

  describe("1. GET /api/v1/stats", () => {
    it("requires authentication", async () => {
      const res = await request(app).get("/api/v1/stats");
      expect(res.status).toBe(401);
    });

    it("returns zero metrics for a new user", async () => {
      const { cookies } = await registerUser();

      const res = await request(app)
        .get("/api/v1/stats")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.totalRuns).toBe(0);
      expect(res.body.projectsScanned).toBe(0);
      expect(res.body.failedChecks).toBe(0);
      expect(res.body.commonCategories).toEqual([]);
      expect(res.body.recentReports).toEqual([]);
      expect(res.body.statusBreakdown).toEqual({
        passed: 0,
        warning: 0,
        failed: 0,
        cancelled: 0
      });
    });

    it("aggregates metrics scoped to owner and preserves tenant isolation", async () => {
      // User A
      const userA = await registerUser("usera@example.com", "Password12345!", "User A");
      // User B
      const userB = await registerUser("userb@example.com", "Password12345!", "User B");

      // User A creates project and 2 runs
      const projA = await Project.create({
        ownerId: new mongoose.Types.ObjectId(userA.user.id),
        name: "Project Alpha",
        detectedTechnologies: ["node"]
      });

      await DiagnosticRun.create({
        projectId: projA._id,
        ownerId: new mongoose.Types.ObjectId(userA.user.id),
        toolVersion: "0.1.0",
        operatingSystem: "linux",
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
        status: "failed",
        summary: { totalChecks: 5, passedChecks: 3, failedChecks: 2 },
        findings: [
          { category: "runtime", ruleId: "NODE_VERSION_MISMATCH" },
          { category: "dependency", ruleId: "NODE_DEPS_NOT_INSTALLED" }
        ]
      });

      await DiagnosticRun.create({
        projectId: projA._id,
        ownerId: new mongoose.Types.ObjectId(userA.user.id),
        toolVersion: "0.1.0",
        operatingSystem: "linux",
        startedAt: new Date(Date.now() - 30000),
        completedAt: new Date(),
        status: "passed",
        summary: { totalChecks: 5, passedChecks: 5, failedChecks: 0 },
        findings: []
      });

      // User A stats
      const resA = await request(app)
        .get("/api/v1/stats")
        .set("Cookie", userA.cookies);

      expect(resA.status).toBe(200);
      expect(resA.body.totalRuns).toBe(2);
      expect(resA.body.projectsScanned).toBe(1);
      expect(resA.body.failedChecks).toBe(2);
      expect(resA.body.commonCategories).toHaveLength(2);
      expect(resA.body.recentReports).toHaveLength(2);
      expect(resA.body.recentReports[0].projectName).toBe("Project Alpha");
      expect(resA.body.statusBreakdown.passed).toBe(1);
      expect(resA.body.statusBreakdown.failed).toBe(1);

      // User B stats must remain 0 (strict tenant isolation)
      const resB = await request(app)
        .get("/api/v1/stats")
        .set("Cookie", userB.cookies);

      expect(resB.status).toBe(200);
      expect(resB.body.totalRuns).toBe(0);
      expect(resB.body.projectsScanned).toBe(0);
      expect(resB.body.failedChecks).toBe(0);
      expect(resB.body.commonCategories).toHaveLength(0);
      expect(resB.body.recentReports).toHaveLength(0);
    });
  });

  describe("2. Retention Settings & Cleanup Job", () => {
    it("updates retention days and cleans up only runs older than retention window", async () => {
      const { cookies, csrfToken, user } = await registerUser("retention@example.com", "Password12345!", "Retention User");

      // Set retention to 30 days
      const prefRes = await request(app)
        .patch("/api/v1/auth/preferences")
        .set("Cookie", cookies)
        .set("X-CSRF-Token", csrfToken)
        .send({ retentionDays: 30 });

      expect(prefRes.status).toBe(200);
      expect(prefRes.body.user.retentionDays).toBe(30);

      // Create a project
      const proj = await Project.create({
        ownerId: new mongoose.Types.ObjectId(user.id),
        name: "Old Project",
        detectedTechnologies: ["python"]
      });

      // Create run from 45 days ago (should be cleaned up)
      const oldRun = await DiagnosticRun.create({
        projectId: proj._id,
        ownerId: new mongoose.Types.ObjectId(user.id),
        toolVersion: "0.1.0",
        operatingSystem: "linux",
        startedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        status: "passed",
        summary: {},
        findings: [],
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
      });

      // Create run from 5 days ago (should NOT be cleaned up)
      const recentRun = await DiagnosticRun.create({
        projectId: proj._id,
        ownerId: new mongoose.Types.ObjectId(user.id),
        toolVersion: "0.1.0",
        operatingSystem: "linux",
        startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: "passed",
        summary: {},
        findings: [],
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      });

      // Run cleanup endpoint
      const cleanupRes = await request(app)
        .post("/api/v1/auth/retention-cleanup")
        .set("Cookie", cookies)
        .set("X-CSRF-Token", csrfToken);

      expect(cleanupRes.status).toBe(200);
      expect(cleanupRes.body.deletedRuns).toBe(1);

      // Verify old run is gone, recent run is intact
      const remainingOld = await DiagnosticRun.findById(oldRun._id);
      expect(remainingOld).toBeNull();

      const remainingRecent = await DiagnosticRun.findById(recentRun._id);
      expect(remainingRecent).not.toBeNull();
    });
  });

  describe("3. Password Change & Account Deletion", () => {
    it("handles password change with verification", async () => {
      const { cookies, csrfToken } = await registerUser("pwchange@example.com", "OldPassword1234!", "Password User");

      // Wrong current password
      const wrongRes = await request(app)
        .patch("/api/v1/auth/password")
        .set("Cookie", cookies)
        .set("X-CSRF-Token", csrfToken)
        .send({ currentPassword: "IncorrectPassword123!", newPassword: "NewSuperPassword123!" });

      expect(wrongRes.status).toBe(401);

      // Correct current password
      const okRes = await request(app)
        .patch("/api/v1/auth/password")
        .set("Cookie", cookies)
        .set("X-CSRF-Token", csrfToken)
        .send({ currentPassword: "OldPassword1234!", newPassword: "NewSuperPassword123!" });

      expect(okRes.status).toBe(200);

      // Login with old password fails
      const failLogin = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "pwchange@example.com", password: "OldPassword1234!" });
      expect(failLogin.status).toBe(401);

      // Login with new password succeeds
      const passLogin = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "pwchange@example.com", password: "NewSuperPassword123!" });
      expect(passLogin.status).toBe(200);
    }, 20000);

    it("deletes account and cascades deletion to all user projects, runs, and tokens", async () => {
      const { cookies, csrfToken, user } = await registerUser("delete-me@example.com", "PasswordToDel123!", "Doomed User");

      // Create resources for user
      const proj = await Project.create({
        ownerId: new mongoose.Types.ObjectId(user.id),
        name: "Doomed Project",
        detectedTechnologies: ["node"]
      });

      const run = await DiagnosticRun.create({
        projectId: proj._id,
        ownerId: new mongoose.Types.ObjectId(user.id),
        toolVersion: "0.1.0",
        operatingSystem: "linux",
        startedAt: new Date(),
        completedAt: new Date(),
        status: "passed",
        summary: {},
        findings: []
      });

      // Wrong password attempt
      const failDel = await request(app)
        .delete("/api/v1/auth/account")
        .set("Cookie", cookies)
        .set("X-CSRF-Token", csrfToken)
        .send({ password: "WrongPassword123!" });
      expect(failDel.status).toBe(401);

      // Correct password deletes account
      const successDel = await request(app)
        .delete("/api/v1/auth/account")
        .set("Cookie", cookies)
        .set("X-CSRF-Token", csrfToken)
        .send({ password: "PasswordToDel123!" });

      expect(successDel.status).toBe(200);

      // Verify user, projects, runs are all deleted from DB
      expect(await User.findById(user.id)).toBeNull();
      expect(await Project.findById(proj._id)).toBeNull();
      expect(await DiagnosticRun.findById(run._id)).toBeNull();

      // Subsequent authenticated requests using old session cookie fail with 401
      const meRes = await request(app)
        .get("/api/v1/auth/me")
        .set("Cookie", cookies);
      expect(meRes.status).toBe(401);
    }, 20000);
  });
});
