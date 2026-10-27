import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { User, hashPassword } from "../models/user.js";
import { Project } from "../models/project.js";
import { DiagnosticRun } from "../models/diagnostic-run.js";
import { ApiToken } from "../models/api-token.js";
import { Explanation } from "../models/explanation.js";
import { encryptApiKey } from "../lib/ai-crypto.js";
import { loadConfig, type ApiConfig } from "../config.js";
import { getOrCreateCsrfToken } from "../middleware/csrf.js";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rate-limiter.js";
import { cleanupExpiredRuns } from "../services/retention.js";

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

const preferencesSchema = z.object({
  retentionDays: z.number().int().min(0).max(365)
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(12, "New password must be at least 12 characters long")
    .max(128, "New password cannot exceed 128 characters")
});

const accountDeleteSchema = z.object({
  password: z.string().min(1, "Password is required to confirm account deletion")
});

const aiSettingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  apiKey: z.string().trim().min(1, "API key cannot be empty").max(256).optional(),
  provider: z.enum(["anthropic", "openai", "ollama"]).optional(),
  model: z.string().trim().max(128).optional()
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

/**
 * PATCH /api/v1/auth/preferences
 * Updates user preferences including report retention period.
 */
authRouter.patch(
  "/preferences",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = preferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: "ValidationError",
            message: "Invalid preferences data",
            details: parsed.error.issues
          }
        });
        return;
      }

      const user = await User.findById(req.session.userId);
      if (!user) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "User not found"
          }
        });
        return;
      }

      user.retentionDays = parsed.data.retentionDays;
      await user.save();

      res.status(200).json({
        user: user.toSafeObject()
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/auth/password
 * Changes the user password with current password verification.
 */
authRouter.patch(
  "/password",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = passwordChangeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: "ValidationError",
            message: "Invalid password change data",
            details: parsed.error.issues
          }
        });
        return;
      }

      const user = await User.findById(req.session.userId);
      if (!user) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "User not found"
          }
        });
        return;
      }

      const isMatch = await user.comparePassword(parsed.data.currentPassword);
      if (!isMatch) {
        res.status(401).json({
          error: {
            code: "InvalidCredentials",
            message: "Current password does not match"
          }
        });
        return;
      }

      user.passwordHash = await hashPassword(parsed.data.newPassword);
      await user.save();

      res.status(200).json({
        success: true,
        message: "Password updated successfully"
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/auth/ai-settings
 * Returns user's AI configuration (never exposes plaintext or encrypted API keys).
 */
authRouter.get(
  "/ai-settings",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findById(req.session.userId);
      if (!user) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "User not found"
          }
        });
        return;
      }

      const settings = user.aiSettings;
      res.status(200).json({
        enabled: Boolean(settings?.enabled),
        hasKey: Boolean(settings?.encryptedKey),
        provider: settings?.provider || "anthropic",
        model: settings?.model || ""
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/v1/auth/ai-settings
 * Updates user's AI configuration. Encrypts BYOK API keys at rest using AES-256-GCM.
 */
authRouter.put(
  "/ai-settings",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = aiSettingsUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: "ValidationError",
            message: "Invalid AI settings payload",
            details: parsed.error.issues
          }
        });
        return;
      }

      const user = await User.findById(req.session.userId);
      if (!user) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "User not found"
          }
        });
        return;
      }

      if (!user.aiSettings) {
        user.aiSettings = {
          enabled: false,
          provider: "anthropic"
        };
      }

      if (parsed.data.enabled !== undefined) {
        user.aiSettings.enabled = parsed.data.enabled;
      }
      if (parsed.data.provider !== undefined) {
        user.aiSettings.provider = parsed.data.provider;
      }
      if (parsed.data.model !== undefined) {
        user.aiSettings.model = parsed.data.model;
      }

      if (parsed.data.apiKey) {
        const config = (req.app.locals.config as ApiConfig) || loadConfig();
        const encrypted = encryptApiKey(parsed.data.apiKey, config.AI_ENCRYPTION_MASTER_KEY);
        user.aiSettings.encryptedKey = encrypted.ciphertext;
        user.aiSettings.iv = encrypted.iv;
        user.aiSettings.tag = encrypted.tag;
      }

      await user.save();

      res.status(200).json({
        enabled: Boolean(user.aiSettings.enabled),
        hasKey: Boolean(user.aiSettings.encryptedKey),
        provider: user.aiSettings.provider || "anthropic",
        model: user.aiSettings.model || ""
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/auth/ai-settings/key
 * Deletes user's BYOK encrypted API key at rest.
 */
authRouter.delete(
  "/ai-settings/key",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findById(req.session.userId);
      if (!user) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "User not found"
          }
        });
        return;
      }

      if (user.aiSettings) {
        user.aiSettings.encryptedKey = undefined;
        user.aiSettings.iv = undefined;
        user.aiSettings.tag = undefined;
        await user.save();
      }

      res.status(200).json({
        success: true,
        message: "AI key deleted successfully",
        hasKey: false
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/retention-cleanup
 * Executes cleanup of diagnostic runs older than the configured retention days for this user.
 */
authRouter.post(
  "/retention-cleanup",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await cleanupExpiredRuns(req.session.userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/auth/account
 * Completely deletes the user account and cascades deletion to all projects, runs, tokens, and sessions.
 * Requires current password verification for safety.
 */
authRouter.delete(
  "/account",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = accountDeleteSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: "ValidationError",
            message: "Password required to confirm account deletion",
            details: parsed.error.issues
          }
        });
        return;
      }

      const userId = req.session.userId;
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "User not found"
          }
        });
        return;
      }

      const isMatch = await user.comparePassword(parsed.data.password);
      if (!isMatch) {
        res.status(401).json({
          error: {
            code: "InvalidCredentials",
            message: "Incorrect password. Account was not deleted."
          }
        });
        return;
      }

      const userObjectId = new mongoose.Types.ObjectId(userId);

      // Cascade delete all owner resources including cached explanations
      await Promise.all([
        DiagnosticRun.deleteMany({ ownerId: userObjectId }),
        Explanation.deleteMany({ ownerId: userObjectId }),
        Project.deleteMany({ ownerId: userObjectId }),
        ApiToken.deleteMany({ ownerId: userObjectId }),
        User.deleteOne({ _id: userObjectId })
      ]);

      // Destroy session
      await new Promise<void>((resolve) => {
        req.session.destroy(() => resolve());
      });

      res.clearCookie("sid");
      res.status(200).json({
        success: true,
        message: "Account and all associated diagnostic data have been permanently deleted."
      });
    } catch (err) {
      next(err);
    }
  }
);
