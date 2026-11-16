import cors from "cors";
import { env } from "../config/env.js";

// Parse allowed origins from comma-separated string or array
const allowedOrigins = env.CLIENT_URL.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Production-ready CORS configuration
 */
export const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    // Allow explicitly specified origins or wildcard
    if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
      return callback(null, true);
    }

    // In production, allow all Vercel deployments (production domain and preview branches)
    if (env.isProduction && (origin.endsWith(".vercel.app") || origin.includes("vercel.app"))) {
      return callback(null, true);
    }

    callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
  },
  credentials: true, // Allow cookies and authorization headers across origins
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  exposedHeaders: ["Content-Disposition"],
  maxAge: 86400, // 24 hours preflight cache
};

export const corsMiddleware = cors(corsOptions);

