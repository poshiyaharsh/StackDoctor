import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { ApiToken, generateRawToken } from "../models/api-token.js";
import { requireAuth, isValidObjectId } from "../middleware/auth.js";

export const tokensRouter = Router();

// Enforce authentication for token management
tokensRouter.use(requireAuth);

const createTokenSchema = z
  .object({
    name: z.string().min(1, "Token name is required").max(100).trim(),
    expiresInDays: z.coerce.number().int().min(1).max(3650).optional()
  })
  .strict();

/**
 * POST /api/v1/tokens
 * Generate a new API token. The raw token is returned ONCE and never stored or returned again.
 */
tokensRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: "ValidationError",
            message: "Invalid token creation data",
            details: parsed.error.issues
          }
        });
        return;
      }

      const { name, expiresInDays } = parsed.data;
      const ownerId = new mongoose.Types.ObjectId(req.session.userId);

      const { rawToken, prefix, tokenHash } = generateRawToken();

      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      const apiToken = await ApiToken.create({
        ownerId,
        name,
        tokenHash,
        prefix,
        expiresAt
      });

      res.status(201).json({
        token: rawToken,
        tokenInfo: apiToken.toSafeObject()
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/tokens
 * List all API tokens for the authenticated user. Never returns plain token or tokenHash.
 */
tokensRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = new mongoose.Types.ObjectId(req.session.userId);

      const tokens = await ApiToken.find({ ownerId }).sort({ createdAt: -1 });

      res.status(200).json({
        tokens: tokens.map((t) => t.toSafeObject())
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/tokens/:tokenId
 * Revoke an API token.
 */
tokensRouter.delete(
  "/:tokenId",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tokenId } = req.params;
      if (!isValidObjectId(tokenId)) {
        res.status(400).json({
          error: {
            code: "InvalidId",
            message: "Invalid token ID format"
          }
        });
        return;
      }

      const ownerId = new mongoose.Types.ObjectId(req.session.userId);
      const token = await ApiToken.findOne({
        _id: new mongoose.Types.ObjectId(tokenId),
        ownerId
      });

      if (!token) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "API token not found"
          }
        });
        return;
      }

      token.revokedAt = new Date();
      await token.save();

      res.status(200).json({
        success: true,
        message: "API token revoked",
        tokenInfo: token.toSafeObject()
      });
    } catch (err) {
      next(err);
    }
  }
);
