import File from "../models/File.js";
import Folder from "../models/Folder.js";
import User from "../models/User.js";
import ActivityLog from "../models/ActivityLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/apiResponse.js";

/**
 * Categorize MIME type into friendly category
 */
const getCategoryForMime = (mime = "") => {
  if (mime.startsWith("image/")) return "images";
  if (mime.startsWith("video/")) return "videos";
  if (mime.startsWith("audio/")) return "audio";
  if (
    mime.includes("pdf") ||
    mime.includes("word") ||
    mime.includes("document") ||
    mime.includes("sheet") ||
    mime.includes("excel") ||
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    mime.startsWith("text/")
  ) {
    return "documents";
  }
  if (
    mime.includes("zip") ||
    mime.includes("tar") ||
    mime.includes("rar") ||
    mime.includes("7z") ||
    mime.includes("compressed")
  ) {
    return "archives";
  }
  return "others";
};

/**
 * @desc    Get dashboard statistics, storage analytics, largest files, trends, and activity logs
 * @route   GET /api/dashboard/stats
 * @access  Private
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // 1. Fetch user data for storage limits
  const user = await User.findById(userId);

  // 2. Fetch parallel aggregates
  const [
    totalFiles,
    totalFolders,
    recentFiles,
    allActiveFiles,
    largestFilesRaw,
    userFolders,
    loggedActivities,
  ] = await Promise.all([
    File.countDocuments({ owner_id: userId, is_trashed: false }),
    Folder.countDocuments({ owner_id: userId, is_trashed: false }),
    File.find({ owner_id: userId, is_trashed: false })
      .sort({ created_at: -1 })
      .limit(6),
    File.find({ owner_id: userId, is_trashed: false }).select("size mime_type checksum_sha256 created_at"),
    File.find({ owner_id: userId, is_trashed: false })
      .sort({ size: -1 })
      .limit(6),
    Folder.find({ owner_id: userId, is_trashed: false }).select("name"),
    ActivityLog.find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(10),
  ]);

  // Map folder ID to folder name
  const folderMap = {};
  userFolders.forEach((f) => (folderMap[f._id.toString()] = f.name));

  // 3. Compute file type distribution & duplicate detection metrics
  const distribution = {
    documents: { count: 0, size: 0, label: "Documents", color: "bg-red-500" },
    images: { count: 0, size: 0, label: "Images", color: "bg-emerald-500" },
    videos: { count: 0, size: 0, label: "Videos", color: "bg-purple-500" },
    audio: { count: 0, size: 0, label: "Audio", color: "bg-pink-500" },
    archives: { count: 0, size: 0, label: "Archives", color: "bg-amber-500" },
    others: { count: 0, size: 0, label: "Others", color: "bg-blue-500" },
  };

  const checksumGroups = {};
  let totalCalculatedBytes = 0;

  for (const file of allActiveFiles) {
    const category = getCategoryForMime(file.mime_type || "");
    const size = file.size || 0;
    distribution[category].count += 1;
    distribution[category].size += size;
    totalCalculatedBytes += size;

    if (file.checksum_sha256) {
      if (!checksumGroups[file.checksum_sha256]) {
        checksumGroups[file.checksum_sha256] = [];
      }
      checksumGroups[file.checksum_sha256].push(size);
    }
  }

  // Calculate duplicate stats
  let totalDuplicateFiles = 0;
  let totalWastedBytes = 0;
  for (const sizes of Object.values(checksumGroups)) {
    if (sizes.length > 1) {
      totalDuplicateFiles += sizes.length - 1;
      totalWastedBytes += (sizes.length - 1) * sizes[0];
    }
  }

  // 4. Compute storage metrics
  const storageUsed = user ? user.storage_used : totalCalculatedBytes;
  const storageLimit = user ? user.storage_limit : 1073741824; // 1 GB default
  const storageAvailable = Math.max(0, storageLimit - storageUsed);
  const storagePercent = Math.min(
    100,
    parseFloat(((storageUsed / storageLimit) * 100).toFixed(1))
  );

  // 5. Daily Storage Activity Trend (last 7 days)
  const now = new Date();
  const storageActivity = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayLabel = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const dayStart = d.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    let dayBytes = 0;
    let dayCount = 0;
    for (const file of allActiveFiles) {
      const fileTime = new Date(file.created_at).getTime();
      if (fileTime >= dayStart && fileTime < dayEnd) {
        dayBytes += file.size || 0;
        dayCount += 1;
      }
    }

    storageActivity.push({
      date: dayLabel,
      bytes: dayBytes,
      files_count: dayCount,
    });
  }

  // 6. Format Largest Files with folder context
  const largestFiles = largestFilesRaw.map((f) => ({
    id: f._id.toString(),
    name: f.name,
    size: f.size,
    mime_type: f.mime_type,
    created_at: f.created_at,
    folder_id: f.folder_id ? f.folder_id.toString() : null,
    folder_name: f.folder_id ? folderMap[f.folder_id.toString()] || "Folder" : "Root",
  }));

  // 7. Recent activity log (combining ActivityLog with fallback)
  let recentActivity = [];
  if (loggedActivities && loggedActivities.length > 0) {
    recentActivity = loggedActivities.map((act) => ({
      id: act._id.toString(),
      type: act.action,
      title: `${act.action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}: ${act.resource_name}`,
      resource_id: act.resource_id ? act.resource_id.toString() : null,
      resource_type: act.resource_type,
      details: act.details || {},
      timestamp: act.created_at,
    }));
  } else {
    // Fallback if no logs yet
    recentActivity = recentFiles.map((f) => ({
      id: `act_${f._id}`,
      type: "upload",
      title: `Uploaded ${f.name}`,
      resource_id: f._id.toString(),
      resource_type: "file",
      details: { size: f.size },
      timestamp: f.created_at,
    }));
  }

  const stats = {
    total_files: totalFiles,
    total_folders: totalFolders,
    storage_used: storageUsed,
    storage_limit: storageLimit,
    storage_available: storageAvailable,
    storage_percent: storagePercent,
    distribution,
    largest_files: largestFiles,
    recent_files: recentFiles,
    storage_activity: storageActivity,
    duplicate_summary: {
      duplicate_files_count: totalDuplicateFiles,
      wasted_bytes: totalWastedBytes,
    },
    recent_activity: recentActivity,
  };

  return ApiResponse.success(res, stats, "Dashboard statistics retrieved successfully");
});
