import ActivityLog from "../models/ActivityLog.js";
import { logger } from "./logger.js";

/**
 * Record user activity for auditing, analytics, and timeline
 * Non-blocking: logs any error without throwing to keep primary API fast
 */
export const logActivity = async ({
  userId,
  action,
  resourceType,
  resourceId = null,
  resourceName,
  details = {},
}) => {
  if (!userId || !action || !resourceName) return;

  try {
    await ActivityLog.create({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      resource_name: String(resourceName).trim().substring(0, 255),
      details: details || {},
    });
  } catch (err) {
    logger.warn(`Failed to record activity log (${action}): ${err.message}`);
  }
};
