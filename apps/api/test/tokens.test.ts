import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { buildApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/lib/db.js";
import { User } from "../src/models/user.js";
import { ApiToken, hashToken } from "../src/models/api-token.js";
import type { ApiConfig } from "../src/config.js";

describe("StackDoctor API Tokens (Run 3C)", () => {
  let mongoServer: MongoMemoryServer;
  let app: ReturnType<typeof buildApp>;

  const testConfig: ApiConfig = {
    NODE_ENV: "test",
    PORT: 3003,
    MONGODB_URI: "mongodb://127.0.0.1:27017/test_tokens",
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
      await ApiToken.deleteMany({});
    }
  });

  async function createAuthenticatedUser(email: string) {
    const agent = request.agent(app);
    const regRes = await agent.post("/api/v1/auth/register").send({
      email,
      password: "Password12345!",
      displayName: "Token Tester"
    });
    expect(regRes.status).toBe(201);
    return {
      agent,
      csrfToken: regRes.body.csrfToken,
      userId: regRes.body.user.id
    };
  }

  describe("1. Token Creation & Plaintext Token Security", () => {
    it("returns plaintext token exactly once upon creation and only stores SHA-256 hash", async () => {
      const { agent, csrfToken, userId } = await createAuthenticatedUser("tokenuser@example.com");

      // 1. Create Token
      const createRes = await agent
        .post("/api/v1/tokens")
        .set("x-csrf-token", csrfToken)
        .send({
          name: "CLI Machine Token",
          expiresInDays: 30
        });

      expect(createRes.status).toBe(201);
      const rawToken = createRes.body.token;
      expect(rawToken).toBeDefined();
      expect(rawToken.startsWith("stk_live_")).toBe(true);

      const tokenInfo = createRes.body.tokenInfo;
      expect(tokenInfo.name).toBe("CLI Machine Token");
      expect(tokenInfo.prefix).toBe(rawToken.slice(0, 12));
      expect(tokenInfo.tokenHash).toBeUndefined(); // Never in response!

      // 2. Query MongoDB directly
      const storedToken = await ApiToken.findById(tokenInfo.id).lean();
      expect(storedToken).not.toBeNull();
      // Raw token must NEVER exist in DB
      expect(JSON.stringify(storedToken)).not.toContain(rawToken);
      // SHA-256 hash must be stored
      expect(storedToken?.tokenHash).toBe(hashToken(rawToken));
      expect(storedToken?.ownerId.toString()).toBe(userId);

      // 3. List tokens: plaintext token and tokenHash must NEVER be returned
      const listRes = await agent.get("/api/v1/tokens");
      expect(listRes.status).toBe(200);
      expect(listRes.body.tokens.length).toBe(1);
      const listed = listRes.body.tokens[0];
      expect(listed.name).toBe("CLI Machine Token");
      expect(listed.prefix).toBe(rawToken.slice(0, 12));
      expect(listed.token).toBeUndefined();
      expect(listed.tokenHash).toBeUndefined();
    });
  });

  describe("2. Bearer Token Authentication", () => {
    it("authenticates requests using Authorization: Bearer <token>", async () => {
      const { agent, csrfToken } = await createAuthenticatedUser("bearer@example.com");

      const createRes = await agent
        .post("/api/v1/tokens")
        .set("x-csrf-token", csrfToken)
        .send({ name: "Bearer Token" });
      const rawToken = createRes.body.token;

      // Make request using standard unauthenticated request agent with Bearer header
      const res = await request(app)
        .get("/api/v1/projects")
        .set("Authorization", `Bearer ${rawToken}`);

      expect(res.status).toBe(200);
      expect(res.body.projects).toBeDefined();

      // Verify rules endpoint can be accessed with Bearer token
      const rulesRes = await request(app)
        .get("/api/v1/rules")
        .set("Authorization", `Bearer ${rawToken}`);

      expect(rulesRes.status).toBe(200);
      expect(rulesRes.body.total).toBe(36);
    });

    it("rejects invalid, revoked, and expired tokens with 401", async () => {
      const { agent, csrfToken } = await createAuthenticatedUser("revoked@example.com");

      // 1. Invalid token
      const invalidRes = await request(app)
        .get("/api/v1/projects")
        .set("Authorization", "Bearer stk_live_totallyfaketoken12345");
      expect(invalidRes.status).toBe(401);
      expect(invalidRes.body.error.code).toBe("Unauthorized");

      // 2. Create and revoke token
      const createRes = await agent
        .post("/api/v1/tokens")
        .set("x-csrf-token", csrfToken)
        .send({ name: "To Be Revoked" });
      const rawToken = createRes.body.token;
      const tokenId = createRes.body.tokenInfo.id;

      // Revoke token
      const deleteRes = await agent
        .delete(`/api/v1/tokens/${tokenId}`)
        .set("x-csrf-token", csrfToken);
      expect(deleteRes.status).toBe(200);

      // Attempt to authenticate with revoked token
      const revokedRes = await request(app)
        .get("/api/v1/projects")
        .set("Authorization", `Bearer ${rawToken}`);
      expect(revokedRes.status).toBe(401);

      // 3. Expired token
      await ApiToken.create({
        ownerId: new mongoose.Types.ObjectId(),
        name: "Expired Token",
        prefix: "stk_live_expi",
        tokenHash: hashToken("stk_live_expiredtoken12345"),
        expiresAt: new Date(Date.now() - 10000) // in the past
      });

      const expiredRes = await request(app)
        .get("/api/v1/projects")
        .set("Authorization", "Bearer stk_live_expiredtoken12345");
      expect(expiredRes.status).toBe(401);
      expect(expiredRes.body.error.message).toContain("expired");
    });
  });
});
