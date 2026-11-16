import crypto from "crypto";
import File from "../models/File.js";
import Folder from "../models/Folder.js";
import User from "../models/User.js";
import FileVersion from "../models/FileVersion.js";
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  verifyObjectExists,
  deleteObjectFromR2,
  deleteObjectsFromR2,
  extractTextFromStorage,
} from "../services/r2StorageService.js";
import { logActivity } from "../utils/activityLogger.js";
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
 * @desc    Request a secure presigned upload URL for direct browser-to-R2 upload (with SHA-256 duplicate detection)
 * @route   POST /api/files/request-upload-url
 * @access  Private
 */
export const requestUploadUrl = asyncHandler(async (req, res, next) => {
  const { name, size, mime_type, folder_id, checksum_sha256, allow_duplicate, deduplicate } = req.body;
  const numSize = Number(size);

  // 1. Quota check
  const user = await User.findById(req.user._id);
  if (!deduplicate && user.storage_used + numSize > user.storage_limit) {
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
      is_trashed: false,
    });

    if (existingDuplicate) {
      // 3a. User explicitly chose to deduplicate (link existing storage without uploading or wasting storage)
      if (deduplicate) {
        const deduplicatedFile = await File.create({
          name: name.trim(),
          original_name: name.trim(),
          mime_type: existingDuplicate.mime_type || mime_type,
          size: existingDuplicate.size,
          storage_key: existingDuplicate.storage_key,
          checksum_sha256,
          folder_id: targetFolderId,
          owner_id: req.user._id,
          is_trashed: false,
        });

        await logActivity({
          userId: req.user._id,
          action: "upload",
          resourceType: "file",
          resourceId: deduplicatedFile._id,
          resourceName: deduplicatedFile.name,
          details: { size: deduplicatedFile.size, deduplicated: true },
        });

        return res.status(201).json({
          success: true,
          deduplicated: true,
          is_duplicate: false,
          file: deduplicatedFile,
          message: "File deduplicated and linked with zero storage overhead",
        });
      }

      // 3b. Notify user about existing duplicate before upload unless allow_duplicate is set
      if (!allow_duplicate) {
        let folderName = "Root";
        if (existingDuplicate.folder_id) {
          const f = await Folder.findById(existingDuplicate.folder_id).select("name");
          if (f) folderName = f.name;
        }

        return res.status(200).json({
          success: true,
          is_duplicate: true,
          message: `A file with identical content already exists: "${existingDuplicate.name}" in ${folderName}`,
          file: existingDuplicate,
          duplicate_file: {
            id: existingDuplicate._id.toString(),
            name: existingDuplicate.name,
            size: existingDuplicate.size,
            created_at: existingDuplicate.created_at,
            folder_id: existingDuplicate.folder_id ? existingDuplicate.folder_id.toString() : null,
            folder_name: folderName,
          },
        });
      }
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
 * @desc    Confirm successful upload to R2, extract searchable text, and store metadata in MongoDB
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

  // Resolve MIME type: prefer specific contentType from storage if set, otherwise client mime_type
  const resolvedMime =
    r2Object.contentType && r2Object.contentType !== "application/octet-stream"
      ? r2Object.contentType
      : mime_type || "application/octet-stream";

  // 4. Extract plaintext content for full-text search indexing (where practical)
  let extractedText = null;
  try {
    extractedText = await extractTextFromStorage(storage_key, resolvedMime, name.trim());
  } catch (err) {
    logger.warn(`Failed extracting text excerpt for ${name}: ${err.message}`);
  }

  // 5. Save file metadata in MongoDB
  const file = await File.create({
    name: name.trim(),
    original_name: name.trim(),
    mime_type: resolvedMime,
    size: actualSize,
    storage_key,
    checksum_sha256: checksum_sha256 || null,
    folder_id: targetFolderId,
    owner_id: req.user._id,
    is_trashed: false,
    extracted_text: extractedText,
  });

  // 6. Update user storage consumption
  user.storage_used += actualSize;
  await user.save();

  // 7. Log activity
  await logActivity({
    userId: req.user._id,
    action: "upload",
    resourceType: "file",
    resourceId: file._id,
    resourceName: file.name,
    details: { size: actualSize, mime_type: resolvedMime },
  });

  logger.info(`File recorded in MongoDB: ${file.name} (${file._id}), size: ${actualSize} bytes`);

  return res.status(201).json({
    success: true,
    message: "File uploaded and confirmed successfully",
    file,
  });
});

/**
 * @desc    Get files for current user (with advanced search by name/content, type, date, and folder filter)
 * @route   GET /api/files
 * @access  Private
 */
export const getFiles = asyncHandler(async (req, res) => {
  const { folder_id, search, type, date_range, sort } = req.query;

  const query = {
    owner_id: req.user._id,
    is_trashed: false,
  };

  // 1. Folder filter
  if (folder_id !== undefined && folder_id !== "all") {
    query.folder_id = folder_id === "null" || !folder_id ? null : folder_id;
  }

  // 2. Search query (matches filename OR extracted text content)
  if (search && search.trim()) {
    const term = search.trim();
    query.$or = [
      { name: { $regex: term, $options: "i" } },
      { extracted_text: { $regex: term, $options: "i" } },
    ];
  }

  // 3. File type category or extension filter
  if (type && type !== "all") {
    const t = type.toLowerCase();
    if (t === "documents") {
      query.$or = [
        { mime_type: { $regex: "pdf|word|sheet|excel|document|text|presentation|csv", $options: "i" } },
        { name: { $regex: "\\.(pdf|doc|docx|xls|xlsx|txt|rtf|csv|md|json)$", $options: "i" } },
      ];
    } else if (t === "images") {
      query.mime_type = { $regex: "^image/", $options: "i" };
    } else if (t === "videos") {
      query.mime_type = { $regex: "^video/", $options: "i" };
    } else if (t === "audio") {
      query.mime_type = { $regex: "^audio/", $options: "i" };
    } else if (t === "archives") {
      query.$or = [
        { mime_type: { $regex: "zip|tar|rar|7z|compressed", $options: "i" } },
        { name: { $regex: "\\.(zip|tar|gz|rar|7z)$", $options: "i" } },
      ];
    } else {
      // Specific extension filter (e.g. 'pdf')
      const sanitizedExt = t.replace(/[^a-z0-9]/g, "");
      query.name = { $regex: `\\.${sanitizedExt}$`, $options: "i" };
    }
  }

  // 4. Date range filter
  if (date_range && date_range !== "all") {
    const now = new Date();
    if (date_range === "today") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      query.created_at = { $gte: today };
    } else if (date_range === "7d") {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      query.created_at = { $gte: past7 };
    } else if (date_range === "30d") {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      query.created_at = { $gte: past30 };
    }
  }

  // 5. Sorting
  const sortMap = {
    name_asc: { name: 1 },
    name_desc: { name: -1 },
    date_asc: { created_at: 1 },
    date_desc: { created_at: -1 },
    size_asc: { size: 1 },
    size_desc: { size: -1 },
  };
  const sortCriteria = sortMap[sort] || { created_at: -1 };

  const files = await File.find(query).sort(sortCriteria);

  // If search query is present, annotate which files matched inside content
  let annotatedFiles = files.map((f) => f.toJSON());
  if (search && search.trim()) {
    const lowerTerm = search.trim().toLowerCase();
    annotatedFiles = annotatedFiles.map((f) => {
      const nameMatch = f.name.toLowerCase().includes(lowerTerm);
      const textMatch = f.extracted_text && f.extracted_text.toLowerCase().includes(lowerTerm);
      return {
        ...f,
        matched_in_content: textMatch && !nameMatch,
      };
    });
  }

  return res.status(200).json({
    success: true,
    files: annotatedFiles,
    total: annotatedFiles.length,
  });
});

/**
 * @desc    Find all duplicate files across user's vault and calculate wasted storage
 * @route   GET /api/files/duplicates
 * @access  Private
 */
export const getDuplicateFiles = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Find all active files with checksums
  const files = await File.find({
    owner_id: userId,
    is_trashed: false,
    checksum_sha256: { $ne: null },
  }).sort({ size: -1 });

  // Group by checksum
  const groups = {};
  for (const f of files) {
    const hash = f.checksum_sha256;
    if (!groups[hash]) groups[hash] = [];
    groups[hash].push(f);
  }

  // Filter groups with > 1 file
  const duplicateClusters = [];
  let totalWastedBytes = 0;
  let totalDuplicateFiles = 0;

  // Fetch all user folders to map names
  const folders = await Folder.find({ owner_id: userId, is_trashed: false }).select("name");
  const folderMap = {};
  folders.forEach((f) => (folderMap[f._id.toString()] = f.name));

  for (const [hash, fileList] of Object.entries(groups)) {
    if (fileList.length > 1) {
      const wasted = (fileList.length - 1) * fileList[0].size;
      totalWastedBytes += wasted;
      totalDuplicateFiles += fileList.length - 1;

      duplicateClusters.push({
        checksum_sha256: hash,
        file_count: fileList.length,
        size: fileList[0].size,
        wasted_bytes: wasted,
        files: fileList.map((f) => ({
          id: f._id.toString(),
          name: f.name,
          size: f.size,
          mime_type: f.mime_type,
          created_at: f.created_at,
          folder_id: f.folder_id ? f.folder_id.toString() : null,
          folder_name: f.folder_id ? folderMap[f.folder_id.toString()] || "Folder" : "Root",
        })),
      });
    }
  }

  return res.status(200).json({
    success: true,
    total_duplicate_clusters: duplicateClusters.length,
    total_duplicate_files: totalDuplicateFiles,
    total_wasted_bytes: totalWastedBytes,
    duplicates: duplicateClusters,
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

  if (isDownload) {
    await logActivity({
      userId: req.user._id,
      action: "download",
      resourceType: "file",
      resourceId: file._id,
      resourceName: file.name,
      details: { size: file.size },
    });
  }

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

  const oldName = file.name;
  file.name = name.trim();
  await file.save();

  await logActivity({
    userId: req.user._id,
    action: "rename",
    resourceType: "file",
    resourceId: file._id,
    resourceName: file.name,
    details: { old_name: oldName, new_name: file.name },
  });

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

  await logActivity({
    userId: req.user._id,
    action: "move",
    resourceType: "file",
    resourceId: file._id,
    resourceName: file.name,
    details: { target_folder_id: targetFolderId },
  });

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

  await logActivity({
    userId: req.user._id,
    action: "delete",
    resourceType: "file",
    resourceId: file._id,
    resourceName: file.name,
  });

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

  await logActivity({
    userId: req.user._id,
    action: "restore",
    resourceType: "file",
    resourceId: file._id,
    resourceName: file.name,
  });

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

  // 1. Delete all past versions from storage and MongoDB
  const versions = await FileVersion.find({ file_id: file._id });
  const versionKeys = versions.map((v) => v.storage_key).filter(Boolean);
  if (versionKeys.length > 0) {
    await deleteObjectsFromR2(versionKeys);
  }
  const totalVersionsSize = versions.reduce((sum, v) => sum + (v.size || 0), 0);
  await FileVersion.deleteMany({ file_id: file._id });

  // 2. Delete main active object from Cloudflare R2 only if no other file references it
  const otherFilesWithKey = await File.countDocuments({
    _id: { $ne: file._id },
    storage_key: file.storage_key,
  });
  if (otherFilesWithKey === 0) {
    await deleteObjectFromR2(file.storage_key);
  }

  // 3. Reduce user's storage consumption (only deduct if no other file owned by this user uses the key)
  const userOtherFilesWithKey = await File.countDocuments({
    _id: { $ne: file._id },
    owner_id: req.user._id,
    storage_key: file.storage_key,
  });
  const user = await User.findById(req.user._id);
  if (user) {
    const bytesToFree = (userOtherFilesWithKey === 0 ? file.size : 0) + totalVersionsSize;
    user.storage_used = Math.max(0, user.storage_used - bytesToFree);
    await user.save();
  }

  // 4. Remove document from MongoDB
  await File.findByIdAndDelete(file._id);

  // 5. Log activity
  await logActivity({
    userId: req.user._id,
    action: "permanent_delete",
    resourceType: "file",
    resourceId: file._id,
    resourceName: file.name,
  });

  logger.info(
    `Permanently deleted file: ${file.name} (${file._id}) and ${versions.length} versions, freed ${file.size + totalVersionsSize} bytes`
  );

  return res.status(200).json({
    success: true,
    message: "File permanently deleted",
  });
});
