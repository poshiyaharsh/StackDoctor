import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { validateReport, type Report } from "@stackdoctor/schemas";
import { compareReports } from "@stackdoctor/core";
import { DiagnosticRun, type DiagnosticRunDocument } from "../models/diagnostic-run.js";
import { Project } from "../models/project.js";
import { User } from "../models/user.js";
import { Explanation } from "../models/explanation.js";
import { loadConfig, type ApiConfig } from "../config.js";
import {
  checkAndAcquireExplanationSlot,
  releaseExplanationSlot,
  getOrGenerateExplanation
} from "../services/explanation-service.js";
import { requireAuth, isValidObjectId } from "../middleware/auth.js";
import {
  containsSurvivedSecrets,
  sanitizeReport
} from "../lib/sanitize-report.js";

export const diagnosticRunsRouter = Router();

// Enforce authentication for all diagnostic run routes
diagnosticRunsRouter.use(requireAuth);

const listQuerySchema = z
  .object({
    projectId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid projectId format")
      .optional(),
    status: z
      .enum(["completed", "completed_with_warnings", "failed", "cancelled", "passed", "warning"])
      .optional(),
    severity: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
  .strict();

/**
 * POST /api/v1/diagnostic-runs
 * Upload and store a sanitized diagnostic run report.
 */
diagnosticRunsRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.body || typeof req.body !== "object") {
        res.status(400).json({
          error: {
            code: "BadRequest",
            message: "Missing or invalid request body"
          }
        });
        return;
      }

      // 1. Canary secret and survived raw credentials rejection (422)
      if (containsSurvivedSecrets(req.body)) {
        res.status(422).json({
          error: {
            code: "UnprocessableEntity",
            message: "Report contains unredacted credentials or canary secrets"
          }
        });
        return;
      }

      // 2. Validate against shared ReportSchema
      const reportValidation = validateReport(req.body);
      if (!reportValidation.success) {
        res.status(400).json({
          error: {
            code: "ValidationError",
            message: "Invalid diagnostic report format",
            details: reportValidation.errors
          }
        });
        return;
      }

      // 3. Re-run core redaction on all strings & sanitize machine identifiers
      const sanitizedReport = sanitizeReport(reportValidation.data);

      // Verify that after redaction, no secret patterns survived
      if (containsSurvivedSecrets(sanitizedReport)) {
        res.status(422).json({
          error: {
            code: "UnprocessableEntity",
            message: "Report contains unredacted credentials or canary secrets"
          }
        });
        return;
      }

      const ownerId = new mongoose.Types.ObjectId(req.session.userId);

      // 4. Resolve or create project
      let project;
      const explicitProjectId =
        (typeof req.body.projectId === "string" && req.body.projectId) ||
        (typeof req.query.projectId === "string" && req.query.projectId);

      if (explicitProjectId) {
        if (!isValidObjectId(explicitProjectId)) {
          res.status(400).json({
            error: {
              code: "InvalidId",
              message: "Invalid project ID format"
            }
          });
          return;
        }
        project = await Project.findOne({
          _id: new mongoose.Types.ObjectId(explicitProjectId),
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
      } else {
        const projectName = sanitizedReport.projectName.trim();
        project = await Project.findOne({ name: projectName, ownerId });
        if (!project) {
          const detectedTech = sanitizedReport.technologies.map((t) => t.name);
          project = await Project.create({
            ownerId,
            name: projectName,
            detectedTechnologies: detectedTech
          });
        }
      }

      // 5. Map status
      const statusMap: Record<
        string,
        "completed" | "completed_with_warnings" | "failed" | "cancelled"
      > = {
        passed: "completed",
        warning: "completed_with_warnings",
        failed: "failed",
        completed: "completed",
        completed_with_warnings: "completed_with_warnings",
        cancelled: "cancelled"
      };
      const runStatus = statusMap[sanitizedReport.status] || "completed";

      // 6. Create diagnostic run record
      const run = await DiagnosticRun.create({
        projectId: project._id,
        ownerId,
        toolVersion: sanitizedReport.toolVersion,
        operatingSystem: sanitizedReport.operatingSystem,
        startedAt: new Date(sanitizedReport.startedAt),
        completedAt: new Date(sanitizedReport.completedAt),
        status: runStatus,
        summary: sanitizedReport.summary,
        findings: sanitizedReport.findings
      });

      res.status(201).json({
        diagnosticRun: run.toSafeObject()
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/diagnostic-runs
 * Paginated list of diagnostic runs for the authenticated user with optional filters.
 */
diagnosticRunsRouter.get(
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

      const { projectId, status, severity, startDate, endDate, page, limit } =
        queryParsed.data;
      const ownerId = new mongoose.Types.ObjectId(req.session.userId);

      const filter: Record<string, unknown> = { ownerId };

      if (projectId) {
        filter.projectId = new mongoose.Types.ObjectId(projectId);
      }
      if (status) {
        filter.status = status;
      }
      if (severity) {
        filter["findings.severity"] = severity;
      }
      if (startDate || endDate) {
        const dateQuery: Record<string, Date> = {};
        if (startDate) dateQuery.$gte = new Date(startDate);
        if (endDate) dateQuery.$lte = new Date(endDate);
        filter.startedAt = dateQuery;
      }

      const total = await DiagnosticRun.countDocuments(filter);
      const totalPages = Math.ceil(total / limit) || 1;

      const runs = await DiagnosticRun.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      res.status(200).json({
        diagnosticRuns: runs.map((r) => r.toSafeObject()),
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
 * GET /api/v1/diagnostic-runs/compare?base=<runId>&head=<runId>
 * Compare two diagnostic runs belonging to the authenticated user.
 */
diagnosticRunsRouter.get(
  "/compare",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { base, head } = req.query;

      if (!base || typeof base !== "string" || !head || typeof head !== "string") {
        res.status(400).json({
          error: {
            code: "BadRequest",
            message: "Query parameters 'base' and 'head' are required"
          }
        });
        return;
      }

      if (!isValidObjectId(base) || !isValidObjectId(head)) {
        res.status(400).json({
          error: {
            code: "InvalidId",
            message: "Invalid diagnostic run ID format for base or head"
          }
        });
        return;
      }

      const ownerId = new mongoose.Types.ObjectId(req.session.userId);

      const [baseRun, headRun] = await Promise.all([
        DiagnosticRun.findOne({ _id: new mongoose.Types.ObjectId(base), ownerId }),
        DiagnosticRun.findOne({ _id: new mongoose.Types.ObjectId(head), ownerId })
      ]);

      if (!baseRun || !headRun) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "One or both diagnostic runs not found"
          }
        });
        return;
      }

      const [baseProj, headProj] = await Promise.all([
        Project.findById(baseRun.projectId),
        Project.findById(headRun.projectId)
      ]);

      const toReport = (run: DiagnosticRunDocument, projectName: string): Report => ({
        schemaVersion: "1.0.0",
        toolVersion: run.toolVersion || "0.1.0",
        operatingSystem: run.operatingSystem || "unknown",
        startedAt:
          run.startedAt instanceof Date
            ? run.startedAt.toISOString()
            : String(run.startedAt),
        completedAt:
          run.completedAt instanceof Date
            ? run.completedAt.toISOString()
            : String(run.completedAt),
        status: (run.status as Report["status"]) || "completed",
        projectName: projectName || "project",
        technologies:
          (baseProj?.detectedTechnologies?.map((t: string) => ({
            name: t,
            confidence: "confirmed" as const,
            evidence: []
          })) ??
            []),
        checks: [],
        findings: (run.findings as Report["findings"]) || [],
        summary: (run.summary as unknown as Report["summary"]) || {
          totalChecks: 0,
          totalFindings: ((run.findings as unknown[]) || []).length,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          byStatus: { passed: 0, failed: 0, warning: 0, skipped: 0, error: 0 }
        }
      });

      const comparison = compareReports(
        toReport(baseRun, baseProj?.name ?? "Base Project"),
        toReport(headRun, headProj?.name ?? "Head Project")
      );

      res.status(200).json({
        comparison
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/diagnostic-runs/:runId
 * Retrieve a specific diagnostic run by ID, strictly scoped to owner.
 */
diagnosticRunsRouter.get(
  "/:runId",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { runId } = req.params;
      if (!isValidObjectId(runId)) {
        res.status(400).json({
          error: {
            code: "InvalidId",
            message: "Invalid diagnostic run ID format"
          }
        });
        return;
      }

      const ownerId = new mongoose.Types.ObjectId(req.session.userId);
      const run = await DiagnosticRun.findOne({
        _id: new mongoose.Types.ObjectId(runId),
        ownerId
      });
      if (!run) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "Diagnostic run not found"
          }
        });
        return;
      }

      res.status(200).json({
        diagnosticRun: run.toSafeObject()
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/diagnostic-runs/:runId
 * Delete a diagnostic run, strictly scoped to owner.
 */
diagnosticRunsRouter.delete(
  "/:runId",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { runId } = req.params;
      if (!isValidObjectId(runId)) {
        res.status(400).json({
          error: {
            code: "InvalidId",
            message: "Invalid diagnostic run ID format"
          }
        });
        return;
      }

      const ownerId = new mongoose.Types.ObjectId(req.session.userId);
      const run = await DiagnosticRun.findOneAndDelete({
        _id: new mongoose.Types.ObjectId(runId),
        ownerId
      });
      if (!run) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "Diagnostic run not found"
          }
        });
        return;
      }

      // Cascade delete cached explanations for this run
      await Explanation.deleteMany({
        runId: new mongoose.Types.ObjectId(runId),
        ownerId
      });

      res.status(200).json({
        success: true,
        message: "Diagnostic run deleted"
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/diagnostic-runs/:runId/explanation
 * Generates an AI-backed or deterministic fallback diagnostic explanation.
 * Strictly uses only stored sanitized report data from the database. Free-form body evidence is ignored.
 */
diagnosticRunsRouter.post(
  "/:runId/explanation",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let slotAcquired = false;
    try {
      const { runId } = req.params;
      if (!isValidObjectId(runId)) {
        res.status(400).json({
          error: {
            code: "InvalidId",
            message: "Invalid diagnostic run ID format"
          }
        });
        return;
      }

      const ownerId = new mongoose.Types.ObjectId(req.session.userId);
      const run = await DiagnosticRun.findOne({
        _id: new mongoose.Types.ObjectId(runId),
        ownerId
      });

      if (!run) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "Diagnostic run not found"
          }
        });
        return;
      }

      const userId = req.session.userId!;
      const ip = (req.ip || req.socket.remoteAddress || "unknown").replace(/^::ffff:/, "");
      const slot = checkAndAcquireExplanationSlot(userId, ip);
      if (!slot.allowed) {
        res.status(429).json({
          error: {
            code: "TooManyRequests",
            message: slot.reason
          },
          retryAfter: slot.retryAfter
        });
        return;
      }
      slotAcquired = true;

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

      const apiConfig = (req.app.locals.config as ApiConfig) || loadConfig();
      const explanationResult = await getOrGenerateExplanation({
        run,
        user,
        apiConfig
      });

      res.status(200).json(explanationResult);
    } catch (err) {
      next(err);
    } finally {
      if (slotAcquired && req.session?.userId) {
        releaseExplanationSlot(req.session.userId);
      }
    }
  }
);

/**
 * GET /api/v1/diagnostic-runs/:runId/explanation
 * Retrieves cached explanation for a diagnostic run, strictly scoped to owner.
 */
diagnosticRunsRouter.get(
  "/:runId/explanation",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { runId } = req.params;
      if (!isValidObjectId(runId)) {
        res.status(400).json({
          error: {
            code: "InvalidId",
            message: "Invalid diagnostic run ID format"
          }
        });
        return;
      }

      const ownerId = new mongoose.Types.ObjectId(req.session.userId);
      const run = await DiagnosticRun.findOne({
        _id: new mongoose.Types.ObjectId(runId),
        ownerId
      });

      if (!run) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "Diagnostic run not found"
          }
        });
        return;
      }

      const explanation = await Explanation.findOne({
        runId: new mongoose.Types.ObjectId(runId),
        ownerId
      }).sort({ createdAt: -1 });

      if (!explanation) {
        res.status(404).json({
          error: {
            code: "NotFound",
            message: "No explanation found for this diagnostic run"
          }
        });
        return;
      }

      res.status(200).json({
        ai: explanation.ai,
        status: explanation.status,
        explanation: explanation.explanation,
        removed: explanation.removed || [],
        reasons: explanation.reasons || [],
        unverifiedSuggestions: explanation.unverifiedSuggestions || [],
        cached: true
      });
    } catch (err) {
      next(err);
    }
  }
);
