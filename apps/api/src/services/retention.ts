import mongoose from "mongoose";
import { User } from "../models/user.js";
import { DiagnosticRun } from "../models/diagnostic-run.js";

/**
 * Deletes diagnostic runs older than the user's configured retention window.
 * If retentionDays is 0 or undefined, reports are retained indefinitely.
 */
export async function cleanupExpiredRuns(
  userId?: string
): Promise<{ deletedRuns: number }> {
  let deletedRuns = 0;

  if (userId) {
    const user = await User.findById(userId);
    if (!user || !user.retentionDays || user.retentionDays <= 0) {
      return { deletedRuns: 0 };
    }

    const cutoffDate = new Date(Date.now() - user.retentionDays * 24 * 60 * 60 * 1000);
    const result = await DiagnosticRun.deleteMany({
      ownerId: new mongoose.Types.ObjectId(userId),
      createdAt: { $lt: cutoffDate }
    });
    deletedRuns = result.deletedCount || 0;
  } else {
    // Monorepo/system maintenance across all users
    const users = await User.find({ retentionDays: { $gt: 0 } });
    for (const u of users) {
      if (u.retentionDays && u.retentionDays > 0) {
        const cutoffDate = new Date(Date.now() - u.retentionDays * 24 * 60 * 60 * 1000);
        const res = await DiagnosticRun.deleteMany({
          ownerId: u._id,
          createdAt: { $lt: cutoffDate }
        });
        deletedRuns += res.deletedCount || 0;
      }
    }
  }

  return { deletedRuns };
}
