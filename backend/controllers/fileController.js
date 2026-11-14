import crypto from "crypto";
import File from "../models/File.js";
import Folder from "../models/Folder.js";
import User from "../models/User.js";
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  verifyObjectExists,
  deleteObjectFromR2,
} from "../services/r2StorageService.js";
import { AppError } from "../utils/appError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Sanitize filename for storage keys
 */
const sanitizeFileName = (fileName) => {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
};

/**
 * @desc    Request a secure presigned upload URL for direct browser-to-R2 upload
 * @route   POST /api/files/request-upload-url
 * @access  Private
 */
export const requestUploadUrl = asyncHandler(async (req, res, next) => {
  const { name, size, mime_type, folder_id, checksum_sha256 } = req.body;
  const numSize = Number(size);

  // 1. Quota check
  const user = await User.findById(req.user._id);
  if (user.storage_used + numSize > user.storage_limit) {
    return next(
      new AppError(
        "Storage quota exceeded. Please upgrade your storage limit or delete existing files.",
        400
      )
    );
  }

  // 2. Folder verification (if folder_id specified)
  const targetFolderId = folder_id && folder_id !== "null" ? folder_id : null;
  if (targetFolderId) {
    const folder = await Folder.findOne({
      _id: targetFolderId,
      owner_id: req.user._id,
      is_trashed: false,
    });
    if (!folder) {
      return next(new AppError("Target folder not found or in trash.", 404));
    }
  }

  // 3. Duplicate detection via SHA-256 checksum
  if (checksum_sha256) {
    const existingDuplicate = await File.findOne({
      owner_id: req.user._id,
      checksum_sha256,
      folder_id: targetFolderId,
      is_trashed: false,
    });

    if (existingDuplicate) {
      return res.status(200).json({
        success: true,
        is_duplicate: true,
        message: `A file with identical content already exists: "${existingDuplicate.name}"`,
        file: existingDuplicate,
      });
    }
  }

  // 4. Generate unique R2 storage key isolated per user
  const sanitized = sanitizeFileName(name);
  const storageKey = `users/${req.user._id}/${Date.now()}-${crypto.randomUUID()}-${sanitized}`;

  // 5. Generate presigned upload URL
  const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
    key: storageKey,
    contentType: mime_type,
    size: numSize,
  });

  return ApiResponse.success(
    res,
    {
      uploadUrl,
      storage_key: storageKey,
      expiresIn,
      is_duplicate: false,
    },
    "Presigned upload URL generated successfully"
  );
});

/**
 * @desc    Confirm successful upload to R2 and store metadata in MongoDB
 * @route   POST /api/files/confirm-upload
 * @access  Private
 */
export const confirmUpload = asyncHandler(async (req, res, next) => {
  const { storage_key, name, size, mime_type, folder_id, checksum_sha256 } = req.body;

  // 1. Verify user ownership of storage key path
  const expectedPrefix = `users/${req.user._id}/`;
  if (!storage_key.startsWith(expectedPrefix)) {
    return next(new AppError("Unauthorized storage key.", 403));
  }

  // 2. Verify object actually exists in Cloudflare R2
  const r2Object = await verifyObjectExists(storage_key);
  const actualSize = r2Object.size || Number(size);

  // 3. Check quota again with actual verified size
  const user = await User.findById(req.user._id);
  if (user.storage_used + actualSize > user.storage_limit) {
    // Delete orphan file from R2 to prevent storage leakage
    await deleteObjectFromR2(storage_key);
    return next(new AppError("Storage quota exceeded. File upload was rejected.", 400));
  }

  const targetFolderId = folder_id && folder_id !== "null" ? folder_id : null;

  // 4. Save file metadata in MongoDB
  const file = await File.create({
    name: name.trim(),
    original_name: name.trim(),
    mime_type: r2Object.contentType || mime_type,
    size: actualSize,
    storage_key,
    checksum_sha256: checksum_sha256 || null,
    folder_id: targetFolderId,
    owner_id: req.user._id,
    is_trashed: false,
  });

  // 5. Update user storage consumption
  user.storage_used += actualSize;
  await user.save();

  logger.info(`File recorded in MongoDB: ${file.name} (${file._id}), size: ${actualSize} bytes`);

  return res.status(201).json({
    success: true,
    message: "File uploaded and confirmed successfully",
    file,
  });
});

/**
 * @desc    Get files for current user (with search, sort, folder filter)
 * @route   GET /api/files
 * @access  Private
 */
export const getFiles = asyncHandler(async (req, res) => {
  const query = {
    owner_id: req.user._id,
    is_trashed: false,
  };

  // Filter by folder_id
  if (req.query.folder_id !== undefined) {
    const rawFolder = req.query.folder_id;
    query.folder_id = rawFolder === "null" || !rawFolder ? null : rawFolder;
  }

  // Filter by search query
  if (req.query.search) {
    query.name = { $regex: req.query.search, $options: "i" };
  }

  // Sorting
  const sortMap = {
    name_asc: { name: 1 },
    name_desc: { name: -1 },
    date_asc: { created_at: 1 },
    date_desc: { created_at: -1 },
    size_asc: { size: 1 },
    size_desc: { size: -1 },
  };
  const sortCriteria = sortMap[req.query.sort] || { created_at: -1 };

  const files = await File.find(query).sort(sortCriteria);

  return res.status(200).json({
    success: true,
    files,
  });
});

/**
 * @desc    Get presigned preview or download URL for a file
 * @route   GET /api/files/:id/preview
 * @access  Private
 */
export const getPreviewUrl = asyncHandler(async (req, res, next) => {
  const file = await File.findOne({
    _id: req.params.id,
    owner_id: req.user._id,
  });

  if (!file) {
    return next(new AppError("File not found", 404));
  }

  const isDownload = req.query.download === "true";

  // Generate secure presigned download/preview URL from Cloudflare R2
  const previewUrl = await generatePresignedDownloadUrl({
    key: file.storage_key,
    fileName: file.name,
    isDownload,
  });

  return res.status(200).json({
    success: true,
    preview_url: previewUrl,
    url: previewUrl,
    file,
  });
});

/**
 * @desc    Rename file
 * @route   PATCH /api/files/:id/rename
 * @access  Private
 */
export const renameFile = asyncHandler(async (req, res, next) => {
  const { name } = req.body;

  const file = await File.findOne({
    _id: req.params.id,
    owner_id: req.user._id,
  });

  if (!file) {
    return next(new AppError("File not found", 404));
  }

  file.name = name.trim();
  await file.save();

  return res.status(200).json({
    success: true,
    file,
  });
});

/**
 * @desc    Move file to target folder
 * @route   PATCH /api/files/:id/move
 * @access  Private
 */
export const moveFile = asyncHandler(async (req, res, next) => {
  const target = req.body.target_folder !== undefined ? req.body.target_folder : req.body.target_folder_id;
  const targetFolderId = target === "null" || !target ? null : target;

  if (targetFolderId) {
    const targetFolder = await Folder.findOne({
      _id: targetFolderId,
      owner_id: req.user._id,
      is_trashed: false,
    });
    if (!targetFolder) {
      return next(new AppError("Target folder not found", 404));
    }
  }

  const file = await File.findOne({
    _id: req.params.id,
    owner_id: req.user._id,
  });

  if (!file) {
    return next(new AppError("File not found", 404));
  }

  file.folder_id = targetFolderId;
  await file.save();

  return res.status(200).json({
    success: true,
    file,
  });
});

/**
 * @desc    Move file to trash
 * @route   DELETE /api/files/:id
 * @access  Private
 */
export const trashFile = asyncHandler(async (req, res, next) => {
  const file = await File.findOne({
    _id: req.params.id,
    owner_id: req.user._id,
  });

  if (!file) {
    return next(new AppError("File not found", 404));
  }

  file.is_trashed = true;
  file.trashed_at = new Date();
  await file.save();

  return res.status(200).json({
    success: true,
    message: "File moved to trash",
  });
});

/**
 * @desc    Restore file from trash
 * @route   POST /api/files/:id/restore
 * @access  Private
 */
export const restoreFile = asyncHandler(async (req, res, next) => {
  const file = await File.findOne({
    _id: req.params.id,
    owner_id: req.user._id,
  });

  if (!file) {
    return next(new AppError("File not found", 404));
  }

  file.is_trashed = false;
  file.trashed_at = null;
  await file.save();

  return res.status(200).json({
    success: true,
    file,
  });
});

/**
 * @desc    Permanently delete file from MongoDB and Cloudflare R2
 * @route   DELETE /api/files/:id/permanent
 * @access  Private
 */
export const permanentDeleteFile = asyncHandler(async (req, res, next) => {
  const file = await File.findOne({
    _id: req.params.id,
    owner_id: req.user._id,
  });

  if (!file) {
    return next(new AppError("File not found", 404));
  }

  // 1. Delete object from Cloudflare R2
  await deleteObjectFromR2(file.storage_key);

  // 2. Reduce user's storage consumption
  const user = await User.findById(req.user._id);
  if (user) {
    user.storage_used = Math.max(0, user.storage_used - file.size);
    await user.save();
  }

  // 3. Remove document from MongoDB
  await File.findByIdAndDelete(file._id);

  logger.info(`Permanently deleted file: ${file.name} (${file._id}), freed ${file.size} bytes`);

  return res.status(200).json({
    success: true,
    message: "File permanently deleted",
  });
});

