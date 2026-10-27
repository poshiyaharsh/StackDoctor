import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import MongoStore from "connect-mongo";
import type { ApiConfig } from "./config.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/logger.js";
import { csrfProtection } from "./middleware/csrf.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { diagnosticRunsRouter } from "./routes/diagnostic-runs.js";
import { rulesRouter } from "./routes/rules.js";
import { tokensRouter } from "./routes/tokens.js";
import { statsRouter } from "./routes/stats.js";

export function buildApp(config: ApiConfig): Express {
  const app = express();
  app.locals.config = config;

  // 1. Basic security headers via helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false
    })
  );

  // 2. Strict CORS with origin allowlist
  const allowedOrigins = config.CORS_ORIGIN.split(",").map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-CSRF-Token"]
    })
  );

  // 3. Body parsing with strict size limit
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());

  // 4. Request ID and Request Logging
  app.use(requestIdMiddleware);
  app.use(requestLogger);

  // 5. Session Management
  const sessionStore =
    config.NODE_ENV === "test"
      ? undefined // Default MemoryStore in tests for fast execution
      : MongoStore.create({
          mongoUrl: config.MONGODB_URI,
          collectionName: "sessions",
          ttl: 14 * 24 * 60 * 60 // 14 days
        });

  app.use(
    session({
      name: "sid",
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        secure: config.COOKIE_SECURE || config.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
      }
    })
  );

  // 6. CSRF Protection for state-changing cookie requests
  app.use(csrfProtection);

  // 7. API Routes
  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/projects", projectsRouter);
  app.use("/api/v1/diagnostic-runs", diagnosticRunsRouter);
  app.use("/api/v1/rules", rulesRouter);
  app.use("/api/v1/tokens", tokensRouter);
  app.use("/api/v1/stats", statsRouter);

  // 8. 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: "NotFound",
        message: `Route ${req.method} ${req.originalUrl} not found`,
        requestId: req.id
      }
    });
  });

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
