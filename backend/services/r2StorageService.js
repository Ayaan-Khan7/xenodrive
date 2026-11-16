import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, bucketName } from "../config/r2.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/appError.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_UPLOADS_DIR = path.resolve(__dirname, "../uploads");

// Ensure local uploads directory exists
if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
  fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
}

/**
 * Resolve local disk path for a storage key
 */
export const getLocalFilePath = (key) => {
  const safeKey = key.replace(/^[/\\]+/, "").replace(/[/\\]/g, path.sep);
  const targetPath = path.resolve(LOCAL_UPLOADS_DIR, safeKey);
  // Prevent directory traversal attacks
  if (!targetPath.startsWith(LOCAL_UPLOADS_DIR)) {
    throw new AppError("Invalid storage path traversal attempt", 400);
  }
  return targetPath;
};

/**
 * Generate a secure presigned upload URL for direct upload
 * Uses Cloudflare R2 when configured, or local storage upload endpoint as seamless fallback
 */
export const generatePresignedUploadUrl = async ({
  key,
  contentType,
  size,
  expiresIn = env.PRESIGNED_URL_EXPIRES_IN,
}) => {
  if (env.isR2Configured && r2Client) {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });
    logger.info(`Generated Cloudflare R2 presigned upload URL for key: ${key}`);

    return {
      uploadUrl,
      key,
      expiresIn,
    };
  }

  // Local Storage Fallback
  const host = `http://localhost:${env.PORT}`;
  const uploadUrl = `${host}/api/files/storage/upload?key=${encodeURIComponent(key)}`;
  logger.info(`Generated local storage upload URL for key: ${key}`);

  return {
    uploadUrl,
    key,
    expiresIn,
  };
};

/**
 * Generate a secure presigned download or preview URL
 * Uses Cloudflare R2 when configured, or local storage content stream endpoint as fallback
 */
export const generatePresignedDownloadUrl = async ({
  key,
  fileName = null,
  isDownload = false,
  expiresIn = env.PRESIGNED_URL_EXPIRES_IN,
}) => {
  if (env.isR2Configured && r2Client) {
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
  }

  // Local Storage Fallback
  const host = `http://localhost:${env.PORT}`;
  let downloadUrl = `${host}/api/files/storage/content?key=${encodeURIComponent(key)}`;
  if (fileName) downloadUrl += `&name=${encodeURIComponent(fileName)}`;
  if (isDownload) downloadUrl += `&download=true`;

  return downloadUrl;
};

/**
 * Verify that an object actually exists in storage (R2 or Local)
 * Returns metadata if found, throws 404 AppError if not found
 */
export const verifyObjectExists = async (key) => {
  if (env.isR2Configured && r2Client) {
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
  }

  // Local Storage Fallback
  const filePath = getLocalFilePath(key);
  if (!fs.existsSync(filePath)) {
    throw new AppError(`File not found in local storage: ${key}`, 404);
  }

  const stat = fs.statSync(filePath);
  return {
    size: stat.size,
    contentType: null,
    etag: `local-${stat.mtimeMs}`,
    lastModified: stat.mtime,
  };
};

/**
 * Delete a single object from storage (R2 or Local)
 */
export const deleteObjectFromR2 = async (key) => {
  if (env.isR2Configured && r2Client) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await r2Client.send(command);
      logger.info(`Deleted object from Cloudflare R2: ${key}`);
      return;
    } catch (error) {
      logger.error(`Failed to delete object from R2 (${key}):`, { error: error.message });
      throw new AppError(`Failed to delete file from cloud storage: ${error.message}`, 500);
    }
  }

  // Local Storage Fallback
  const filePath = getLocalFilePath(key);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      logger.info(`Deleted object from local storage: ${key}`);
    } catch (err) {
      logger.error(`Failed to delete local file (${key}):`, { error: err.message });
    }
  }
};

/**
 * Delete multiple objects in bulk from storage (R2 or Local)
 */
export const deleteObjectsFromR2 = async (keys) => {
  if (!keys || keys.length === 0) return;

  if (env.isR2Configured && r2Client) {
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
      return;
    } catch (error) {
      logger.error("Failed to bulk delete objects from R2:", { error: error.message });
      throw new AppError(`Failed to bulk delete files from cloud storage: ${error.message}`, 500);
    }
  }

  // Local Storage Fallback
  for (const key of keys) {
    const filePath = getLocalFilePath(key);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        logger.error(`Error deleting local file ${key}:`, { error: err.message });
      }
    }
  }
  logger.info(`Bulk deleted ${keys.length} local files`);
};

/**
 * Copy an object in storage (R2 or Local)
 */
export const copyObjectInStorage = async (sourceKey, destinationKey) => {
  if (env.isR2Configured && r2Client) {
    try {
      const command = new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: `${bucketName}/${encodeURIComponent(sourceKey)}`,
        Key: destinationKey,
      });

      await r2Client.send(command);
      logger.info(`Copied object in Cloudflare R2: ${sourceKey} -> ${destinationKey}`);
      return;
    } catch (error) {
      logger.error(`Failed to copy object in R2 (${sourceKey} -> ${destinationKey}):`, {
        error: error.message,
      });
      throw new AppError(`Failed to copy file in cloud storage: ${error.message}`, 500);
    }
  }

  // Local Storage Fallback
  const srcPath = getLocalFilePath(sourceKey);
  const dstPath = getLocalFilePath(destinationKey);

  if (!fs.existsSync(srcPath)) {
    throw new AppError(`Source file not found in local storage: ${sourceKey}`, 404);
  }

  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  fs.copyFileSync(srcPath, dstPath);
  logger.info(`Copied object in local storage: ${sourceKey} -> ${destinationKey}`);
};

/**
 * Extract clean plaintext excerpt from text-based file in storage for full-text search indexing
 * Truncates to max 64KB to avoid memory/database bloat
 */
export const extractTextFromStorage = async (key, mimeType = "", fileName = "") => {
  const isTextType =
    (mimeType && mimeType.startsWith("text/")) ||
    (mimeType && mimeType.includes("json")) ||
    (mimeType && mimeType.includes("javascript")) ||
    (mimeType && mimeType.includes("xml")) ||
    /\.(txt|md|markdown|csv|json|js|jsx|ts|tsx|html|css|xml|log|yaml|yml|sql|sh|py)$/i.test(fileName || "");

  if (!isTextType) return null;

  try {
    if (env.isR2Configured && r2Client) {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
        Range: "bytes=0-65535",
      });
      const response = await r2Client.send(command);
      const text = await response.Body.transformToString("utf-8");
      return text.substring(0, 65535);
    }

    // Local Storage Fallback
    const filePath = getLocalFilePath(key);
    if (!fs.existsSync(filePath)) return null;

    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(65536);
    const bytesRead = fs.readSync(fd, buffer, 0, 65536, 0);
    fs.closeSync(fd);

    return buffer.toString("utf-8", 0, bytesRead);
  } catch (err) {
    logger.warn(`Could not extract text from file ${fileName}: ${err.message}`);
    return null;
  }
};

/**
 * Configure bucket CORS on Cloudflare R2
 */
export const configureBucketCors = async (allowedOrigins = null) => {
  if (!env.isR2Configured || !r2Client) {
    logger.info("R2 not configured. Skipping bucket CORS configuration.");
    return;
  }

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
