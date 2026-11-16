import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  DownloadIcon,
  FolderIcon,
  ShieldIcon,
  AlertCircleIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ClockIcon,
} from "lucide-react";
import api from "../config/api";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { getFileIcon, formatBytes } from "../assets/assets";
import toast from "react-hot-toast";

const SharedFile = () => {
  const { token } = useParams();
  const [shareData, setShareData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Password & expiration state
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [resourceName, setResourceName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

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
        if (cancelled) return;
        const res = err?.response?.data;
        if (err?.response?.status === 401 && res?.is_password_required) {
          setIsPasswordRequired(true);
          setResourceName(res?.resource_name || "Shared Content");
        } else if (err?.response?.status === 410 || res?.is_expired) {
          setIsExpired(true);
        } else {
          setError(res?.error || "This shared link is invalid or has expired.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleUnlock = async (e) => {
    e?.preventDefault();
    if (!password) {
      setPasswordError("Please enter the password.");
      return;
    }

    setIsUnlocking(true);
    setPasswordError("");

    try {
      const { data } = await api.post(`/api/shares/access/${token}`, {
        password,
      });
      setShareData(data);
      setIsPasswordRequired(false);
      toast.success("Access granted");
    } catch (err) {
      setPasswordError(
        err?.response?.data?.error || "Incorrect password. Please try again."
      );
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { data } = await api.post(`/api/shares/access/${token}/download`, {
        password: password || undefined,
      });
      if (data.download_url) {
        window.open(data.download_url, "_blank");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to download file");
    } finally {
      setIsDownloading(false);
    }
  };

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

  /* ── password challenge ── */
  if (isPasswordRequired) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-5">
          <div className="size-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto text-orange-600">
            <LockIcon className="size-7" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Password Protected
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter the password to access{" "}
              <span className="font-medium text-slate-800">
                "{resourceName}"
              </span>
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                }}
                className="w-full bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 pl-4 pr-10 py-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </button>
            </div>

            {passwordError && (
              <p className="text-xs text-red-500 text-left font-medium">
                {passwordError}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center"
              isLoading={isUnlocking}
            >
              Unlock File
            </Button>
          </form>
        </div>
      </div>
    );
  }

  /* ── expired link ── */
  if (isExpired) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-4">
          <div className="size-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto text-amber-600">
            <ClockIcon className="size-7" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">
            Shared Link Expired
          </h2>
          <p className="text-sm text-slate-500">
            This shared link has expired and is no longer accessible. Please
            request a new link from the owner.
          </p>
        </div>
      </div>
    );
  }

  /* ── general error ── */
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-4">
          <div className="size-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto text-red-500">
            <AlertCircleIcon className="size-7" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">
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
            <span className="capitalize">
              {permission === "view" ? "Read-Only" : "Download Allowed"}
            </span>
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
              {permission === "download" && (
                <Button
                  variant="primary"
                  icon={DownloadIcon}
                  onClick={handleDownload}
                  isLoading={isDownloading}
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
