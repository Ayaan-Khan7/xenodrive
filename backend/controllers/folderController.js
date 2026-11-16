import mongoose from "mongoose";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import User from "../models/User.js";
import { deleteObjectsFromR2 } from "../services/r2StorageService.js";
import { logActivity } from "../utils/activityLogger.js";
import { AppError } from "../utils/appError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logger } from "../utils/logger.js";

/**
 * @desc    Get folders for current user (optionally filtered by parent_id)
 * @route   GET /api/folders
 * @access  Private
 */
export const getFolders = asyncHandler(async (req, res) => {
  const query = {
    owner_id: req.user._id,
    is_trashed: false,
  };

  if (req.query.parent_id !== undefined) {
    const raw = req.query.parent_id;
    query.parent_id = raw === "null" || !raw ? null : raw;
  }

  const folders = await Folder.find(query).sort({ name: 1 });

  return res.status(200).json({
    success: true,
    folders,
  });
});

/**
 * @desc    Get folder by ID with breadcrumb navigation trail
 * @route   GET /api/folders/:id
 * @access  Private
 */
export const getFolderById = asyncHandler(async (req, res, next) => {
  const folder = await Folder.findOne({
    _id: req.params.id,
    owner_id: req.user._id,
  });

  if (!folder) {
    return next(new AppError("Folder not found", 404));
  }

  // Calculate breadcrumbs by climbing ancestor path
  const breadcrumbs = [];
  if (folder.path && folder.path.length > 0) {
    const ancestors = await Folder.find({
      _id: { $in: folder.path },
      owner_id: req.user._id,
    });

    // Sort ancestors according to order in path array
    folder.path.forEach((ancestorId) => {
      const match = ancestors.find((a) => a._id.toString() === ancestorId.toString());
      if (match) {
        breadcrumbs.push({
          id: match._id.toString(),
          name: match.name,
        });
      }
    });
  }

  return res.status(200).json({
    success: true,
    folder,
    breadcrumbs,
  });
});

/**
 * @desc    Create a new folder
 * @route   POST /api/folders
 * @access  Private
 */
export const createFolder = asyncHandler(async (req, res, next) => {
  const { name, parent_id } = req.body;
  const parentId = parent_id && parent_id !== "null" ? parent_id : null;

  let parentPath = [];
  if (parentId) {
    const parentFolder = await Folder.findOne({
      _id: parentId,
      owner_id: req.user._id,
      is_trashed: false,
    });

    if (!parentFolder) {
      return next(new AppError("Parent folder not found or is in trash", 404));
    }

    parentPath = [...(parentFolder.path || []), parentFolder._id];
  }

  const folder = await Folder.create({
    name: name.trim(),
    parent_id: parentId,
    owner_id: req.user._id,
    path: parentPath,
    is_trashed: false,
  });

  await logActivity({
    userId: req.user._id,
    action: "create_folder",
    resourceType: "folder",
    resourceId: folder._id,
    resourceName: folder.name,
  });

  return res.status(201).json({
    success: true,
    folder,
  });
});

/**
 * @desc    Rename folder
 * @route   PATCH /api/folders/:id/rename
 * @access  Private
 */
export const renameFolder = asyncHandler(async (req, res, next) => {
  const { name } = req.body;

  const folder = await Folder.findOne({
    _id: req.params.id,
    owner_id: req.user._id,
  });

  if (!folder) {
    return next(new AppError("Folder not found", 404));
  }

  folder.name = name.trim();
  await folder.save();

  await logActivity({
    userId: req.user._id,
    action: "rename",
    resourceType: "folder",
    resourceId: folder._id,
    resourceName: folder.name,
  });

  return res.status(200).json({
    success: true,
    folder,
  });
});

/**
 * @desc    Move folder to target parent (with circular reference check)
 * @route   PATCH /api/folders/:id/move
 * @access  Private
 */
export const moveFolder = asyncHandler(async (req, res, next) => {
  const target = req.body.target_parent !== undefined ? req.body.target_parent : req.body.target_parent_id;
  const targetParentId = target === "null" || !target ? null : target;

  const folder = await Folder.findOne({
    _id: req.params.id,
    owner_id: req.user._id,
  });

  if (!folder) {
    return next(new AppError("Folder not found", 404));
  }

  // Prevent moving into itself
  if (targetParentId && targetParentId.toString() === folder._id.toString()) {
    return next(new AppError("Cannot move a folder into itself", 400));
  }

  let newPath = [];
  if (targetParentId) {
    const targetParent = await Folder.findOne({
      _id: targetParentId,
      owner_id: req.user._id,
      is_trashed: false,
    });

    if (!targetParent) {
      return next(new AppError("Target parent folder not found", 404));
    }

    // Circular reference prevention: target parent cannot have `folder._id` in its path
    const targetPathStrings = (targetParent.path || []).map((p) => p.toString());
    if (targetPathStrings.includes(folder._id.toString())) {
      return next(new AppError("Cannot move a folder into its own subfolder", 400));
    }

    newPath = [...(targetParent.path || []), targetParent._id];
  }

  const oldPathLength = (folder.path || []).length;
  folder.parent_id = targetParentId;
  folder.path = newPath;
  await folder.save();

  // Update paths of all descendant folders
  const descendants = await Folder.find({
    owner_id: req.user._id,
    path: folder._id,
  });

  for (const desc of descendants) {
    const sliceIndex = desc.path.findIndex((p) => p.toString() === folder._id.toString());
    if (sliceIndex !== -1) {
      const remainingPath = desc.path.slice(sliceIndex);
      desc.path = [...newPath, ...remainingPath];
      await desc.save();
    }
  }

  await logActivity({
    userId: req.user._id,
    action: "move",
    resourceType: "folder",
    resourceId: folder._id,
    resourceName: folder.name,
  });

  return res.status(200).json({
    success: true,
    folder,
  });
});

/**
 * @desc    Move folder and all its contents to trash
 * @route   DELETE /api/folders/:id
 * @access  Private
 */
export const trashFolder = asyncHandler(async (req, res, next) => {
  const folder = await Folder.findOne({
    _id: req.params.id,
    owner_id: req.user._id,
  });

  if (!folder) {
    return next(new AppError("Folder not found", 404));
  }

  const now = new Date();
  folder.is_trashed = true;
  folder.trashed_at = now;
  await folder.save();

  // Find all descendant folders
  const descendantFolders = await Folder.find({
    owner_id: req.user._id,
    path: folder._id,
  });

  const folderIds = [folder._id, ...descendantFolders.map((d) => d._id)];

  // Trash all descendant folders
  await Folder.updateMany(
    { _id: { $in: folderIds } },
    { is_trashed: true, trashed_at: now }
  );

  // Trash all files inside these folders
  await File.updateMany(
    { owner_id: req.user._id, folder_id: { $in: folderIds } },
    { is_trashed: true, trashed_at: now }
  );

  await logActivity({
    userId: req.user._id,
    action: "delete",
    resourceType: "folder",
    resourceId: folder._id,
    resourceName: folder.name,
  });

  return res.status(200).json({
    success: true,
    message: "Folder and its contents moved to trash",
  });
});

/**
 * @desc    Restore folder and its contents from trash
 * @route   POST /api/folders/:id/restore
 * @access  Private
 */
export const restoreFolder = asyncHandler(async (req, res, next) => {
  const folder = await Folder.findOne({
    _id: req.params.id,
    owner_id: req.user._id,
  });

  if (!folder) {
    return next(new AppError("Folder not found", 404));
  }

  folder.is_trashed = false;
  folder.trashed_at = null;
  await folder.save();

  // Find all descendant folders
  const descendantFolders = await Folder.find({
    owner_id: req.user._id,
    path: folder._id,
  });

  const folderIds = [folder._id, ...descendantFolders.map((d) => d._id)];

  await Folder.updateMany(
    { _id: { $in: folderIds } },
    { is_trashed: false, trashed_at: null }
  );

  await File.updateMany(
    { owner_id: req.user._id, folder_id: { $in: folderIds } },
    { is_trashed: false, trashed_at: null }
  );

  await logActivity({
    userId: req.user._id,
    action: "restore",
    resourceType: "folder",
    resourceId: folder._id,
    resourceName: folder.name,
  });

  return res.status(200).json({
    success: true,
    folder,
  });
});

/**
 * @desc    Permanently delete folder, subfolders, and files from R2 & MongoDB
 * @route   DELETE /api/folders/:id/permanent
 * @access  Private
 */
export const permanentDeleteFolder = asyncHandler(async (req, res, next) => {
  const folder = await Folder.findOne({
    _id: req.params.id,
    owner_id: req.user._id,
  });

  if (!folder) {
    return next(new AppError("Folder not found", 404));
  }

  // Find all descendant folders
  const descendantFolders = await Folder.find({
    owner_id: req.user._id,
    path: folder._id,
  });

  const allFolderIds = [folder._id, ...descendantFolders.map((d) => d._id)];

  // Find all files inside these folders
  const filesToDelete = await File.find({
    owner_id: req.user._id,
    folder_id: { $in: allFolderIds },
  });

  // Delete all files from Cloudflare R2 (preserving keys referenced by other active files)
  const fileIdsToDelete = filesToDelete.map((f) => f._id);
  const storageKeys = filesToDelete.map((f) => f.storage_key).filter(Boolean);

  const remainingFilesWithKeys = await File.find({
    _id: { $nin: fileIdsToDelete },
    storage_key: { $in: storageKeys },
  }).select("storage_key");
  const preservedKeys = new Set(remainingFilesWithKeys.map((f) => f.storage_key));
  const uniqueKeysToDelete = storageKeys.filter((k) => !preservedKeys.has(k));

  if (uniqueKeysToDelete.length > 0) {
    await deleteObjectsFromR2(uniqueKeysToDelete);
  }

  // Recalculate user storage consumption accurately
  await File.deleteMany({ _id: { $in: fileIdsToDelete } });
  await Folder.deleteMany({ _id: { $in: allFolderIds } });

  const remainingUserFiles = await File.find({
    owner_id: req.user._id,
    is_trashed: false,
  });
  const seenUserKeys = new Set();
  let newStorageUsed = 0;
  for (const f of remainingUserFiles) {
    if (!seenUserKeys.has(f.storage_key)) {
      seenUserKeys.add(f.storage_key);
      newStorageUsed += f.size || 0;
    }
  }

  const user = await User.findById(req.user._id);
  if (user) {
    user.storage_used = newStorageUsed;
    await user.save();
  }

  await logActivity({
    userId: req.user._id,
    action: "permanent_delete",
    resourceType: "folder",
    resourceId: folder._id,
    resourceName: folder.name,
  });

  logger.info(
    `Permanently deleted folder ${folder.name} (${allFolderIds.length} folders, ${filesToDelete.length} files, freed ${totalFreedBytes} bytes)`
  );

  return res.status(200).json({
    success: true,
    message: "Folder permanently deleted",
  });
});

