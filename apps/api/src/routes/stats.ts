import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { DiagnosticRun } from "../models/diagnostic-run.js";
import { Project } from "../models/project.js";

export const statsRouter = Router();

// All stats routes require authentication
statsRouter.use(requireAuth);

interface FindingSummary {
  category?: string;
  status?: string;
}

/**
 * GET /api/v1/stats
 * Returns owner-scoped diagnostic metrics, aggregated statistics, and recent activity.
 */
statsRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = new mongoose.Types.ObjectId(req.session.userId);

      // 1. Total counts scoped to owner
      const [totalRuns, projectsScanned] = await Promise.all([
        DiagnosticRun.countDocuments({ ownerId }),
        Project.countDocuments({ ownerId })
      ]);

      // 2. Fetch all runs for the user to compute granular aggregations
      const runs = await DiagnosticRun.find({ ownerId })
        .sort({ createdAt: -1 })
        .select("status summary findings projectId createdAt")
        .lean();

      let failedChecks = 0;
      const categoryCounts: Record<string, number> = {};
      const statusCounts: Record<string, number> = {
        passed: 0,
        warning: 0,
        failed: 0,
        cancelled: 0
      };

      for (const run of runs) {
        // Status counts
        const st = run.status === "completed_with_warnings" ? "warning" : run.status;
        statusCounts[st] = (statusCounts[st] || 0) + 1;

        // Failed checks from summary
        const summary = (run.summary || {}) as { failedChecks?: number };
        if (typeof summary.failedChecks === "number") {
          failedChecks += summary.failedChecks;
        }

        // Tally categories from findings
        if (Array.isArray(run.findings)) {
          for (const f of run.findings as FindingSummary[]) {
            if (f && f.category) {
              categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
            }
          }
        }
      }

      // Convert categoryCounts to sorted array
      const commonCategories = Object.entries(categoryCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      // 3. Recent 5 reports with project name
      const recentRuns = await DiagnosticRun.find({ ownerId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate<{ projectId: { name: string } }>("projectId", "name")
        .lean();

      const recentReports = recentRuns.map((r) => ({
        id: r._id.toString(),
        projectId: r.projectId ? ((r.projectId as unknown as { _id: mongoose.Types.ObjectId })._id?.toString() || "") : "",
        projectName: (r.projectId as unknown as { name?: string })?.name || "Unknown Project",
        status: r.status,
        findingsCount: Array.isArray(r.findings) ? r.findings.length : 0,
        createdAt: r.createdAt.toISOString()
      }));

      res.status(200).json({
        totalRuns,
        projectsScanned,
        failedChecks,
        commonCategories,
        recentReports,
        statusBreakdown: statusCounts
      });
    } catch (err) {
      next(err);
    }
  }
);
