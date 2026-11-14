import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { corsMiddleware } from "./middleware/cors.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { notFoundHandler, errorHandler } from "./middleware/errorMiddleware.js";
import apiRouter from "./routes/index.js";
import { logger } from "./utils/logger.js";
import { ApiResponse } from "./utils/apiResponse.js";

// Handle uncaught exceptions (synchronous errors)
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! Shutting down...", {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

// Initialize Express application
const app = express();

// 1. Security Headers via Helmet
app.use(helmet());

// 2. Production-ready CORS
app.use(corsMiddleware);

// 3. Body Parsers & Cookie Parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// 4. HTTP Request Logger
app.use(requestLogger);

// 5. Global API Rate Limiter
app.use("/api", apiLimiter);

// 6. Root Route / Landing
app.get("/", (req, res) => {
  return ApiResponse.success(
    res,
    {
      name: "CloudVault (xenoDrive) API",
      version: "1.0.0",
      status: "online",
      docs: "/api/health",
    },
    "Welcome to CloudVault API"
  );
});

// 7. Mount Main API Router
app.use("/api", apiRouter);

// 8. Handle 404 for Unmatched Routes
app.use(notFoundHandler);

// 9. Centralized Error Handler
app.use(errorHandler);

// 10. Start Server and Connect Database
const startServer = async () => {
  // Connect to Database
  await connectDB();

  // Listen on configured port
  const server = app.listen(env.PORT, () => {
    logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    logger.info(`Health check available at: http://localhost:${env.PORT}/api/health`);
  });

  // Handle unhandled promise rejections (asynchronous errors)
  process.on("unhandledRejection", (err) => {
    logger.error("UNHANDLED REJECTION! Shutting down gracefully...", {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
    server.close(() => {
      process.exit(1);
    });
  });

  // Graceful shutdown on termination signals
  const shutdown = (signal) => {
    logger.info(`${signal} signal received: closing HTTP server...`);
    server.close(async () => {
      logger.info("HTTP server closed.");
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return { app, server };
};

// Start application if executed directly
startServer();

export default app;

