import Folder from "../models/Folder.js";
import File from "../models/File.js";
import FileVersion from "../models/FileVersion.js";
import User from "../models/User.js";
import { deleteObjectsFromR2 } from "../services/r2StorageService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logger } from "../utils/logger.js";

/**
 * @desc    Get all trashed files and folders for current user
 * @route   GET /api/trash
 * @access  Private
 */
export const getTrash = asyncHandler(async (req, res) => {
  const [files, folders] = await Promise.all([
    File.find({ owner_id: req.user._id, is_trashed: true }).sort({ trashed_at: -1 }),
    Folder.find({ owner_id: req.user._id, is_trashed: true }).sort({ trashed_at: -1 }),
  ]);

  return res.status(200).json({
    success: true,
    files,
    folders,
  });
});

/**
 * @desc    Empty trash (permanently delete all trashed files from R2 and MongoDB)
 * @route   POST /api/trash/empty, DELETE /api/trash/empty
 * @access  Private
 */
export const emptyTrash = asyncHandler(async (req, res) => {
  const trashedFiles = await File.find({
    owner_id: req.user._id,
    is_trashed: true,
  });

  // Delete all objects (and their past versions) from Cloudflare R2
  const trashedFileIds = trashedFiles.map((f) => f._id);
  const versions = await FileVersion.find({ file_id: { $in: trashedFileIds } });
  const versionKeys = versions.map((v) => v.storage_key).filter(Boolean);
  const fileKeys = trashedFiles.map((f) => f.storage_key).filter(Boolean);

  // Preserve storage keys that are still referenced by active files (e.g. deduplicated copies)
  const remainingFilesWithKeys = await File.find({
    _id: { $nin: trashedFileIds },
    storage_key: { $in: fileKeys },
  }).select("storage_key");
  const preservedKeys = new Set(remainingFilesWithKeys.map((f) => f.storage_key));
  const uniqueFileKeysToDelete = fileKeys.filter((k) => !preservedKeys.has(k));

  const allKeys = [...new Set([...uniqueFileKeysToDelete, ...versionKeys])];
  if (allKeys.length > 0) {
    await deleteObjectsFromR2(allKeys);
  }

  // Remove documents from MongoDB
  await Promise.all([
    FileVersion.deleteMany({ file_id: { $in: trashedFileIds } }),
    File.deleteMany({ owner_id: req.user._id, is_trashed: true }),
    Folder.deleteMany({ owner_id: req.user._id, is_trashed: true }),
  ]);

  // Recalculate user storage usage accurately (counting distinct storage keys for deduplicated files)
  const activeFiles = await File.find({
    owner_id: req.user._id,
    is_trashed: false,
  });
  const seenKeys = new Set();
  let totalUsed = 0;
  for (const f of activeFiles) {
    if (!seenKeys.has(f.storage_key)) {
      seenKeys.add(f.storage_key);
      totalUsed += f.size || 0;
    }
  }

  const activeVersions = await FileVersion.find({
    file_id: { $in: activeFiles.map((f) => f._id) },
  });
  const versionsSize = activeVersions.reduce((acc, v) => acc + (v.size || 0), 0);
  totalUsed += versionsSize;

  const user = await User.findById(req.user._id);
  if (user) {
    user.storage_used = totalUsed;
    await user.save();
  }

  logger.info(`Emptied trash for user ${req.user.email}, ${trashedFiles.length} files permanently deleted`);

  return res.status(200).json({
    success: true,
    message: "Trash emptied successfully",
  });
});

