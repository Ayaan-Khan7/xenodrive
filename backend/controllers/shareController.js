import crypto from "crypto";
import bcrypt from "bcryptjs";
import Share from "../models/Share.js";
import File from "../models/File.js";
import Folder from "../models/Folder.js";
import User from "../models/User.js";
import { generatePresignedDownloadUrl } from "../services/r2StorageService.js";
import { logActivity } from "../utils/activityLogger.js";
import { AppError } from "../utils/appError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * @desc    Get all active share links created by current user
 * @route   GET /api/shares
 * @access  Private
 */
export const getShares = asyncHandler(async (req, res) => {
  const shares = await Share.find({ owner_id: req.user._id }).sort({ created_at: -1 });

  // Enrich with resource info
  const enriched = await Promise.all(
    shares.map(async (share) => {
      const shareObj = share.toJSON();

      if (share.resource_type === "file") {
        const file = await File.findOne({ _id: share.resource_id, is_trashed: false });
        shareObj.resource = file
          ? {
              id: file._id.toString(),
              name: file.name,
              mime_type: file.mime_type,
              size: file.size,
            }
          : { id: share.resource_id.toString(), name: "Unavailable File", mime_type: null };
      } else {
        const folder = await Folder.findOne({ _id: share.resource_id, is_trashed: false });
        shareObj.resource = folder
          ? {
              id: folder._id.toString(),
              name: folder.name,
              mime_type: null,
            }
          : { id: share.resource_id.toString(), name: "Unavailable Folder", mime_type: null };
      }

      return shareObj;
    })
  );

  return res.status(200).json({
    success: true,
    share_links: enriched,
    shares: enriched,
  });
});

/**
 * @desc    Create or update a share link for a file or folder
 * @route   POST /api/shares
 * @access  Private
 */
export const createShare = asyncHandler(async (req, res, next) => {
  const {
    resource_id,
    resource_type = "file",
    permission = "download",
    expires_at,
    password,
    remove_password,
  } = req.body;

  // 1. Verify resource ownership and non-trash status
  if (resource_type === "file") {
    const file = await File.findOne({ _id: resource_id, owner_id: req.user._id, is_trashed: false });
    if (!file) return next(new AppError("File not found or in trash", 404));
  } else {
    const folder = await Folder.findOne({ _id: resource_id, owner_id: req.user._id, is_trashed: false });
    if (!folder) return next(new AppError("Folder not found or in trash", 404));
  }

  // 2. Hash password if provided
  let passwordHash = null;
  let isPasswordProtected = false;
  if (password && typeof password === "string" && password.trim()) {
    passwordHash = await bcrypt.hash(password.trim(), 10);
    isPasswordProtected = true;
  }

  // 3. Validate expiration date if provided
  let validatedExpiresAt = null;
  if (expires_at) {
    const expDate = new Date(expires_at);
    if (isNaN(expDate.getTime())) {
      return next(new AppError("Invalid expiration date format", 400));
    }
    if (expDate <= new Date()) {
      return next(new AppError("Expiration date must be in the future", 400));
    }
    validatedExpiresAt = expDate;
  }

  // 4. Check if active share already exists for this resource
  let existingShare = await Share.findOne({
    resource_id,
    resource_type,
    owner_id: req.user._id,
  });

  if (existingShare) {
    existingShare.permission = permission;
    existingShare.expires_at = validatedExpiresAt;

    if (isPasswordProtected) {
      existingShare.password_hash = passwordHash;
      existingShare.is_password_protected = true;
    } else if (remove_password) {
      existingShare.password_hash = null;
      existingShare.is_password_protected = false;
    }

    await existingShare.save();

    const resourceName = await getResourceName(existingShare.resource_type, existingShare.resource_id);
    await logActivity({
      userId: req.user._id,
      action: "share_create",
      resourceType: "share",
      resourceId: existingShare._id,
      resourceName,
      details: { permission: existingShare.permission, is_password_protected: existingShare.is_password_protected },
    });

    return res.status(200).json({
      success: true,
      share: existingShare,
      share_link: existingShare,
      is_existing: true,
      message: "Share link updated successfully",
    });
  }

  // 5. Generate unique token
  const token = `sh_${crypto.randomBytes(16).toString("hex")}`;

  const share = await Share.create({
    token,
    resource_type,
    resource_id,
    owner_id: req.user._id,
    permission,
    expires_at: validatedExpiresAt,
    password_hash: passwordHash,
    is_password_protected: isPasswordProtected,
    access_count: 0,
    download_count: 0,
  });

  const resourceName = await getResourceName(share.resource_type, share.resource_id);
  await logActivity({
    userId: req.user._id,
    action: "share_create",
    resourceType: "share",
    resourceId: share._id,
    resourceName,
    details: { permission: share.permission, is_password_protected: share.is_password_protected },
  });

  return res.status(201).json({
    success: true,
    share,
    share_link: share,
    is_existing: false,
    message: "Share link created successfully",
  });
});

/**
 * @desc    Revoke share link
 * @route   DELETE /api/shares/:id
 * @access  Private
 */
export const revokeShare = asyncHandler(async (req, res, next) => {
  const share = await Share.findOne({
    _id: req.params.id,
    owner_id: req.user._id,
  });

  if (!share) {
    return next(new AppError("Share link not found", 404));
  }

  const resourceName = await getResourceName(share.resource_type, share.resource_id);
  await Share.findByIdAndDelete(share._id);

  await logActivity({
    userId: req.user._id,
    action: "share_revoke",
    resourceType: "share",
    resourceId: share._id,
    resourceName,
  });

  return res.status(200).json({
    success: true,
    message: "Share link revoked successfully",
  });
});

/**
 * Helper to fetch resource title/name for public challenge response
 */
const getResourceName = async (resourceType, resourceId) => {
  if (resourceType === "file") {
    const file = await File.findById(resourceId).select("name");
    return file ? file.name : "Shared File";
  }
  const folder = await Folder.findById(resourceId).select("name");
  return folder ? folder.name : "Shared Folder";
};

/**
 * @desc    Resolve public shared link access (supports password protection & expiration)
 * @route   GET /api/shares/access/:token, POST /api/shares/access/:token
 * @access  Public
 */
export const accessSharedResource = asyncHandler(async (req, res, next) => {
  const { token } = req.params;
  const providedPassword =
    req.body?.password || req.query?.password || req.headers["x-share-password"];

  const share = await Share.findOne({ token });

  if (!share) {
    return next(new AppError("Shared link not found or has been revoked", 404));
  }

  // 1. Check expiration
  if (share.expires_at && new Date() > new Date(share.expires_at)) {
    return res.status(410).json({
      success: false,
      is_expired: true,
      error: "This shared link has expired.",
    });
  }

  // 2. Check password protection
  if (share.is_password_protected && share.password_hash) {
    const resourceName = await getResourceName(share.resource_type, share.resource_id);

    if (!providedPassword) {
      return res.status(401).json({
        success: false,
        is_password_required: true,
        resource_name: resourceName,
        resource_type: share.resource_type,
        message: "This link is password protected. Please enter the password to view.",
      });
    }

    const isMatch = await bcrypt.compare(providedPassword, share.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        is_password_required: true,
        resource_name: resourceName,
        resource_type: share.resource_type,
        error: "Incorrect password. Please try again.",
      });
    }
  }

  // 3. Track access count
  share.access_count = (share.access_count || 0) + 1;
  await share.save();

  const owner = await User.findById(share.owner_id).select("name email");

  if (share.resource_type === "file") {
    const file = await File.findOne({ _id: share.resource_id, is_trashed: false });

    if (!file) {
      return next(new AppError("Shared file no longer exists or has been moved to trash", 404));
    }

    // Generate secure temporary presigned URL from Cloudflare R2
    const previewUrl = await generatePresignedDownloadUrl({
      key: file.storage_key,
      fileName: file.name,
      isDownload: false,
    });

    return res.status(200).json({
      success: true,
      share: share.toJSON(),
      file,
      preview_url: previewUrl,
      url: previewUrl,
      resource_type: "file",
      permission: share.permission,
      owner,
    });
  } else {
    const folder = await Folder.findOne({ _id: share.resource_id, is_trashed: false });

    if (!folder) {
      return next(new AppError("Shared folder no longer exists or has been moved to trash", 404));
    }

    const files = await File.find({ folder_id: folder._id, is_trashed: false });

    return res.status(200).json({
      success: true,
      share: share.toJSON(),
      folder,
      files,
      resource_type: "folder",
      permission: share.permission,
      owner,
    });
  }
});

/**
 * @desc    Generate download URL and track download count for shared file
 * @route   GET /api/shares/access/:token/download, POST /api/shares/access/:token/download
 * @access  Public
 */
export const downloadSharedResource = asyncHandler(async (req, res, next) => {
  const { token } = req.params;
  const providedPassword =
    req.body?.password || req.query?.password || req.headers["x-share-password"];

  const share = await Share.findOne({ token });

  if (!share) {
    return next(new AppError("Shared link not found or has been revoked", 404));
  }

  // 1. Check expiration
  if (share.expires_at && new Date() > new Date(share.expires_at)) {
    return res.status(410).json({
      success: false,
      is_expired: true,
      error: "This shared link has expired.",
    });
  }

  // 2. Check permission
  if (share.permission !== "download") {
    return next(new AppError("Downloads are disabled for this shared link (Read-Only access)", 403));
  }

  // 3. Check password
  if (share.is_password_protected && share.password_hash) {
    if (!providedPassword) {
      return res.status(401).json({
        success: false,
        is_password_required: true,
        error: "Password required to download this file.",
      });
    }

    const isMatch = await bcrypt.compare(providedPassword, share.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        is_password_required: true,
        error: "Incorrect password.",
      });
    }
  }

  if (share.resource_type !== "file") {
    return next(new AppError("Direct download endpoint only supports single file shares", 400));
  }

  const file = await File.findOne({ _id: share.resource_id, is_trashed: false });
  if (!file) {
    return next(new AppError("File no longer exists or in trash", 404));
  }

  // 4. Increment download count
  share.download_count = (share.download_count || 0) + 1;
  await share.save();

  // 5. Generate secure temporary presigned download URL
  const downloadUrl = await generatePresignedDownloadUrl({
    key: file.storage_key,
    fileName: file.name,
    isDownload: true,
  });

  return res.status(200).json({
    success: true,
    download_url: downloadUrl,
    file_name: file.name,
    file_size: file.size,
  });
});
