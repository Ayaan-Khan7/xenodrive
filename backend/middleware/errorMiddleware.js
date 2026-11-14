import { AppError } from "../utils/appError.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

/**
 * 404 Not Found Middleware
 */
export const notFoundHandler = (req, res, next) => {
  next(new AppError(`Cannot find route ${req.method} ${req.originalUrl} on this server`, 404));
};

/**
 * Centralized Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Log error for diagnostics
  logger.error(`${req.method} ${req.originalUrl} - ${error.statusCode} ${error.message}`, {
    stack: err.stack,
    details: err.details,
  });

  // Mongoose Bad ObjectId (CastError)
  if (err.name === "CastError") {
    const message = `Invalid ${err.path}: ${err.value}`;
    error = new AppError(message, 400);
  }

  // Mongoose Duplicate Key Error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    const message = `Duplicate value entered for ${field}. Please use another value.`;
    error = new AppError(message, 409);
  }

  // Mongoose Validation Error
  if (err.name === "ValidationError") {
    const details = Object.values(err.errors || {}).map((val) => ({
      field: val.path,
      message: val.message,
    }));
    error = new AppError("Validation failed", 400, details);
  }

  // JWT Errors
  if (err.name === "JsonWebTokenError") {
    error = new AppError("Invalid authorization token. Please log in again.", 401);
  }
  if (err.name === "TokenExpiredError") {
    error = new AppError("Authorization token expired. Please log in again.", 401);
  }

  // CORS Error
  if (err.message && err.message.includes("not allowed by CORS policy")) {
    error = new AppError(err.message, 403);
  }

  const statusCode = error.statusCode || 500;
  const response = {
    success: false,
    error: error.message || "Internal Server Error",
    statusCode,
  };

  if (error.details) {
    response.details = error.details;
  }

  if (env.isDevelopment && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

