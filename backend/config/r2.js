import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

/**
 * Initialize Cloudflare R2 S3-Compatible Client
 */
let r2Client = null;

if (env.isR2Configured) {
  r2Client = new S3Client({
    region: env.R2_REGION || "auto",
    endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
  logger.info(`S3-compatible Object Storage Client initialized successfully (Endpoint: ${env.R2_ENDPOINT || env.R2_ACCOUNT_ID}).`);
} else {
  logger.warn(
    "Cloudflare R2 credentials not fully provided in environment variables. Object storage calls will require R2 configuration."
  );
}

export { r2Client };
export const bucketName = env.R2_BUCKET_NAME;

