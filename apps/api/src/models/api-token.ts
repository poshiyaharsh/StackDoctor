import mongoose, { Document, Schema, Model } from "mongoose";
import crypto from "node:crypto";

export interface IApiToken {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  tokenHash: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
}

export interface IApiTokenMethods {
  toSafeObject(): {
    id: string;
    ownerId: string;
    name: string;
    prefix: string;
    createdAt: string;
    lastUsedAt?: string;
    expiresAt?: string;
    revokedAt?: string;
    isRevoked: boolean;
    isExpired: boolean;
  };
}

export interface ApiTokenDocument extends Document, IApiToken, IApiTokenMethods {}

const apiTokenSchema = new Schema<ApiTokenDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    prefix: {
      type: String,
      required: true,
      maxlength: 16
    },
    lastUsedAt: {
      type: Date
    },
    expiresAt: {
      type: Date
    },
    revokedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

apiTokenSchema.index({ ownerId: 1, createdAt: -1 });

/**
 * Computes SHA-256 hash of a plaintext token.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Generates a new secure random API token.
 * Prefix format: stk_live_xxxx
 */
export function generateRawToken(): { rawToken: string; prefix: string; tokenHash: string } {
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const rawToken = `stk_live_${randomBytes}`;
  const prefix = rawToken.slice(0, 12);
  const tokenHash = hashToken(rawToken);
  return { rawToken, prefix, tokenHash };
}

apiTokenSchema.methods.toSafeObject = function () {
  const now = new Date();
  const isExpired = Boolean(this.expiresAt && this.expiresAt < now);
  const isRevoked = Boolean(this.revokedAt);

  return {
    id: this._id.toString(),
    ownerId: this.ownerId.toString(),
    name: this.name,
    prefix: this.prefix,
    createdAt: this.createdAt.toISOString(),
    lastUsedAt: this.lastUsedAt ? this.lastUsedAt.toISOString() : undefined,
    expiresAt: this.expiresAt ? this.expiresAt.toISOString() : undefined,
    revokedAt: this.revokedAt ? this.revokedAt.toISOString() : undefined,
    isRevoked,
    isExpired
  };
};

export const ApiToken: Model<ApiTokenDocument> =
  (mongoose.models.ApiToken as Model<ApiTokenDocument>) ||
  mongoose.model<ApiTokenDocument>("ApiToken", apiTokenSchema);
