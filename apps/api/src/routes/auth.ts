import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { User, hashPassword } from "../models/user.js";
import { getOrCreateCsrfToken } from "../middleware/csrf.js";
import { createRateLimiter } from "../middleware/rate-limiter.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters long")
    .max(128, "Password cannot exceed 128 characters"),
  displayName: z.string().min(1, "Display name is required").max(64).trim()
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(1, "Password is required").max(128)
});

// Rate limiters for auth endpoints
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 attempts per window
  message: "Too many authentication attempts. Please try again later."
});

/**
 * POST /api/v1/auth/register
 */
authRouter.post(
  "/register",
  authLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: "ValidationError",
            message: "Invalid registration data",
            details: parsed.error.issues
          }
        });
        return;
      }

      const { email, password, displayName } = parsed.data;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400).json({
          error: {
            code: "UserAlreadyExists",
            message: "An account with this email address already exists"
          }
        });
        return;
      }

      const passwordHash = await hashPassword(password);
      const user = await User.create({
        email,
        passwordHash,
        displayName
      });

      // Regenerate session to prevent fixation
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      req.session.userId = user._id.toString();
      const csrfToken = getOrCreateCsrfToken(req);

      res.status(201).json({
        user: user.toSafeObject(),
        csrfToken
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/login
 */
authRouter.post(
  "/login",
  authLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: "ValidationError",
            message: "Invalid login credentials",
            details: parsed.error.issues
          }
        });
        return;
      }

      const { email, password } = parsed.data;

      const user = await User.findOne({ email });
      if (!user) {
        // Generic error message to prevent email enumeration
        res.status(401).json({
          error: {
            code: "InvalidCredentials",
            message: "Invalid email or password"
          }
        });
        return;
      }

      const passwordMatch = await user.comparePassword(password);
      if (!passwordMatch) {
        res.status(401).json({
          error: {
            code: "InvalidCredentials",
            message: "Invalid email or password"
          }
        });
        return;
      }

      // Regenerate session upon successful login
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      req.session.userId = user._id.toString();
      const csrfToken = getOrCreateCsrfToken(req);

      res.status(200).json({
        user: user.toSafeObject(),
        csrfToken
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/logout
 */
authRouter.post(
  "/logout",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await new Promise<void>((resolve, reject) => {
        req.session.destroy((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.clearCookie("sid");
      res.status(200).json({
        success: true,
        message: "Successfully logged out"
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/auth/me
 */
authRouter.get(
  "/me",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({
          error: {
            code: "Unauthorized",
            message: "Authentication required"
          }
        });
        return;
      }

      const user = await User.findById(userId);
      if (!user) {
        res.status(401).json({
          error: {
            code: "Unauthorized",
            message: "User session is invalid"
          }
        });
        return;
      }

      const csrfToken = getOrCreateCsrfToken(req);
      res.status(200).json({
        user: user.toSafeObject(),
        csrfToken
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/auth/csrf
 */
authRouter.get("/csrf", (req: Request, res: Response): void => {
  const csrfToken = getOrCreateCsrfToken(req);
  res.status(200).json({ csrfToken });
});
