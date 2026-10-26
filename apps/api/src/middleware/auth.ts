import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { ApiToken, hashToken } from "../models/api-token.js";

/**
 * Validates whether an input is a valid 24-character hexadecimal MongoDB ObjectId string.
 */
export function isValidObjectId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  return /^[0-9a-fA-F]{24}$/.test(id) && mongoose.Types.ObjectId.isValid(id);
}

/**
 * Middleware requiring authenticated session or valid API Bearer token.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // 1. Bearer token authentication (used by CLI or automated systems)
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const rawToken = authHeader.slice(7).trim();
    if (!rawToken) {
      res.status(401).json({
        error: {
          code: "Unauthorized",
          message: "Bearer token missing"
        }
      });
      return;
    }

    try {
      const tokenHash = hashToken(rawToken);
      const token = await ApiToken.findOne({ tokenHash, revokedAt: null });

      if (!token) {
        res.status(401).json({
          error: {
            code: "Unauthorized",
            message: "Invalid or revoked API token"
          }
        });
        return;
      }

      // Check token expiration
      if (token.expiresAt && token.expiresAt < new Date()) {
        res.status(401).json({
          error: {
            code: "Unauthorized",
            message: "API token has expired"
          }
        });
        return;
      }

      // Update lastUsedAt asynchronously
      token.lastUsedAt = new Date();
      token.save().catch(() => {});

      // Establish session identity for downstream handlers
      if (!req.session) {
        (req as unknown as { session: Record<string, unknown> }).session = {};
      }
      req.session.userId = token.ownerId.toString();

      next();
      return;
    } catch (err) {
      next(err);
      return;
    }
  }

  // 2. Cookie session authentication
  if (!req.session?.userId) {
    res.status(401).json({
      error: {
        code: "Unauthorized",
        message: "Authentication required"
      }
    });
    return;
  }

  next();
}
