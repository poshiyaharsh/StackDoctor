import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { buildApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/lib/db.js";
import { User } from "../src/models/user.js";
import { Project } from "../src/models/project.js";
import { DiagnosticRun } from "../src/models/diagnostic-run.js";
import type { ApiConfig } from "../src/config.js";
import type { Report } from "@stackdoctor/schemas";

describe("StackDoctor Core API Resources (Run 3B)", () => {
  let mongoServer: MongoMemoryServer;
  let app: ReturnType<typeof buildApp>;

  const testConfig: ApiConfig = {
    NODE_ENV: "test",
    PORT: 3002,
    MONGODB_URI: "mongodb://127.0.0.1:27017/test_resources",
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
    }
  });

  // Helper to register and authenticate an agent
  async function createAuthenticatedAgent(email: string, displayName: string) {
    const agent = request.agent(app);
    const registerRes = await agent.post("/api/v1/auth/register").send({
      email,
      password: "SuperSecurePassword123!",
      displayName
    });
    expect(registerRes.status).toBe(201);
    const csrfToken = registerRes.body.csrfToken;
    const userId = registerRes.body.user.id;
    return { agent, csrfToken, userId };
  }

  function sampleValidReport(overrides: Partial<Report> = {}): Report {
    const timestamp = new Date().toISOString();
    return {
      schemaVersion: "1.0.0",
      toolVersion: "0.1.0",
      operatingSystem: "linux",
      startedAt: new Date(Date.now() - 5000).toISOString(),
      completedAt: timestamp,
      status: "completed",
      projectName: "Test Alpha App",
      technologies: [
        {
          name: "nodejs",
          confidence: "confirmed",
          evidence: []
        }
      ],
      checks: [
        {
          id: "node-installed",
          title: "Node.js Installation Check",
          category: "runtime",
          status: "passed",
          durationMs: 12,
          evidence: []
        }
      ],
      findings: [
        {
          ruleId: "NODE_DEPS_NOT_INSTALLED",
          title: "Node.js dependencies not installed",
          category: "node",
          severity: "high",
          confidence: "confirmed",
          status: "failed",
          evidence: [
            {
              id: "ev-1",
              kind: "path",
              description: "node_modules folder status",
              observed: "missing node_modules directory in /app",
              source: "fs.statSync",
              collectedAt: timestamp
            }
          ],
          possibleCauses: ["Dependencies were never installed with npm install"],
          recommendations: [
            {
              problem: "node_modules missing",
              relevance: "Application cannot start",
              commandOrAction: "npm install",
              expectedResult: "Dependencies installed",
              risks: "None",
              verification: "npm ls"
            }
          ],
          verificationStatus: "unverified",
          docs: ["https://docs.npmjs.com/cli/v10/commands/npm-install"]
        }
      ],
      summary: {
        totalChecks: 1,
        totalFindings: 1,
        bySeverity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
        byStatus: { passed: 1, failed: 0, warning: 0, skipped: 0, error: 0 }
      },
      ...overrides
    };
  }

  describe("1. Projects CRUD & Ownership Scoping", () => {
    it("creates, reads, lists, updates, and deletes projects", async () => {
      const { agent, csrfToken } = await createAuthenticatedAgent("alice@example.com", "Alice");

      // 1. Create project
      const createRes = await agent
        .post("/api/v1/projects")
        .set("x-csrf-token", csrfToken)
        .send({
          name: "Frontend Dashboard",
          repositoryUrl: "https://github.com/poshiyaharsh/StackDoctor",
          detectedTechnologies: ["react", "vite"]
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.project.name).toBe("Frontend Dashboard");
      expect(createRes.body.project.repositoryUrl).toBe("https://github.com/poshiyaharsh/StackDoctor");
      const projectId = createRes.body.project.id;

      // 2. Get project by ID
      const getRes = await agent.get(`/api/v1/projects/${projectId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.project.id).toBe(projectId);

      // 3. List projects
      const listRes = await agent.get("/api/v1/projects?page=1&limit=10");
      expect(listRes.status).toBe(200);
      expect(listRes.body.projects.length).toBe(1);
      expect(listRes.body.pagination.total).toBe(1);

      // 4. Update project
      const patchRes = await agent
        .patch(`/api/v1/projects/${projectId}`)
        .set("x-csrf-token", csrfToken)
        .send({
          name: "Updated Dashboard",
          detectedTechnologies: ["react", "vite", "typescript"]
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.project.name).toBe("Updated Dashboard");
      expect(patchRes.body.project.detectedTechnologies).toContain("typescript");

      // 5. Delete project
      const deleteRes = await agent
        .delete(`/api/v1/projects/${projectId}`)
        .set("x-csrf-token", csrfToken);
      expect(deleteRes.status).toBe(200);

      // Verify it's gone
      const verifyRes = await agent.get(`/api/v1/projects/${projectId}`);
      expect(verifyRes.status).toBe(404);
    });

    it("rejects project creation with invalid data", async () => {
      const { agent, csrfToken } = await createAuthenticatedAgent("bob@example.com", "Bob");

      // Empty name
      const res1 = await agent
        .post("/api/v1/projects")
        .set("x-csrf-token", csrfToken)
        .send({ name: "" });
      expect(res1.status).toBe(400);

      // Invalid repository URL protocol (e.g. ftp:// or javascript:)
      const res2 = await agent
        .post("/api/v1/projects")
        .set("x-csrf-token", csrfToken)
        .send({ name: "Valid Name", repositoryUrl: "ftp://example.com/repo" });
      expect(res2.status).toBe(400);
    });
  });

  describe("2. Diagnostic Runs Upload & Operations", () => {
    it("uploads a report, auto-creates project, and queries by ID and filters", async () => {
      const { agent, csrfToken } = await createAuthenticatedAgent("carol@example.com", "Carol");

      const report = sampleValidReport({ projectName: "Service Gateway" });

      // Upload run
      const uploadRes = await agent
        .post("/api/v1/diagnostic-runs")
        .set("x-csrf-token", csrfToken)
        .send(report);

      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.diagnosticRun.toolVersion).toBe("0.1.0");
      expect(uploadRes.body.diagnosticRun.status).toBe("completed"); // mapped from "passed"
      const runId = uploadRes.body.diagnosticRun.id;
      const projectId = uploadRes.body.diagnosticRun.projectId;

      // Project should have been automatically created with projectName
      const projectRes = await agent.get(`/api/v1/projects/${projectId}`);
      expect(projectRes.status).toBe(200);
      expect(projectRes.body.project.name).toBe("Service Gateway");

      // Query run by ID
      const getRes = await agent.get(`/api/v1/diagnostic-runs/${runId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.diagnosticRun.id).toBe(runId);

      // List runs with filter
      const listRes = await agent.get(`/api/v1/diagnostic-runs?projectId=${projectId}&status=completed`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.diagnosticRuns.length).toBe(1);

      // Filter by severity
      const sevRes = await agent.get(`/api/v1/diagnostic-runs?severity=high`);
      expect(sevRes.status).toBe(200);
      expect(sevRes.body.diagnosticRuns.length).toBe(1);

      // Filter by non-matching severity
      const lowRes = await agent.get(`/api/v1/diagnostic-runs?severity=low`);
      expect(lowRes.status).toBe(200);
      expect(lowRes.body.diagnosticRuns.length).toBe(0);

      // Delete run
      const delRes = await agent
        .delete(`/api/v1/diagnostic-runs/${runId}`)
        .set("x-csrf-token", csrfToken);
      expect(delRes.status).toBe(200);

      const verifyRun = await agent.get(`/api/v1/diagnostic-runs/${runId}`);
      expect(verifyRun.status).toBe(404);
    });

    it("cascades deletion of diagnostic runs when project is deleted", async () => {
      const { agent, csrfToken } = await createAuthenticatedAgent("dave@example.com", "Dave");

      // Create project
      const projRes = await agent
        .post("/api/v1/projects")
        .set("x-csrf-token", csrfToken)
        .send({ name: "Cascade Project" });
      const projectId = projRes.body.project.id;

      // Upload two runs explicitly attached to this project
      const report1 = sampleValidReport({ projectName: "Cascade Project" });
      await agent
        .post(`/api/v1/diagnostic-runs?projectId=${projectId}`)
        .set("x-csrf-token", csrfToken)
        .send(report1);

      const report2 = sampleValidReport({ projectName: "Cascade Project" });
      await agent
        .post(`/api/v1/diagnostic-runs?projectId=${projectId}`)
        .set("x-csrf-token", csrfToken)
        .send(report2);

      // Verify 2 runs exist
      const beforeDelete = await agent.get(`/api/v1/diagnostic-runs?projectId=${projectId}`);
      expect(beforeDelete.body.diagnosticRuns.length).toBe(2);

      // Delete project
      const deleteProj = await agent
        .delete(`/api/v1/projects/${projectId}`)
        .set("x-csrf-token", csrfToken);
      expect(deleteProj.status).toBe(200);
      expect(deleteProj.body.deletedRunsCount).toBe(2);

      // Verify runs are gone
      const afterDelete = await agent.get(`/api/v1/diagnostic-runs?projectId=${projectId}`);
      expect(afterDelete.body.diagnosticRuns.length).toBe(0);
    });
  });

  describe("3. Strict Multi-Tenant Isolation (User A vs User B)", () => {
    it("prevents User B from accessing, listing, modifying, or deleting User A resources", async () => {
      const userA = await createAuthenticatedAgent("userA@example.com", "User A");
      const userB = await createAuthenticatedAgent("userB@example.com", "User B");

      // User A creates a project and uploads a run
      const projResA = await userA.agent
        .post("/api/v1/projects")
        .set("x-csrf-token", userA.csrfToken)
        .send({ name: "User A Confidential Project" });
      const projectIdA = projResA.body.project.id;

      const runResA = await userA.agent
        .post(`/api/v1/diagnostic-runs?projectId=${projectIdA}`)
        .set("x-csrf-token", userA.csrfToken)
        .send(sampleValidReport({ projectName: "User A Confidential Project" }));
      const runIdA = runResA.body.diagnosticRun.id;

      // 1. User B cannot read User A's project (must return 404, not 403)
      const bReadProj = await userB.agent.get(`/api/v1/projects/${projectIdA}`);
      expect(bReadProj.status).toBe(404);

      // 2. User B cannot update User A's project (404)
      const bUpdateProj = await userB.agent
        .patch(`/api/v1/projects/${projectIdA}`)
        .set("x-csrf-token", userB.csrfToken)
        .send({ name: "Hacked Project" });
      expect(bUpdateProj.status).toBe(404);

      // 3. User B cannot delete User A's project (404)
      const bDeleteProj = await userB.agent
        .delete(`/api/v1/projects/${projectIdA}`)
        .set("x-csrf-token", userB.csrfToken);
      expect(bDeleteProj.status).toBe(404);

      // 4. User B listing projects does NOT see User A's project
      const bListProj = await userB.agent.get("/api/v1/projects");
      expect(bListProj.body.projects.length).toBe(0);

      // 5. User B cannot read User A's diagnostic run (404)
      const bReadRun = await userB.agent.get(`/api/v1/diagnostic-runs/${runIdA}`);
      expect(bReadRun.status).toBe(404);

      // 6. User B cannot delete User A's diagnostic run (404)
      const bDeleteRun = await userB.agent
        .delete(`/api/v1/diagnostic-runs/${runIdA}`)
        .set("x-csrf-token", userB.csrfToken);
      expect(bDeleteRun.status).toBe(404);

      // 7. User B listing diagnostic runs does NOT see User A's run
      const bListRuns = await userB.agent.get("/api/v1/diagnostic-runs");
      expect(bListRuns.body.diagnosticRuns.length).toBe(0);

      // 8. User B cannot upload a diagnostic run attached to User A's projectId (404)
      const bUploadToA = await userB.agent
        .post(`/api/v1/diagnostic-runs?projectId=${projectIdA}`)
        .set("x-csrf-token", userB.csrfToken)
        .send(sampleValidReport({ projectName: "Infiltrated Run" }));
      expect(bUploadToA.status).toBe(404);
    });
  });

  describe("4. Security: Re-Redaction, Canary Rejection, NoSQL Injection, and Malformed IDs", () => {
    it("rejects reports containing canary secrets with 422 and stores nothing", async () => {
      const { agent, csrfToken } = await createAuthenticatedAgent("eva@example.com", "Eva");

      const canaryReport = sampleValidReport({
        findings: [
          {
            ruleId: "NODE_DEPS_NOT_INSTALLED",
            title: "Canary Finding",
            category: "test",
            severity: "high",
            confidence: "confirmed",
            status: "failed",
            evidence: [
              {
                id: "ev-canary",
                kind: "path",
                description: "canary check",
                observed: "canary in evidence CANARY_SECRET_123",
                source: "env",
                collectedAt: new Date().toISOString()
              }
            ],
            possibleCauses: ["cause"],
            recommendations: [],
            verificationStatus: "unverified",
            docs: []
          }
        ]
      });

      const res = await agent
        .post("/api/v1/diagnostic-runs")
        .set("x-csrf-token", csrfToken)
        .send(canaryReport);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("UnprocessableEntity");

      // Verify nothing reached the database
      const count = await DiagnosticRun.countDocuments({});
      expect(count).toBe(0);
    });

    it("re-redacts sensitive credentials before storing in the database", async () => {
      const { agent, csrfToken } = await createAuthenticatedAgent("frank@example.com", "Frank");

      const sensitiveReport = sampleValidReport({
        findings: [
          {
            ruleId: "ENV_VAR_NAMES_MISSING",
            title: "Missing Environment Variables password='SuperSecretPassword99!'",
            category: "config",
            severity: "high",
            confidence: "confirmed",
            status: "failed",
            evidence: [
              {
                id: "ev-secret",
                kind: "config",
                description: "header check",
                observed: "Authorization: Bearer my-secret-jwt-token-12345",
                source: "env",
                collectedAt: new Date().toISOString()
              }
            ],
            possibleCauses: ["Missing credentials"],
            recommendations: [],
            verificationStatus: "unverified",
            docs: []
          }
        ]
      });

      const res = await agent
        .post("/api/v1/diagnostic-runs")
        .set("x-csrf-token", csrfToken)
        .send(sensitiveReport);

      expect(res.status).toBe(201);
      const runId = res.body.diagnosticRun.id;

      // Directly inspect raw stored MongoDB document
      const rawRun = await DiagnosticRun.findById(runId).lean();
      expect(rawRun).not.toBeNull();
      const stringified = JSON.stringify(rawRun);

      // Assert that sensitive text was redacted and plaintext is absent
      expect(stringified).not.toContain("SuperSecretPassword99!");
      expect(stringified).not.toContain("my-secret-jwt-token-12345");
      expect(stringified).toContain("[REDACTED]");
    });

    it("rejects malformed ObjectIds with 400 Bad Request", async () => {
      const { agent, csrfToken } = await createAuthenticatedAgent("grace@example.com", "Grace");

      // Invalid project ID in URL
      const resProj = await agent.get("/api/v1/projects/not-a-valid-id");
      expect(resProj.status).toBe(400);
      expect(resProj.body.error.code).toBe("InvalidId");

      // Invalid run ID in URL
      const resRun = await agent.get("/api/v1/diagnostic-runs/12345");
      expect(resRun.status).toBe(400);
      expect(resRun.body.error.code).toBe("InvalidId");

      // Delete with invalid ID
      const resDel = await agent
        .delete("/api/v1/projects/malformed-id")
        .set("x-csrf-token", csrfToken);
      expect(resDel.status).toBe(400);
    });

    it("rejects NoSQL injection operator objects in query parameters", async () => {
      const { agent } = await createAuthenticatedAgent("heidi@example.com", "Heidi");

      // Passing an object like ?projectId[$ne]=null
      const res = await agent.get("/api/v1/diagnostic-runs?projectId[$ne]=null");
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("InvalidQueryParams");
    });
  });

  describe("5. Rules Registry Endpoints", () => {
    it("requires authentication for rules endpoints", async () => {
      const unauthRes = await request(app).get("/api/v1/rules");
      expect(unauthRes.status).toBe(401);
    });

    it("returns all rules metadata and single rule by ruleId", async () => {
      const { agent } = await createAuthenticatedAgent("ivan@example.com", "Ivan");

      // 1. List all rules
      const allRulesRes = await agent.get("/api/v1/rules");
      expect(allRulesRes.status).toBe(200);
      expect(allRulesRes.body.total).toBe(32);
      expect(allRulesRes.body.rules.length).toBe(32);

      // Verify rule structure
      const firstRule = allRulesRes.body.rules[0];
      expect(firstRule.id).toBeDefined();
      expect(firstRule.title).toBeDefined();
      expect(firstRule.severity).toBeDefined();
      expect(firstRule.remediation).toBeDefined();

      // 2. Get single rule by ID
      const singleRuleRes = await agent.get("/api/v1/rules/NODE_DEPS_NOT_INSTALLED");
      expect(singleRuleRes.status).toBe(200);
      expect(singleRuleRes.body.rule.id).toBe("NODE_DEPS_NOT_INSTALLED");
      expect(singleRuleRes.body.rule.title).toBe("Node.js dependencies not installed");

      // 3. Nonexistent rule returns 404
      const nonExistentRes = await agent.get("/api/v1/rules/TOTALLY_FAKE_RULE");
      expect(nonExistentRes.status).toBe(404);
      expect(nonExistentRes.body.error.code).toBe("NotFound");
    });
  });
});
