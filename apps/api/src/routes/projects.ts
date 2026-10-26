import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Project } from "../models/project.js";
import { DiagnosticRun } from "../models/diagnostic-run.js";
import { requireAuth, isValidObjectId } from "../middleware/auth.js";

export const projectsRouter = Router();

// Enforce authentication for all project routes
projectsRouter.use(requireAuth);

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["createdAt", "name", "updatedAt"]).default("createdAt"),
    order: z.enum(["asc", "desc"]).default("desc")
  })
  .strict();

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100).trim(),
  repositoryUrl: z
    .string()
    .url("Must be a valid URL")
    .max(500)
    .regex(/^https?:\/\//i, "Repository URL must use http or https protocol")
    .optional()
    .or(z.literal("")),
  detectedTechnologies: z.array(z.string().max(50)).default([])
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  repositoryUrl: z
    .string()
    .url("Must be a valid URL")
    .max(500)
    .regex(/^https?:\/\//i, "Repository URL must use http or https protocol")
    .optional()
    .or(z.literal("")),
  detectedTechnologies: z.array(z.string().max(50)).optional()
});

/**
 * GET /api/v1/projects
 * Paginated list of projects owned by the authenticated user.
 */
projectsRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      for (const key of Object.keys(req.query)) {
        if (key.includes("$") || key.includes("[") || key.includes("]")) {
          res.status(400).json({
            error: {
              code: "InvalidQueryParams",
              message: "NoSQL operator injection detected"
            }
          });
          return;
        }
      }

      const queryParsed = listQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        res.status(400).json({
          error: {
            code: "InvalidQueryParams",
            message: "Invalid query parameters",
            details: queryParsed.error.issues
          }
        });
        return;
      }

      const { page, limit, sortBy, order } = queryParsed.data;
      const ownerId = new mongoose.Types.ObjectId(req.session.userId);
      const filter: Record<string, unknown> = { ownerId };

      const total = await Project.countDocuments(filter);
      const totalPages = Math.ceil(total / limit) || 1;
      const sortDirection = order === "asc" ? 1 : -1;

      const projects = await Project.find(filter)
        .sort({ [sortBy]: sortDirection })
        .skip((page - 1) * limit)
        .limit(limit);

      res.status(200).json({
        projects: projects.map((p) => p.toSafeObject()),
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/projects
 * Create a new project for the authenticated user.
 */
projectsRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyParsed = createProjectSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        res.status(400).json({
          error: {
            code: "ValidationError",
            message: "Invalid project data",
            details: bodyParsed.error.issues
          }
        });
        return;
      }

      const { name, repositoryUrl, detectedTechnologies } = bodyParsed.data;
      const ownerId = new mongoose.Types.ObjectId(req.session.userId);

      const project = await Project.create({
        ownerId,
        name,
        repositoryUrl: repositoryUrl || undefined,
        detectedTechnologies: detectedTechnologies || []
      });

      res.status(201).json({
        project: project.toSafeObject()
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/projects/:projectId
 * Get project by ID, strictly scoped to owner.
 */
projectsRouter.get(
  "/:projectId",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      if (!isValidObjectId(projectId)) {
        res.status(400).json({
          error: {
            code: "InvalidId",
            message: "Invalid project ID format"
          }
        });
        return;
      }

      const ownerId = new mongoose.Types.ObjectId(req.session.userId);
      const project = await Project.findOne({
        _id: new mongoose.Types.ObjectId(projectId),
        ownerId
      });
      if (!project) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "Project not found"
          }
        });
        return;
      }

      res.status(200).json({
        project: project.toSafeObject()
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/projects/:projectId
 * Update project details, strictly scoped to owner.
 */
projectsRouter.patch(
  "/:projectId",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      if (!isValidObjectId(projectId)) {
        res.status(400).json({
          error: {
            code: "InvalidId",
            message: "Invalid project ID format"
          }
        });
        return;
      }

      const bodyParsed = updateProjectSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        res.status(400).json({
          error: {
            code: "ValidationError",
            message: "Invalid project update data",
            details: bodyParsed.error.issues
          }
        });
        return;
      }

      const ownerId = new mongoose.Types.ObjectId(req.session.userId);
      const project = await Project.findOne({
        _id: new mongoose.Types.ObjectId(projectId),
        ownerId
      });
      if (!project) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "Project not found"
          }
        });
        return;
      }

      if (bodyParsed.data.name !== undefined) {
        project.name = bodyParsed.data.name;
      }
      if (bodyParsed.data.repositoryUrl !== undefined) {
        project.repositoryUrl = bodyParsed.data.repositoryUrl || undefined;
      }
      if (bodyParsed.data.detectedTechnologies !== undefined) {
        project.detectedTechnologies = bodyParsed.data.detectedTechnologies;
      }

      await project.save();

      res.status(200).json({
        project: project.toSafeObject()
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/projects/:projectId
 * Delete project and cascade-delete all its associated diagnostic runs.
 */
projectsRouter.delete(
  "/:projectId",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      if (!isValidObjectId(projectId)) {
        res.status(400).json({
          error: {
            code: "InvalidId",
            message: "Invalid project ID format"
          }
        });
        return;
      }

      const ownerId = new mongoose.Types.ObjectId(req.session.userId);
      const projectObjectId = new mongoose.Types.ObjectId(projectId);
      const project = await Project.findOneAndDelete({
        _id: projectObjectId,
        ownerId
      });
      if (!project) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "Project not found"
          }
        });
        return;
      }

      // Cascade delete runs associated with this project
      const deletedRuns = await DiagnosticRun.deleteMany({
        projectId: projectObjectId,
        ownerId
      });

      res.status(200).json({
        success: true,
        message: "Project and associated diagnostic runs deleted",
        deletedRunsCount: deletedRuns.deletedCount
      });
    } catch (err) {
      next(err);
    }
  }
);
