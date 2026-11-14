import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, bucketName } from "../config/r2.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/appError.js";
import { logger } from "../utils/logger.js";

/**
 * Ensure R2 client is initialized before operations
 */
const assertR2Client = () => {
  if (!r2Client) {
    throw new AppError(
      "Cloudflare R2 storage is not configured. Please provide R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in your environment.",
      503
    );
  }
};

/**
 * Generate a secure presigned upload URL for direct browser-to-R2 upload
 *
 * @param {Object} options
 * @param {string} options.key - Unique object storage key (e.g. users/<userId>/<uuid>-<filename>)
 * @param {string} options.contentType - MIME type of the file
 * @param {number} options.size - File size in bytes
 * @param {number} [options.expiresIn=3600] - Expiration in seconds
 * @returns {Promise<{ uploadUrl: string, key: string, expiresIn: number }>}
 */
export const generatePresignedUploadUrl = async ({
  key,
  contentType,
  size,
  expiresIn = env.PRESIGNED_URL_EXPIRES_IN,
}) => {
  assertR2Client();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });

  logger.info(`Generated presigned upload URL for key: ${key}`);

  return {
    uploadUrl,
    key,
    expiresIn,
  };
};

/**
 * Generate a secure presigned download or preview URL
 *
 * @param {Object} options
 * @param {string} options.key - Object storage key
 * @param {string} [options.fileName] - Custom display filename
 * @param {boolean} [options.isDownload=false] - Whether to force file download (attachment) or inline preview
 * @param {number} [options.expiresIn=3600] - Expiration in seconds
 * @returns {Promise<string>}
 */
export const generatePresignedDownloadUrl = async ({
  key,
  fileName = null,
  isDownload = false,
  expiresIn = env.PRESIGNED_URL_EXPIRES_IN,
}) => {
  assertR2Client();

  const commandInput = {
    Bucket: bucketName,
    Key: key,
  };

  if (fileName) {
    const disposition = isDownload ? "attachment" : "inline";
    commandInput.ResponseContentDisposition = `${disposition}; filename="${encodeURIComponent(fileName)}"`;
  }

  const command = new GetObjectCommand(commandInput);
  const downloadUrl = await getSignedUrl(r2Client, command, { expiresIn });

  return downloadUrl;
};

/**
 * Verify that an object actually exists in Cloudflare R2
 * Returns metadata if found, throws 404 AppError if not found
 *
 * @param {string} key
 * @returns {Promise<{ size: number, contentType: string, etag: string }>}
 */
export const verifyObjectExists = async (key) => {
  assertR2Client();

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await r2Client.send(command);

    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType || "application/octet-stream",
      etag: response.ETag || "",
      lastModified: response.LastModified,
    };
  } catch (error) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      throw new AppError(`File not found in cloud storage: ${key}`, 404);
    }
    logger.error("Error verifying object in R2:", { key, error: error.message });
    throw new AppError(`Failed to verify file in cloud storage: ${error.message}`, 500);
  }
};

/**
 * Delete a single object from Cloudflare R2
 *
 * @param {string} key
 * @returns {Promise<void>}
 */
export const deleteObjectFromR2 = async (key) => {
  assertR2Client();

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await r2Client.send(command);
    logger.info(`Deleted object from Cloudflare R2: ${key}`);
  } catch (error) {
    logger.error(`Failed to delete object from R2 (${key}):`, { error: error.message });
    throw new AppError(`Failed to delete file from cloud storage: ${error.message}`, 500);
  }
};

/**
 * Delete multiple objects in bulk from Cloudflare R2
 *
 * @param {string[]} keys
 * @returns {Promise<void>}
 */
export const deleteObjectsFromR2 = async (keys) => {
  assertR2Client();

  if (!keys || keys.length === 0) return;

  try {
    const command = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: keys.map((Key) => ({ Key })),
        Quiet: true,
      },
    });

    await r2Client.send(command);
    logger.info(`Bulk deleted ${keys.length} objects from Cloudflare R2`);
  } catch (error) {
    logger.error("Failed to bulk delete objects from R2:", { error: error.message });
    throw new AppError(`Failed to bulk delete files from cloud storage: ${error.message}`, 500);
  }
};

/**
 * Configure bucket CORS on Cloudflare R2
 * Allows web browsers to PUT (upload) and GET (download) directly
 *
 * @param {string[]} [allowedOrigins]
 * @returns {Promise<void>}
 */
export const configureBucketCors = async (allowedOrigins = null) => {
  assertR2Client();

  const origins = allowedOrigins || env.CLIENT_URL.split(",").map((o) => o.trim()).filter(Boolean);

  const command = new PutBucketCorsCommand({
    Bucket: bucketName,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: origins.length > 0 ? origins : ["*"],
          AllowedMethods: ["GET", "PUT", "HEAD", "POST", "DELETE"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag", "Content-Length", "Content-Type"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  });

  await r2Client.send(command);
  logger.info(`Bucket CORS configured for origins: ${origins.join(", ")}`);
};

