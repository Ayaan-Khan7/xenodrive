import { getDbStatus } from "../config/db.js";
import { env } from "../config/env.js";

/**
 * Service to aggregate system health and database diagnostic information
 */
export const getSystemHealth = (verbose = false) => {
  const dbStatus = getDbStatus();
  const uptimeSeconds = process.uptime();

  const healthData = {
    status: dbStatus.isConnected ? "healthy" : "degraded",
    service: "xenodrive-backend",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptimeSeconds / 60)}m ${Math.floor(uptimeSeconds % 60)}s`,
    uptimeSeconds: Math.floor(uptimeSeconds),
    database: {
      status: dbStatus.state,
      connected: dbStatus.isConnected,
    },
  };

  if (verbose) {
    const memory = process.memoryUsage();
    healthData.system = {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
      },
    };
    healthData.database.host = dbStatus.host;
    healthData.database.name = dbStatus.name;
  }

  return healthData;
};

