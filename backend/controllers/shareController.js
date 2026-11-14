import crypto from "crypto";
import Share from "../models/Share.js";
import File from "../models/File.js";
import Folder from "../models/Folder.js";
import User from "../models/User.js";
import { generatePresignedDownloadUrl } from "../services/r2StorageService.js";
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
 * @desc    Create a share link for a file or folder
 * @route   POST /api/shares
 * @access  Private
 */
export const createShare = asyncHandler(async (req, res, next) => {
  const { resource_id, resource_type = "file", permission = "download", expires_at } = req.body;

  // Check if active share already exists for this resource
  let existingShare = await Share.findOne({
    resource_id,
    resource_type,
    owner_id: req.user._id,
  });

  if (existingShare) {
    return res.status(200).json({
      success: true,
      share: existingShare,
      share_link: existingShare,
      is_existing: true,
    });
  }

  // Generate unique token
  const token = `sh_${crypto.randomBytes(16).toString("hex")}`;

  const share = await Share.create({
    token,
    resource_type,
    resource_id,
    owner_id: req.user._id,
    permission,
    expires_at: expires_at || null,
    access_count: 0,
  });

  return res.status(201).json({
    success: true,
    share,
    share_link: share,
    is_existing: false,
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

  await Share.findByIdAndDelete(share._id);

  return res.status(200).json({
    success: true,
    message: "Share link revoked",
  });
});

/**
 * @desc    Resolve public shared link access
 * @route   GET /api/shares/access/:token
 * @access  Public
 */
export const accessSharedResource = asyncHandler(async (req, res, next) => {
  const { token } = req.params;

  const share = await Share.findOne({ token });

  if (!share) {
    return next(new AppError("Shared link not found or has expired", 404));
  }

  // Check expiration
  if (share.expires_at && new Date() > new Date(share.expires_at)) {
    return next(new AppError("This shared link has expired", 410));
  }

  // Increment access count
  share.access_count = (share.access_count || 0) + 1;
  await share.save();

  const owner = await User.findById(share.owner_id).select("name email");

  if (share.resource_type === "file") {
    const file = await File.findOne({ _id: share.resource_id, is_trashed: false });

    if (!file) {
      return next(new AppError("Shared file no longer exists or has been moved to trash", 404));
    }

    // Generate presigned download URL from Cloudflare R2
    const previewUrl = await generatePresignedDownloadUrl({
      key: file.storage_key,
      fileName: file.name,
      isDownload: share.permission === "download",
    });

    return res.status(200).json({
      success: true,
      share,
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
      share,
      folder,
      files,
      resource_type: "folder",
      permission: share.permission,
      owner,
    });
  }
});

