import mongoose, { Document, Schema, Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser {
  email: string;
  passwordHash: string;
  displayName: string;
  retentionDays?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
  toSafeObject(): {
    id: string;
    email: string;
    displayName: string;
    retentionDays: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface UserDocument extends Document, IUser, IUserMethods {}

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64
    },
    retentionDays: {
      type: Number,
      default: 90,
      min: 0,
      max: 365
    }
  },
  {
    timestamps: true
  }
);

// Hash password with bcrypt cost 12
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    email: this.email,
    displayName: this.displayName,
    retentionDays: this.retentionDays ?? 90,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString()
  };
};

export const User: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument>) || mongoose.model<UserDocument>("User", userSchema);
