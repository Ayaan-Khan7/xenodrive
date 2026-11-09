import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  DownloadIcon,
  FolderIcon,
  ShieldIcon,
  AlertCircleIcon,
} from "lucide-react";
import api from "../config/api";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { getFileIcon, formatBytes } from "../assets/assets";

const SharedFile = () => {
  const { token } = useParams();
  const [shareData, setShareData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setIsLoading(true);
    api
      .get(`/api/shares/access/${token}`)
      .then(({ data }) => {
        if (!cancelled) setShareData(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err?.response?.data?.error ||
              "This shared link is invalid or has expired."
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  /* ── loading ── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading shared content…</p>
        </div>
      </div>
    );
  }

  /* ── error ── */
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="size-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
            <AlertCircleIcon className="size-8 text-red-500" />
          </div>
          <h2 className="text-xl font-medium text-slate-900">
            Link Not Found
          </h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const isFile = shareData?.resource_type === "file";
  const file = shareData?.file;
  const folder = shareData?.folder;
  const folderFiles = shareData?.files || [];
  const previewUrl = shareData?.preview_url || shareData?.url;
  const permission = shareData?.permission || "download";

  /* ── file preview renderer ── */
  const renderFilePreview = () => {
    if (!previewUrl || !file) return null;
    const mime = file.mime_type || "";

    if (mime.startsWith("image/")) {
      return (
        <img
          src={previewUrl}
          alt={file.name}
          className="max-w-full max-h-[50vh] object-contain rounded-xl mx-auto"
        />
      );
    }
    if (mime.startsWith("video/")) {
      return (
        <video
          src={previewUrl}
          controls
          className="max-w-full max-h-[50vh] rounded-xl mx-auto"
        />
      );
    }
    if (mime.startsWith("audio/")) {
      return (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="size-20 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center">
            {getFileIcon(mime, "size-10")}
          </div>
          <audio src={previewUrl} controls className="w-full max-w-md" />
        </div>
      );
    }
    if (mime === "application/pdf") {
      return (
        <iframe
          src={previewUrl}
          title={file.name}
          className="w-full h-[50vh] rounded-xl border border-slate-200"
        />
      );
    }
    return null;
  };

  /* ── page ── */
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/logo.svg" alt="XenoDrive" className="h-7" />
          <span className="text-base font-semibold uppercase text-slate-900 tracking-tight">
            XenoDrive
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldIcon className="size-3.5" />
            <span>Shared · {permission}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {isFile && file ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
            {/* File header */}
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                {getFileIcon(file.mime_type, "size-7")}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-medium text-slate-900 truncate">
                  {file.name}
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  {formatBytes(file.size)} · {file.mime_type}
                </p>
              </div>
              {permission === "download" && previewUrl && (
                <Button
                  variant="primary"
                  icon={DownloadIcon}
                  onClick={() => window.open(previewUrl, "_blank")}
                >
                  Download
                </Button>
              )}
            </div>
            {/* Preview */}
            {renderFilePreview()}
          </div>
        ) : folder ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
            {/* Folder header */}
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                <FolderIcon className="size-7 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-medium text-slate-900 truncate">
                  {folder.name}
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Shared folder · {folderFiles.length} file
                  {folderFiles.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Folder contents */}
            {folderFiles.length > 0 ? (
              <div className="space-y-2">
                {folderFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 px-4 py-3 border border-slate-100 rounded-xl"
                  >
                    <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                      {getFileIcon(f.mime_type, "size-4")}
                    </div>
                    <span className="text-sm text-slate-700 truncate flex-1">
                      {f.name}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {formatBytes(f.size)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">
                This folder is empty.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SharedFile;
