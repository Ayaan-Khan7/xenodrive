import crypto from "crypto";
import File from "../models/File.js";
import FileVersion from "../models/FileVersion.js";
import User from "../models/User.js";
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  verifyObjectExists,
  deleteObjectFromR2,
  copyObjectInStorage,
} from "../services/r2StorageService.js";
import { AppError } from "../utils/appError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../utils/activityLogger.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const sanitizeFileName = (fileName) => {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
};

/**
 * @desc    Request presigned upload URL to upload a new version of an existing file
 * @route   POST /api/files/:id/versions/request-upload-url
 * @access  Private
 */
export const requestVersionUploadUrl = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { size, name, mime_type, checksum_sha256 } = req.body;
  const numSize = Number(size);

  const file = await File.findOne({
    _id: id,
    owner_id: req.user._id,
    is_trashed: false,
  });

  if (!file) {
    return next(new AppError("File not found or in trash", 404));
  }

  // Quota check
  const user = await User.findById(req.user._id);
  if (user.storage_used + numSize > user.storage_limit) {
    return next(new AppError("Storage quota exceeded. Please upgrade or delete old files.", 400));
  }

  const nextVersion = (file.version || 1) + 1;
  const fileName = name || file.name;
  const sanitized = sanitizeFileName(fileName);
  const storageKey = `users/${req.user._id}/${Date.now()}-v${nextVersion}-${crypto.randomUUID()}-${sanitized}`;

  const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
    key: storageKey,
    contentType: mime_type || file.mime_type,
    size: numSize,
  });

  return res.status(200).json({
    success: true,
    data: {
      uploadUrl,
      storage_key: storageKey,
      next_version: nextVersion,
      expiresIn,
    },
    message: "Version upload URL generated successfully",
  });
});

/**
 * @desc    Confirm upload of a new file version
 * @route   POST /api/files/:id/versions/confirm-upload
 * @access  Private
 */
export const confirmVersionUpload = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { storage_key, size, name, mime_type, checksum_sha256, change_summary } = req.body;

  const file = await File.findOne({
    _id: id,
    owner_id: req.user._id,
    is_trashed: false,
  });

  if (!file) {
    return next(new AppError("File not found or in trash", 404));
  }

  // 1. Verify key prefix
  const expectedPrefix = `users/${req.user._id}/`;
  if (!storage_key || !storage_key.startsWith(expectedPrefix)) {
    return next(new AppError("Invalid or unauthorized storage key.", 403));
  }

  // 2. Verify physical existence in storage
  const r2Object = await verifyObjectExists(storage_key);
  const actualSize = r2Object.size || Number(size);

  // 3. Quota check
  const user = await User.findById(req.user._id);
  if (user.storage_used + actualSize > user.storage_limit) {
    await deleteObjectFromR2(storage_key);
    return next(new AppError("Storage quota exceeded.", 400));
  }

  // 4. Archive current active state into FileVersion collection
  const currentVersionNumber = file.version || 1;
  const archived = await FileVersion.create({
    file_id: file._id,
    version_number: currentVersionNumber,
    name: file.name,
    storage_key: file.storage_key,
    size: file.size,
    mime_type: file.mime_type,
    checksum_sha256: file.checksum_sha256,
    uploaded_by: req.user._id,
    change_summary: `Version ${currentVersionNumber}`,
  });

  // 5. Update File document with new version content
  const resolvedMime =
    r2Object.contentType && r2Object.contentType !== "application/octet-stream"
      ? r2Object.contentType
      : mime_type || file.mime_type;

  file.version = currentVersionNumber + 1;
  file.name = name ? name.trim() : file.name;
  file.storage_key = storage_key;
  file.size = actualSize;
  file.mime_type = resolvedMime;
  file.checksum_sha256 = checksum_sha256 || null;
  await file.save();

  // 6. Update user storage usage
  user.storage_used += actualSize;
  await user.save();

  await logActivity({
    userId: req.user._id,
    action: "version_upload",
    resourceType: "file",
    resourceId: file._id,
    resourceName: file.name,
    details: { version: file.version, size: actualSize },
  });

  logger.info(
    `New version ${file.version} confirmed for file ${file.name} (${file._id}). Previous version ${currentVersionNumber} archived.`
  );

  return res.status(201).json({
    success: true,
    message: `Version ${file.version} uploaded successfully`,
    file,
    archived_version: archived,
  });
});

/**
 * @desc    Get all versions of a file (including current active version)
 * @route   GET /api/files/:id/versions
 * @access  Private
 */
export const getFileVersions = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const file = await File.findOne({
    _id: id,
    owner_id: req.user._id,
    is_trashed: false,
  });

  if (!file) {
    return next(new AppError("File not found or in trash", 404));
  }

  const pastVersions = await FileVersion.find({ file_id: file._id }).sort({
    version_number: -1,
  });

  const currentVersion = {
    id: "current",
    file_id: file._id.toString(),
    version_number: file.version || 1,
    name: file.name,
    size: file.size,
    mime_type: file.mime_type,
    checksum_sha256: file.checksum_sha256,
    is_current: true,
    created_at: file.updated_at || file.created_at,
    change_summary: "Current active version",
  };

  const formattedPast = pastVersions.map((v) => ({
    ...v.toJSON(),
    is_current: false,
  }));

  return res.status(200).json({
    success: true,
    file,
    current_version: currentVersion,
    versions: [currentVersion, ...formattedPast],
  });
});

/**
 * @desc    Restore a previous version to become the active file
 * @route   POST /api/files/:id/versions/:versionId/restore
 * @access  Private
 */
export const restoreFileVersion = asyncHandler(async (req, res, next) => {
  const { id, versionId } = req.params;

  const file = await File.findOne({
    _id: id,
    owner_id: req.user._id,
    is_trashed: false,
  });

  if (!file) {
    return next(new AppError("File not found or in trash", 404));
  }

  const targetVersion = await FileVersion.findOne({
    _id: versionId,
    file_id: file._id,
  });

  if (!targetVersion) {
    return next(new AppError("Target version not found", 404));
  }

  const user = await User.findById(req.user._id);

  // 1. Archive current active version before restoration
  const currentVersionNumber = file.version || 1;
  await FileVersion.create({
    file_id: file._id,
    version_number: currentVersionNumber,
    name: file.name,
    storage_key: file.storage_key,
    size: file.size,
    mime_type: file.mime_type,
    checksum_sha256: file.checksum_sha256,
    uploaded_by: req.user._id,
    change_summary: `Archived before restoring version ${targetVersion.version_number}`,
  });

  // 2. Clone the restored version's object into a new independent storage key
  // This ensures old versions can still be deleted safely without breaking active file
  const nextVersion = currentVersionNumber + 1;
  const sanitized = sanitizeFileName(targetVersion.name);
  const newActiveKey = `users/${req.user._id}/${Date.now()}-restored-v${nextVersion}-${crypto.randomUUID()}-${sanitized}`;

  await copyObjectInStorage(targetVersion.storage_key, newActiveKey);

  // 3. Update active file
  file.name = targetVersion.name;
  file.storage_key = newActiveKey;
  file.size = targetVersion.size;
  file.mime_type = targetVersion.mime_type;
  file.checksum_sha256 = targetVersion.checksum_sha256;
  file.version = nextVersion;
  await file.save();

  // 4. Update user storage (add size of newly cloned active file)
  user.storage_used += targetVersion.size;
  await user.save();

  await logActivity({
    userId: req.user._id,
    action: "version_restore",
    resourceType: "file",
    resourceId: file._id,
    resourceName: file.name,
    details: { restored_version: targetVersion.version_number, new_version: nextVersion },
  });

  logger.info(
    `Restored version ${targetVersion.version_number} as new version ${nextVersion} for file ${file.name}`
  );

  return res.status(200).json({
    success: true,
    message: `Version ${targetVersion.version_number} restored successfully as version ${nextVersion}`,
    file,
  });
});

/**
 * @desc    Safely delete an old version (cleans R2 storage and reclaims quota)
 * @route   DELETE /api/files/:id/versions/:versionId
 * @access  Private
 */
export const deleteFileVersion = asyncHandler(async (req, res, next) => {
  const { id, versionId } = req.params;

  if (versionId === "current") {
    return next(new AppError("Cannot delete the current active version.", 400));
  }

  const file = await File.findOne({
    _id: id,
    owner_id: req.user._id,
    is_trashed: false,
  });

  if (!file) {
    return next(new AppError("File not found or in trash", 404));
  }

  const version = await FileVersion.findOne({
    _id: versionId,
    file_id: file._id,
  });

  if (!version) {
    return next(new AppError("Version not found", 404));
  }

  // 1. Physically delete object from Cloudflare R2 / storage
  await deleteObjectFromR2(version.storage_key);

  // 2. Reclaim storage quota
  const user = await User.findById(req.user._id);
  if (user) {
    user.storage_used = Math.max(0, user.storage_used - (version.size || 0));
    await user.save();
  }

  // 3. Delete version record from MongoDB
  await FileVersion.findByIdAndDelete(version._id);

  await logActivity({
    userId: req.user._id,
    action: "delete",
    resourceType: "file",
    resourceId: file._id,
    resourceName: `${file.name} (v${version.version_number})`,
  });

  logger.info(
    `Deleted version ${version.version_number} of file ${file.name}. Reclaimed ${version.size} bytes.`
  );

  return res.status(200).json({
    success: true,
    message: `Version ${version.version_number} deleted successfully`,
  });
});

/**
 * @desc    Download or preview a specific past version
 * @route   GET /api/files/:id/versions/:versionId/download
 * @access  Private
 */
export const downloadFileVersion = asyncHandler(async (req, res, next) => {
  const { id, versionId } = req.params;
  const isDownload = req.query.download === "true";

  const file = await File.findOne({
    _id: id,
    owner_id: req.user._id,
    is_trashed: false,
  });

  if (!file) {
    return next(new AppError("File not found or in trash", 404));
  }

  let storageKey = file.storage_key;
  let fileName = file.name;
  let versionInfo = { version_number: file.version, is_current: true };

  if (versionId !== "current") {
    const version = await FileVersion.findOne({
      _id: versionId,
      file_id: file._id,
    });

    if (!version) {
      return next(new AppError("Version not found", 404));
    }

    storageKey = version.storage_key;
    fileName = version.name;
    versionInfo = { version_number: version.version_number, is_current: false };
  }

  const downloadUrl = await generatePresignedDownloadUrl({
    key: storageKey,
    fileName,
    isDownload,
  });

  return res.status(200).json({
    success: true,
    download_url: downloadUrl,
    preview_url: downloadUrl,
    version: versionInfo,
  });
});
