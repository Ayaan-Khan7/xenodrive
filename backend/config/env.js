import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/cloudvault",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  JWT_SECRET: process.env.JWT_SECRET || "xenodrive_dev_secret_key_change_in_prod",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  // Cloudflare R2 Object Storage
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "",
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || "cloudvault",
  R2_PUBLIC_DOMAIN: process.env.R2_PUBLIC_DOMAIN || "",

  // Storage and File Limits
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE, 10) || 52428800, // 50 MB default per file
  DEFAULT_STORAGE_LIMIT: parseInt(process.env.DEFAULT_STORAGE_LIMIT, 10) || 1073741824, // 1 GB default user quota
  PRESIGNED_URL_EXPIRES_IN: parseInt(process.env.PRESIGNED_URL_EXPIRES_IN, 10) || 3600, // 1 hour

  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV !== "production",
  isR2Configured: Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  ),
};
