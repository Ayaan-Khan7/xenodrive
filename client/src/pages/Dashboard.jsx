import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  FilesIcon,
  FolderIcon,
  HardDriveIcon,
  DatabaseIcon,
  ArrowUpRightIcon,
  ClockIcon,
  UploadIcon,
  DownloadIcon,
  FolderPlusIcon,
  FileTextIcon,
  ImageIcon,
  FilmIcon,
  MusicIcon,
  FileArchiveIcon,
  FileIcon,
  SparklesIcon,
  Share2Icon,
  RotateCcwIcon,
  Trash2Icon,
  GitBranchIcon,
  TrendingUpIcon,
} from "lucide-react";
import api from "../config/api";
import { formatBytes, getFileIcon } from "../assets/assets";
import { useApp } from "../context/appcontext";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { ProgressBar } from "../components/ui/ProgressBar";
import { PreviewModal } from "../components/modals/PreviewModal";
import { DuplicateModal } from "../components/modals/DuplicateModal";
import toast from "react-hot-toast";

const categoryIcons = {
  documents: FileTextIcon,
  images: ImageIcon,
  videos: FilmIcon,
  audio: MusicIcon,
  archives: FileArchiveIcon,
  others: FileIcon,
};

const actionIcons = {
  upload: UploadIcon,
  download: DownloadIcon,
  delete: Trash2Icon,
  permanent_delete: Trash2Icon,
  restore: RotateCcwIcon,
  create_folder: FolderPlusIcon,
  share_create: Share2Icon,
  share_revoke: Share2Icon,
  version_upload: GitBranchIcon,
  version_restore: RotateCcwIcon,
  rename: FileTextIcon,
  move: FolderIcon,
};

const Dashboard = () => {
  const { user, refreshUser } = useApp();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/api/dashboard/stats");
      setStats(data.data || data);
    } catch {
      toast.error("Failed to load dashboard statistics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleDownload = async (file) => {
    try {
      const fileId = file.id || file._id;
      const { data } = await api.get(`/api/files/${fileId}/preview?download=true`);
      const url = data.preview_url || data.url;
      if (url) {
        window.open(url, "_blank");
      } else {
        toast.error("Download URL unavailable");
      }
    } catch {
      toast.error("Failed to download file");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  const distribution = stats?.distribution || {};
  const largestFiles = stats?.largest_files || [];
  const recentFiles = stats?.recent_files || [];
  const storageActivity = stats?.storage_activity || [];
  const recentActivity = stats?.recent_activity || [];
  const duplicateSummary = stats?.duplicate_summary || { duplicate_files_count: 0, wasted_bytes: 0 };

  // Calculate highest day in activity trend for proportional bar heights
  const maxDayBytes = Math.max(1, ...storageActivity.map((d) => d.bytes || 0));

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* ── Welcome Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, <span className="font-medium text-slate-800">{user?.name || "User"}</span>! Here is your cloud storage analytics.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="secondary"
            icon={SparklesIcon}
            size="md"
            onClick={() => setShowDuplicateModal(true)}
          >
            Duplicate Optimizer
          </Button>
          <Link to="/">
            <Button variant="primary" icon={ArrowUpRightIcon} size="md">
              Go to My Drive
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Metric Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Files */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shrink-0">
            <FilesIcon className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total Files
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {stats?.total_files ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">Across all folders</p>
          </div>
        </div>

        {/* Total Folders */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <FolderIcon className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total Folders
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {stats?.total_folders ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">Organized hierarchy</p>
          </div>
        </div>

        {/* Storage Used */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <HardDriveIcon className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Storage Used
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {formatBytes(stats?.storage_used || 0)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {stats?.storage_percent || 0}% of quota
            </p>
          </div>
        </div>

        {/* Storage Available */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <DatabaseIcon className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Available Space
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {formatBytes(stats?.storage_available || 0)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              Quota: {formatBytes(stats?.storage_limit || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Duplicate Storage Alert Banner (if duplicates exist) ── */}
      {duplicateSummary.duplicate_files_count > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-orange-50/70 border border-orange-200 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0">
              <SparklesIcon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-orange-950">
                {duplicateSummary.duplicate_files_count} Duplicate File{duplicateSummary.duplicate_files_count !== 1 ? "s" : ""} Detected ({formatBytes(duplicateSummary.wasted_bytes)} Wasted)
              </p>
              <p className="text-xs text-orange-800/80 mt-0.5">
                Our cryptographic deduplication scanner identified identical files. Reclaim space instantly.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowDuplicateModal(true)}
            className="shrink-0"
          >
            Review & Clean Duplicates
          </Button>
        </div>
      )}

      {/* ── Storage Consumption & Daily Activity Trends Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Total Utilization Progress Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-900">Storage Consumption</span>
            <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              {stats?.storage_percent || 0}% Used
            </span>
          </div>
          <ProgressBar progress={stats?.storage_percent || 0} color="bg-orange-600" />
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>{formatBytes(stats?.storage_used || 0)} used</span>
            <span>{formatBytes(stats?.storage_limit || 0)} limit</span>
          </div>
          <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
            Enterprise cloud storage powered by Cloudflare R2 S3 API.
          </p>
        </div>

        {/* Daily Storage Activity Trend Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUpIcon className="size-4 text-orange-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                7-Day Storage Ingestion Trend
              </h2>
            </div>
            <span className="text-xs text-slate-400">Daily uploads</span>
          </div>

          <div className="grid grid-cols-7 gap-2 pt-2 items-end h-36">
            {storageActivity.map((day, idx) => {
              const heightPercent = day.bytes > 0 ? Math.max(15, Math.round((day.bytes / maxDayBytes) * 100)) : 6;
              return (
                <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                  <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    {formatBytes(day.bytes)}
                  </span>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      day.bytes > 0
                        ? "bg-orange-500 hover:bg-orange-600"
                        : "bg-slate-100"
                    }`}
                    title={`${day.date}: ${formatBytes(day.bytes)} (${day.files_count} files)`}
                  />
                  <span className="text-[10px] text-slate-400 truncate w-full text-center">
                    {day.date.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Two Column Layout: File Type Distribution & Activity Log ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* File Type Distribution */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              File Type Distribution
            </h2>
            <span className="text-xs text-slate-400">By category</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(distribution).map(([key, item]) => {
              const Icon = categoryIcons[key] || FileIcon;
              const percent = stats?.storage_used
                ? Math.round((item.size / stats.storage_used) * 100)
                : 0;

              return (
                <div
                  key={key}
                  className="flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-100 bg-slate-50/50"
                >
                  <div className="size-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <Icon className="size-5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{item.label}</span>
                      <span className="text-slate-500">{formatBytes(item.size)}</span>
                    </div>
                    <ProgressBar progress={percent} color={item.color} />
                    <p className="text-[11px] text-slate-400">
                      {item.count} {item.count === 1 ? "file" : "files"} ({percent}%)
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity Log */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Recent Activity
            </h2>
            <ClockIcon className="size-4 text-slate-400" />
          </div>

          {recentActivity.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-slate-400">
              <ClockIcon className="size-8 mb-2 opacity-50" />
              <p className="text-xs">No recent activity yet</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[360px] pr-1">
              {recentActivity.map((act) => {
                const ActionIcon = actionIcons[act.type] || ClockIcon;
                return (
                  <div
                    key={act.id}
                    className="flex items-start gap-3 text-xs border-b border-slate-50 pb-2.5 last:border-0"
                  >
                    <div className="size-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
                      <ActionIcon className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{act.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(act.timestamp).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Top Largest Files Section ── */}
      {largestFiles.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Top Largest Files
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Highest storage consumers in your vault
              </p>
            </div>
            <span className="text-xs text-slate-400">Sorted by size</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {largestFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition group"
              >
                <div
                  onClick={() => setPreviewFile(file)}
                  className="size-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-100 transition"
                  title="Click to preview"
                >
                  {getFileIcon(file.mime_type, "size-5")}
                </div>

                <div
                  onClick={() => setPreviewFile(file)}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <p className="text-xs font-semibold text-slate-800 truncate hover:text-orange-600 transition">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 truncate">
                    <span className="font-medium text-slate-600">{formatBytes(file.size)}</span>
                    <span>·</span>
                    <span className="truncate">{file.folder_name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={DownloadIcon}
                    onClick={() => handleDownload(file)}
                    title="Download file"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recently Uploaded Files Section ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Recently Uploaded Files
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Quick access to your latest files</p>
          </div>
          <Link to="/">
            <span className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline">
              View All Files →
            </span>
          </Link>
        </div>

        {recentFiles.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No files uploaded yet. Drag & drop files in My Drive to get started!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentFiles.map((file) => (
              <div
                key={file._id || file.id}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition group"
              >
                <div
                  onClick={() => setPreviewFile(file)}
                  className="size-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-100 transition"
                  title="Click to preview"
                >
                  {getFileIcon(file.mime_type, "size-5")}
                </div>

                <div
                  onClick={() => setPreviewFile(file)}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <p className="text-xs font-semibold text-slate-800 truncate hover:text-orange-600 transition">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 truncate">
                    <span>{formatBytes(file.size)}</span>
                    <span>·</span>
                    <span>{new Date(file.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  icon={DownloadIcon}
                  onClick={() => handleDownload(file)}
                  title="Download file"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <PreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
      />

      {/* Duplicate Optimizer Modal */}
      <DuplicateModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        onCleaned={() => {
          fetchStats();
          refreshUser?.();
        }}
      />
    </div>
  );
};

export default Dashboard;
