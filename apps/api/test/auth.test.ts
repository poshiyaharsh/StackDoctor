import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { buildApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/lib/db.js";
import { User } from "../src/models/user.js";
import type { ApiConfig } from "../src/config.js";

describe("StackDoctor API Authentication & Foundation (Run 3A)", () => {
  let mongoServer: MongoMemoryServer;
  let app: ReturnType<typeof buildApp>;

  const testConfig: ApiConfig = {
    NODE_ENV: "test",
    PORT: 3001,
    MONGODB_URI: "mongodb://127.0.0.1:27017/test",
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
    }
  });

  describe("1. Health Endpoint", () => {
    it("returns 200 with database status ok and no sensitive data", async () => {
      const res = await request(app).get("/api/v1/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.database.status).toBe("connected");
      expect(res.body.toolVersion).toBeDefined();
      expect(res.body.schemaVersion).toBeDefined();
      // Ensure no internal DB connection strings or secrets in health response
      expect(JSON.stringify(res.body)).not.toContain("mongodb://");
    });
  });

  describe("2. User Registration", () => {
    const validUser = {
      email: "engineer@example.com",
      password: "SuperSecurePassword123!",
      displayName: "Senior Engineer"
    };

    it("registers user successfully with hashed password and returns safe user + csrfToken", async () => {
      const res = await request(app).post("/api/v1/auth/register").send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(validUser.email);
      expect(res.body.user.displayName).toBe(validUser.displayName);
      expect(res.body.user.id).toBeDefined();
      expect(res.body.csrfToken).toBeDefined();

      // Password hash must NEVER be in response
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.password).toBeUndefined();

      // Session cookie must be set
      const cookies = res.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes("sid="))).toBe(true);

      // Verify database contents
      const dbUser = await User.findOne({ email: validUser.email });
      expect(dbUser).toBeDefined();
      // Plaintext password MUST NOT exist in DB
      expect(dbUser?.passwordHash).not.toBe(validUser.password);
      expect(dbUser?.passwordHash.startsWith("$2")).toBe(true);
    });

    it("rejects password shorter than 12 characters", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "short@example.com",
        password: "short",
        displayName: "Short Pass"
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("ValidationError");
    });

    it("rejects duplicate email address", async () => {
      await request(app).post("/api/v1/auth/register").send(validUser);
      const res = await request(app).post("/api/v1/auth/register").send(validUser);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("UserAlreadyExists");
    });

    it("rejects malformed email format", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "not-an-email",
        password: "ValidPassword123456!",
        displayName: "Bad Email"
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("ValidationError");
    });
  });

  describe("3. Login Flow & Credential Validation", () => {
    const credentials = {
      email: "login-user@example.com",
      password: "SecurePassword123456!",
      displayName: "Login User"
    };

    beforeEach(async () => {
      await request(app).post("/api/v1/auth/register").send(credentials);
    });

    it("logs in successfully with valid credentials and sets session cookie", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: credentials.email,
        password: credentials.password
      });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(credentials.email);
      expect(res.body.csrfToken).toBeDefined();
      expect(res.body.user.passwordHash).toBeUndefined();

      const cookies = res.headers["set-cookie"] as unknown as string[];
      expect(cookies.some((c: string) => c.includes("sid="))).toBe(true);
    });

    it("returns generic 401 when password is wrong (no user enumeration)", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: credentials.email,
        password: "WrongPassword999!"
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("InvalidCredentials");
      expect(res.body.error.message).toBe("Invalid email or password");
    });

    it("returns identical generic 401 when email does not exist", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "nonexistent@example.com",
        password: "SomePassword123!"
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("InvalidCredentials");
      expect(res.body.error.message).toBe("Invalid email or password");
    });
  });

  describe("4. Session, CSRF Protection, and /me", () => {
    const user = {
      email: "session-test@example.com",
      password: "TestPassword123456!",
      displayName: "Session Tester"
    };

    it("allows authenticated GET /me with valid session cookie", async () => {
      const loginRes = await request(app).post("/api/v1/auth/register").send(user);
      const cookie = loginRes.headers["set-cookie"] as unknown as string[];

      const meRes = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe(user.email);
      expect(meRes.body.csrfToken).toBeDefined();
    });

    it("rejects GET /me when not authenticated with 401", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("Unauthorized");
    });

    it("enforces CSRF protection on state-changing requests with cookie sessions", async () => {
      const regRes = await request(app).post("/api/v1/auth/register").send(user);
      const cookie = regRes.headers["set-cookie"] as unknown as string[];
      const validCsrf = regRes.body.csrfToken as string;

      // 1. Without CSRF header -> 403 Forbidden
      const noCsrfRes = await request(app).post("/api/v1/auth/logout").set("Cookie", cookie);
      expect(noCsrfRes.status).toBe(403);
      expect(noCsrfRes.body.error.code).toBe("InvalidCsrfToken");

      // 2. With wrong CSRF header -> 403 Forbidden
      const badCsrfRes = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", cookie)
        .set("X-CSRF-Token", "wrong-token-value");
      expect(badCsrfRes.status).toBe(403);
      expect(badCsrfRes.body.error.code).toBe("InvalidCsrfToken");

      // 3. With valid CSRF header -> 200 OK
      const goodRes = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", cookie)
        .set("X-CSRF-Token", validCsrf);
      expect(goodRes.status).toBe(200);
      expect(goodRes.body.success).toBe(true);

      // Subsequent /me returns 401 because session is destroyed
      const meAfterLogout = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);
      expect(meAfterLogout.status).toBe(401);
    });
  });

  describe("5. Centralized Error Handler", () => {
    it("returns 404 for nonexistent routes without leaking stack", async () => {
      const res = await request(app).get("/api/v1/nonexistent-route");
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NotFound");
    });
  });
});
