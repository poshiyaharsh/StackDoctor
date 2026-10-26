import mongoose, { Document, Schema, Model } from "mongoose";

export interface IProject {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  repositoryUrl?: string;
  detectedTechnologies: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IProjectMethods {
  toSafeObject(): {
    id: string;
    ownerId: string;
    name: string;
    repositoryUrl?: string;
    detectedTechnologies: string[];
    createdAt: string;
    updatedAt: string;
  };
}

export interface ProjectDocument extends Document, IProject, IProjectMethods {}

const projectSchema = new Schema<ProjectDocument>(
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
    repositoryUrl: {
      type: String,
      trim: true,
      maxlength: 500
    },
    detectedTechnologies: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Compound index for fast queries scoped to owner ordered by date
projectSchema.index({ ownerId: 1, createdAt: -1 });

projectSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    ownerId: this.ownerId.toString(),
    name: this.name,
    repositoryUrl: this.repositoryUrl,
    detectedTechnologies: this.detectedTechnologies || [],
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString()
  };
};

export const Project: Model<ProjectDocument> =
  (mongoose.models.Project as Model<ProjectDocument>) ||
  mongoose.model<ProjectDocument>("Project", projectSchema);
