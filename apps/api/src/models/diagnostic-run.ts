import mongoose, { Document, Schema, Model } from "mongoose";

export interface IDiagnosticRun {
  projectId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  toolVersion: string;
  operatingSystem: string;
  startedAt: Date;
  completedAt: Date;
  status: "completed" | "completed_with_warnings" | "failed" | "cancelled" | "passed" | "warning";
  summary: Record<string, unknown>;
  findings: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IDiagnosticRunMethods {
  toSafeObject(): {
    id: string;
    projectId: string;
    ownerId: string;
    toolVersion: string;
    operatingSystem: string;
    startedAt: string;
    completedAt: string;
    status: string;
    summary: Record<string, unknown>;
    findings: unknown[];
    createdAt: string;
    updatedAt: string;
  };
}

export interface DiagnosticRunDocument extends Document, IDiagnosticRun, IDiagnosticRunMethods {}

const diagnosticRunSchema = new Schema<DiagnosticRunDocument>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    toolVersion: {
      type: String,
      required: true,
      trim: true
    },
    operatingSystem: {
      type: String,
      required: true,
      trim: true
    },
    startedAt: {
      type: Date,
      required: true
    },
    completedAt: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      required: true,
      enum: ["completed", "completed_with_warnings", "failed", "cancelled", "passed", "warning"]
    },
    summary: {
      type: Schema.Types.Mixed,
      required: true
    },
    findings: {
      type: [Schema.Types.Mixed],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes
diagnosticRunSchema.index({ ownerId: 1, createdAt: -1 });
diagnosticRunSchema.index({ projectId: 1, createdAt: -1 });

diagnosticRunSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    projectId: this.projectId.toString(),
    ownerId: this.ownerId.toString(),
    toolVersion: this.toolVersion,
    operatingSystem: this.operatingSystem,
    startedAt: this.startedAt.toISOString(),
    completedAt: this.completedAt.toISOString(),
    status: this.status,
    summary: this.summary as Record<string, unknown>,
    findings: this.findings,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString()
  };
};

export const DiagnosticRun: Model<DiagnosticRunDocument> =
  (mongoose.models.DiagnosticRun as Model<DiagnosticRunDocument>) ||
  mongoose.model<DiagnosticRunDocument>("DiagnosticRun", diagnosticRunSchema);
