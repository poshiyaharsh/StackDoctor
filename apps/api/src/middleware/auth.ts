import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

/**
 * Validates whether an input is a valid 24-character hexadecimal MongoDB ObjectId string.
 */
export function isValidObjectId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  return /^[0-9a-fA-F]{24}$/.test(id) && mongoose.Types.ObjectId.isValid(id);
}

/**
 * Middleware requiring authenticated session.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
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
