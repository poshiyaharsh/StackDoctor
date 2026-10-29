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

describe("StackDoctor Compare API (Run 4C)", () => {
  let mongoServer: MongoMemoryServer;
  let app: ReturnType<typeof buildApp>;

  const testConfig: ApiConfig = {
    NODE_ENV: "test",
    PORT: 3003,
    MONGODB_URI: "mongodb://127.0.0.1:27017/test_compare",
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

  function sampleReport(overrides: Partial<Report> = {}): Report {
    return {
      schemaVersion: "1.0.0",
      toolVersion: "0.1.0",
      operatingSystem: "linux",
      startedAt: new Date(Date.now() - 5000).toISOString(),
      completedAt: new Date().toISOString(),
      status: "completed",
      projectName: "Compare Test App",
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
              kind: "filesystem",
              description: "node_modules missing",
              observed: "node_modules does not exist",
              source: "fs.existsSync",
              collectedAt: new Date().toISOString()
            }
          ],
          possibleCauses: ["User did not run npm install"],
          recommendations: [],
          verificationStatus: "unverified",
          docs: []
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

  it("requires authentication", async () => {
    const res = await request(app).get("/api/v1/diagnostic-runs/compare?base=123&head=456");
    expect(res.status).toBe(401);
  });

  it("validates presence of base and head query parameters", async () => {
    const { agent } = await createAuthenticatedAgent("user1@example.com", "User One");

    const res1 = await agent.get("/api/v1/diagnostic-runs/compare");
    expect(res1.status).toBe(400);
    expect(res1.body.error.code).toBe("BadRequest");

    const res2 = await agent.get("/api/v1/diagnostic-runs/compare?base=507f1f77bcf86cd799439011");
    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe("BadRequest");
  });

  it("validates ObjectId format for base and head parameters", async () => {
    const { agent } = await createAuthenticatedAgent("user1@example.com", "User One");

    const res = await agent.get(
      "/api/v1/diagnostic-runs/compare?base=invalid-id&head=507f1f77bcf86cd799439011"
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("InvalidId");
  });

  it("returns 404 if either run does not exist", async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent(
      "user1@example.com",
      "User One"
    );

    // Upload one run
    const uploadRes = await agent
      .post("/api/v1/diagnostic-runs")
      .set("x-csrf-token", csrfToken)
      .send(sampleReport());
    expect(uploadRes.status).toBe(201);
    const existingRunId = uploadRes.body.diagnosticRun.id;

    const fakeRunId = new mongoose.Types.ObjectId().toString();

    const res = await agent.get(
      `/api/v1/diagnostic-runs/compare?base=${existingRunId}&head=${fakeRunId}`
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NotFound");
  });

  it("returns 404 (not 403) when attempting cross-user comparison to prevent ID enumeration", async () => {
    const user1 = await createAuthenticatedAgent("user1@example.com", "User One");
    const user2 = await createAuthenticatedAgent("user2@example.com", "User Two");

    // User 1 uploads a run
    const upload1 = await user1.agent
      .post("/api/v1/diagnostic-runs")
      .set("x-csrf-token", user1.csrfToken)
      .send(sampleReport({ projectName: "User 1 App" }));
    expect(upload1.status).toBe(201);
    const user1RunId = upload1.body.diagnosticRun.id;

    // User 2 uploads a run
    const upload2 = await user2.agent
      .post("/api/v1/diagnostic-runs")
      .set("x-csrf-token", user2.csrfToken)
      .send(sampleReport({ projectName: "User 2 App" }));
    expect(upload2.status).toBe(201);
    const user2RunId = upload2.body.diagnosticRun.id;

    // User 1 tries to compare user 1 run with user 2 run
    const res = await user1.agent.get(
      `/api/v1/diagnostic-runs/compare?base=${user1RunId}&head=${user2RunId}`
    );
    // Anti-enumeration guarantee: must return 404, NEVER 403
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NotFound");
  }, 15000);

  it("returns empty diff when comparing a run with itself", async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent(
      "user1@example.com",
      "User One"
    );

    const uploadRes = await agent
      .post("/api/v1/diagnostic-runs")
      .set("x-csrf-token", csrfToken)
      .send(sampleReport());
    expect(uploadRes.status).toBe(201);
    const runId = uploadRes.body.diagnosticRun.id;

    const res = await agent.get(
      `/api/v1/diagnostic-runs/compare?base=${runId}&head=${runId}`
    );
    expect(res.status).toBe(200);
    expect(res.body.comparison).toBeDefined();

    const comparison = res.body.comparison;
    expect(comparison.newFindings).toHaveLength(0);
    expect(comparison.resolvedFindings).toHaveLength(0);
    expect(comparison.changedFindings).toHaveLength(0);
    expect(comparison.unchangedFindings).toHaveLength(1);
    expect(comparison.hasRegressions).toBe(false);
  });

  it("accurately compares base and head runs belonging to the same user", async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent(
      "user1@example.com",
      "User One"
    );

    // Base run has finding A
    const baseReport = sampleReport({
      findings: [
        {
          ruleId: "PORT_CONFLICT",
          title: "Port 3000 in use",
          category: "ports",
          severity: "high",
          confidence: "confirmed",
          status: "failed",
          evidence: [
            {
              id: "ev-port",
              kind: "port_binding",
              description: "Port check",
              observed: "port: 3000 occupied",
              source: "probe",
              collectedAt: new Date().toISOString()
            }
          ],
          possibleCauses: [],
          recommendations: [],
          verificationStatus: "unverified",
          docs: []
        }
      ]
    });

    const uploadBase = await agent
      .post("/api/v1/diagnostic-runs")
      .set("x-csrf-token", csrfToken)
      .send(baseReport);
    expect(uploadBase.status).toBe(201);
    const baseRunId = uploadBase.body.diagnosticRun.id;

    // Head run resolved port 3000, but has new finding B
    const headReport = sampleReport({
      findings: [
        {
          ruleId: "REDIS_UNREACHABLE",
          title: "Redis cache connection timeout",
          category: "databases",
          severity: "critical",
          confidence: "confirmed",
          status: "failed",
          evidence: [
            {
              id: "ev-redis",
              kind: "database_ping",
              description: "Redis ping",
              observed: "service redis connection refused on port 6379",
              source: "probe",
              collectedAt: new Date().toISOString()
            }
          ],
          possibleCauses: [],
          recommendations: [],
          verificationStatus: "unverified",
          docs: []
        }
      ]
    });

    const uploadHead = await agent
      .post("/api/v1/diagnostic-runs")
      .set("x-csrf-token", csrfToken)
      .send(headReport);
    expect(uploadHead.status).toBe(201);
    const headRunId = uploadHead.body.diagnosticRun.id;

    const res = await agent.get(
      `/api/v1/diagnostic-runs/compare?base=${baseRunId}&head=${headRunId}`
    );
    expect(res.status).toBe(200);

    const comp = res.body.comparison;
    expect(comp.newFindings).toHaveLength(1);
    expect(comp.newFindings[0].ruleId).toBe("REDIS_UNREACHABLE");
    expect(comp.resolvedFindings).toHaveLength(1);
    expect(comp.resolvedFindings[0].ruleId).toBe("PORT_CONFLICT");
    expect(comp.hasRegressions).toBe(true);
  });
});
