import ActivityLog from "../models/ActivityLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * @desc    Get user activity log with pagination and optional action/date filtering
 * @route   GET /api/activity
 * @access  Private
 */
export const getActivityLogs = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const query = { user_id: userId };

  if (req.query.action) {
    query.action = req.query.action;
  }

  if (req.query.resource_type) {
    query.resource_type = req.query.resource_type;
  }

  // Date filtering
  if (req.query.date_range) {
    const now = new Date();
    if (req.query.date_range === "today") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      query.created_at = { $gte: today };
    } else if (req.query.date_range === "7d") {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      query.created_at = { $gte: past7 };
    } else if (req.query.date_range === "30d") {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      query.created_at = { $gte: past30 };
    }
  }

  const [activities, total] = await Promise.all([
    ActivityLog.find(query).sort({ created_at: -1 }).skip(skip).limit(limit),
    ActivityLog.countDocuments(query),
  ]);

  return res.status(200).json({
    success: true,
    activities,
    total,
    page,
    total_pages: Math.ceil(total / limit) || 1,
  });
});
