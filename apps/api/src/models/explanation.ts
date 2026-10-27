import mongoose, { Document, Schema, Model } from "mongoose";

export interface IExplanation {
  ownerId: mongoose.Types.ObjectId;
  runId: mongoose.Types.ObjectId;
  reportHash: string;
  aiModel: string;
  status: "success" | "fallback";
  ai: boolean;
  explanation: Record<string, unknown>;
  removed: string[];
  reasons: string[];
  unverifiedSuggestions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IExplanationMethods {
  toSafeObject(): {
    id: string;
    ownerId: string;
    runId: string;
    reportHash: string;
    model: string;
    aiModel: string;
    status: string;
    ai: boolean;
    explanation: Record<string, unknown>;
    removed: string[];
    reasons: string[];
    unverifiedSuggestions: string[];
    createdAt: string;
  };
}

export interface ExplanationDocument extends Document, IExplanation, IExplanationMethods {}

const explanationSchema = new Schema<ExplanationDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    runId: {
      type: Schema.Types.ObjectId,
      ref: "DiagnosticRun",
      required: true,
      index: true
    },
    reportHash: {
      type: String,
      required: true,
      index: true
    },
    aiModel: {
      type: String,
      required: true
    },
    status: {
      type: String,
      required: true,
      enum: ["success", "fallback"]
    },
    ai: {
      type: Boolean,
      required: true,
      default: false
    },
    explanation: {
      type: Schema.Types.Mixed,
      required: true
    },
    removed: {
      type: [String],
      default: []
    },
    reasons: {
      type: [String],
      default: []
    },
    unverifiedSuggestions: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Compound index for cache lookups: (runId, reportHash, aiModel)
explanationSchema.index({ runId: 1, reportHash: 1, aiModel: 1 });
explanationSchema.index({ ownerId: 1, createdAt: -1 });

explanationSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    ownerId: this.ownerId.toString(),
    runId: this.runId.toString(),
    reportHash: this.reportHash,
    model: this.aiModel,
    aiModel: this.aiModel,
    status: this.status,
    ai: this.ai,
    explanation: this.explanation,
    removed: this.removed || [],
    reasons: this.reasons || [],
    unverifiedSuggestions: this.unverifiedSuggestions || [],
    createdAt: this.createdAt.toISOString()
  };
};

export const Explanation: Model<ExplanationDocument> =
  (mongoose.models.Explanation as Model<ExplanationDocument>) ||
  mongoose.model<ExplanationDocument>("Explanation", explanationSchema);
