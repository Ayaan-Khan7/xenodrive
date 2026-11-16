import mongoose from "mongoose";
import { env } from "../config/env.js";

const isValidObjectId = (id) => {
  return !id || id === "null" || mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validate request for presigned upload URL
 */
export const validateRequestUploadUrl = (req) => {
  const errors = [];
  const { name, size, mime_type, folder_id, checksum_sha256 } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    errors.push({ field: "name", message: "File name is required." });
  } else if (name.trim().length > 255) {
    errors.push({ field: "name", message: "File name cannot exceed 255 characters." });
  }

  const numSize = Number(size);
  if (isNaN(numSize) || numSize <= 0) {
    errors.push({ field: "size", message: "A valid positive file size in bytes is required." });
  } else if (numSize > env.MAX_FILE_SIZE) {
    errors.push({
      field: "size",
      message: `File size exceeds the maximum limit of ${Math.round(env.MAX_FILE_SIZE / 1024 / 1024)} MB.`,
    });
  }

  const MIME_REGEX = /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/;
  if (!mime_type || typeof mime_type !== "string" || !mime_type.trim()) {
    errors.push({ field: "mime_type", message: "Valid MIME type is required." });
  } else if (!MIME_REGEX.test(mime_type.trim())) {
    errors.push({ field: "mime_type", message: "Invalid MIME type format (expected type/subtype)." });
  }

  if (folder_id && !isValidObjectId(folder_id)) {
    errors.push({ field: "folder_id", message: "Invalid target folder ID." });
  }

  if (checksum_sha256 && (typeof checksum_sha256 !== "string" || checksum_sha256.length !== 64)) {
    errors.push({ field: "checksum_sha256", message: "Checksum must be a valid 64-character SHA-256 hex string." });
  }

  return errors.length > 0 ? errors : null;
};

/**
 * Validate confirmation of upload to R2
 */
export const validateConfirmUpload = (req) => {
  const errors = [];
  const { storage_key, name, size, mime_type, folder_id } = req.body || {};

  if (!storage_key || typeof storage_key !== "string" || !storage_key.trim()) {
    errors.push({ field: "storage_key", message: "Storage key is required." });
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    errors.push({ field: "name", message: "File name is required." });
  }

  const numSize = Number(size);
  if (isNaN(numSize) || numSize <= 0) {
    errors.push({ field: "size", message: "Valid positive file size in bytes is required." });
  }

  const MIME_REGEX = /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/;
  if (!mime_type || typeof mime_type !== "string" || !mime_type.trim()) {
    errors.push({ field: "mime_type", message: "Valid MIME type is required." });
  } else if (!MIME_REGEX.test(mime_type.trim())) {
    errors.push({ field: "mime_type", message: "Invalid MIME type format (expected type/subtype)." });
  }

  if (folder_id && !isValidObjectId(folder_id)) {
    errors.push({ field: "folder_id", message: "Invalid folder ID." });
  }

  return errors.length > 0 ? errors : null;
};

/**
 * Validate file rename
 */
export const validateRename = (req) => {
  const errors = [];
  const { name } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    errors.push({ field: "name", message: "New name is required." });
  } else if (name.trim().length > 255) {
    errors.push({ field: "name", message: "Name cannot exceed 255 characters." });
  }

  return errors.length > 0 ? errors : null;
};

/**
 * Validate file move
 */
export const validateMove = (req) => {
  const errors = [];
  const target = req.body?.target_folder !== undefined ? req.body.target_folder : req.body?.target_folder_id;

  if (target && !isValidObjectId(target)) {
    errors.push({ field: "target_folder", message: "Invalid target folder ID." });
  }

  return errors.length > 0 ? errors : null;
};

