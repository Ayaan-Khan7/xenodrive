import { getSystemHealth } from "../services/healthService.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Health check controller
 * GET /api/health
 */
export const checkHealth = asyncHandler(async (req, res) => {
  const isVerbose = req.query.verbose === "true" || req.query.verbose === "1";
  const health = getSystemHealth(isVerbose);

  const statusCode = health.database.connected ? 200 : 200; // 200 with degraded status so monitoring probes still get payload
  const message = health.database.connected
    ? "CloudVault backend is running smoothly"
    : "CloudVault backend is running (Database disconnected)";

  return ApiResponse.success(res, health, message, statusCode);
});

