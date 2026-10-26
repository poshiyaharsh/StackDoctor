import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

declare module "express-session" {
  interface SessionData {
    csrfToken?: string;
    userId?: string;
  }
}

/**
 * Generates a high-entropy random CSRF token and assigns it to the session.
 */
export function getOrCreateCsrfToken(req: Request): string {
  if (!req.session) {
    throw new Error("Session middleware is required for CSRF protection");
  }
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

/**
 * CSRF protection middleware for cookie-authenticated requests.
 * State-changing HTTP methods (POST, PUT, PATCH, DELETE) must provide a matching
 * token in the X-CSRF-Token header or _csrf request body property.
 * Bearer token requests (used by CLI) are exempt because browsers do not auto-attach Bearer headers.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe HTTP methods do not mutate state
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Token-authenticated requests (Bearer token) are exempt from CSRF
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return next();
  }

  // Exempt registration and login from requiring a prior CSRF token,
  // or allow if session does not exist yet. However, once a session exists, enforce it!
  // If the path is /api/v1/auth/register or /api/v1/auth/login, a client might not have established a session yet:
  if (req.path === "/api/v1/auth/register" || req.path === "/api/v1/auth/login") {
    return next();
  }

  const sessionToken = req.session?.csrfToken;
  const providedToken =
    req.headers["x-csrf-token"] ||
    req.headers["x-xsrf-token"] ||
    (req.body && typeof req.body === "object" ? req.body._csrf : undefined);

  if (!sessionToken || !providedToken || typeof providedToken !== "string") {
    res.status(403).json({
      error: {
        code: "InvalidCsrfToken",
        message: "Missing or invalid CSRF token"
      }
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  const valid =
    sessionToken.length === providedToken.length &&
    crypto.timingSafeEqual(Buffer.from(sessionToken), Buffer.from(providedToken));

  if (!valid) {
    res.status(403).json({
      error: {
        code: "InvalidCsrfToken",
        message: "Missing or invalid CSRF token"
      }
    });
    return;
  }

  next();
}
