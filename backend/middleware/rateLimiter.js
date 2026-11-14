import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

/**
 * Standard API rate limiter for general routes
 */
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // Default: 15 minutes
  max: env.RATE_LIMIT_MAX, // Default: 100 requests per window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    error: "Too many requests from this IP, please try again later.",
    statusCode: 429,
  },
  skip: (req) => {
    // Skip rate limiting for internal health checks
    return req.path === "/api/health" || req.path === "/health";
  },
});

/**
 * Stricter rate limiter for sensitive routes (e.g. auth login/register)
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many attempts from this IP, please try again in 15 minutes.",
    statusCode: 429,
  },
});

