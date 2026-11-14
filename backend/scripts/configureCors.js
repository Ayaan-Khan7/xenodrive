import { configureBucketCors } from "../services/r2StorageService.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

const run = async () => {
  logger.info("Configuring Cloudflare R2 Bucket CORS...");
  if (!env.isR2Configured) {
    logger.error("R2 credentials not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in .env");
    process.exit(1);
  }

  try {
    await configureBucketCors();
    logger.info("Successfully configured Cloudflare R2 Bucket CORS policy!");
    process.exit(0);
  } catch (error) {
    logger.error("Failed to configure R2 bucket CORS:", { error: error.message });
    process.exit(1);
  }
};

run();

