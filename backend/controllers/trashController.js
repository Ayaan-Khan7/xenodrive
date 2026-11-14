import Folder from "../models/Folder.js";
import File from "../models/File.js";
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

  // Delete all objects from Cloudflare R2
  const storageKeys = trashedFiles.map((f) => f.storage_key).filter(Boolean);
  if (storageKeys.length > 0) {
    await deleteObjectsFromR2(storageKeys);
  }

  // Remove documents from MongoDB
  await Promise.all([
    File.deleteMany({ owner_id: req.user._id, is_trashed: true }),
    Folder.deleteMany({ owner_id: req.user._id, is_trashed: true }),
  ]);

  // Recalculate user storage usage accurately
  const activeFiles = await File.find({
    owner_id: req.user._id,
    is_trashed: false,
  });
  const totalUsed = activeFiles.reduce((acc, f) => acc + (f.size || 0), 0);

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

