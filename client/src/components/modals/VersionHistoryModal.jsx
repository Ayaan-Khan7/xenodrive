import { useState, useEffect, useCallback, useRef } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ProgressBar } from "../ui/ProgressBar";
import {
  HistoryIcon,
  UploadIcon,
  DownloadIcon,
  RotateCcwIcon,
  Trash2Icon,
  CheckCircle2Icon,
  ClockIcon,
  FileIcon,
} from "lucide-react";
import api from "../../config/api";
import { formatBytes, getFileIcon } from "../../assets/assets";
import toast from "react-hot-toast";

export function VersionHistoryModal({ isOpen, onClose, file, onVersionChange }) {
  const [versions, setVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);

  // Actions state
  const [restoreItem, setRestoreItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fileInputRef = useRef(null);

  /* ─── Fetch Versions ─── */
  const fetchVersions = useCallback(async () => {
    if (!file?.id && !file?._id) return;
    const fileId = file.id || file._id;
    setIsLoading(true);
    try {
      const { data } = await api.get(`/api/files/${fileId}/versions`);
      setVersions(data.versions || []);
    } catch {
      toast.error("Failed to load version history");
    } finally {
      setIsLoading(false);
    }
  }, [file]);

  useEffect(() => {
    if (isOpen && file) {
      fetchVersions();
    } else {
      setVersions([]);
    }
  }, [isOpen, file, fetchVersions]);

  /* ─── Compute SHA-256 for duplicate detection ─── */
  const computeSHA256 = async (fileBlob) => {
    try {
      const buffer = await fileBlob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      return null;
    }
  };

  /* ─── Upload New Version ─── */
  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !file) return;

    const fileId = file.id || file._id;
    setIsUploading(true);
    setUploadPercent(10);

    try {
      // 1. Calculate SHA-256 checksum
      const checksum = await computeSHA256(selectedFile);
      setUploadPercent(30);

      // 2. Request presigned upload URL for new version
      const { data: resData } = await api.post(
        `/api/files/${fileId}/versions/request-upload-url`,
        {
          name: selectedFile.name,
          size: selectedFile.size,
          mime_type: selectedFile.type || "application/octet-stream",
          checksum_sha256: checksum,
        }
      );

      const payload = resData.data || resData;
      const { uploadUrl, storage_key } = payload;
      setUploadPercent(60);

      // 3. Upload directly via presigned PUT URL
      const r2Response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type || "application/octet-stream",
        },
        body: selectedFile,
      });

      if (!r2Response.ok) {
        throw new Error(`Storage returned status ${r2Response.status}`);
      }
      setUploadPercent(85);

      // 4. Confirm new version upload with backend
      await api.post(`/api/files/${fileId}/versions/confirm-upload`, {
        storage_key,
        name: selectedFile.name,
        size: selectedFile.size,
        mime_type: selectedFile.type || "application/octet-stream",
        checksum_sha256: checksum,
        change_summary: `Updated to ${selectedFile.name}`,
      });

      setUploadPercent(100);
      toast.success("New version uploaded successfully");
      await fetchVersions();
      onVersionChange?.();
    } catch (err) {
      toast.error(
        err?.response?.data?.error || err.message || "Failed to upload new version"
      );
    } finally {
      setIsUploading(false);
      setUploadPercent(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ─── Download Version ─── */
  const handleDownload = async (v) => {
    const fileId = file.id || file._id;
    try {
      const { data } = await api.get(
        `/api/files/${fileId}/versions/${v.id}/download?download=true`
      );
      if (data.download_url) {
        window.open(data.download_url, "_blank");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to download version");
    }
  };

  /* ─── Restore Version ─── */
  const handleRestore = async () => {
    if (!restoreItem || !file) return;
    const fileId = file.id || file._id;
    setActionLoading(true);
    try {
      await api.post(`/api/files/${fileId}/versions/${restoreItem.id}/restore`);
      toast.success(`Restored Version ${restoreItem.version_number}`);
      setRestoreItem(null);
      await fetchVersions();
      onVersionChange?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to restore version");
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── Delete Old Version ─── */
  const handleDelete = async () => {
    if (!deleteItem || !file) return;
    const fileId = file.id || file._id;
    setActionLoading(true);
    try {
      await api.delete(`/api/files/${fileId}/versions/${deleteItem.id}`);
      toast.success(`Deleted Version ${deleteItem.version_number}`);
      setDeleteItem(null);
      await fetchVersions();
      onVersionChange?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to delete version");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Version History">
        <div className="space-y-6">
          {/* File Header */}
          <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="size-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
              {getFileIcon(file?.mime_type, "size-6")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {file?.name}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Current active version:{" "}
                <span className="font-semibold text-orange-600">
                  v{file?.version || 1}
                </span>{" "}
                · {formatBytes(file?.size || 0)}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={UploadIcon}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Upload Version
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Uploading progress bar */}
          {isUploading && (
            <div className="space-y-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-orange-900">
                  Uploading new version…
                </span>
                <span className="text-orange-700 font-semibold">{uploadPercent}%</span>
              </div>
              <ProgressBar progress={uploadPercent} color="bg-orange-600" />
            </div>
          )}

          {/* Versions List */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Version Timeline ({versions.length})
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size="md" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No version history found.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
                      v.is_current
                        ? "bg-white border-orange-300 ring-1 ring-orange-200"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`size-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          v.is_current
                            ? "bg-orange-500 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        v{v.version_number}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-slate-800 truncate">
                            {v.name}
                          </p>
                          {v.is_current && (
                            <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.2 rounded font-semibold shrink-0">
                              CURRENT
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span>{formatBytes(v.size)}</span>
                          <span>·</span>
                          <span>
                            {v.created_at
                              ? new Date(v.created_at).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Recently"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={DownloadIcon}
                        onClick={() => handleDownload(v)}
                        title="Download version"
                      />

                      {!v.is_current && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={RotateCcwIcon}
                            onClick={() => setRestoreItem(v)}
                            title="Restore this version"
                          >
                            Restore
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2Icon}
                            onClick={() => setDeleteItem(v)}
                            title="Delete this version"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={!!restoreItem}
        onClose={() => setRestoreItem(null)}
        onConfirm={handleRestore}
        title="Restore Version"
        message={`Are you sure you want to restore Version ${restoreItem?.version_number}? It will become the active file, and the current active file will be saved in your version history.`}
        confirmText="Restore Version"
        isLoading={actionLoading}
      />

      <ConfirmDialog
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Delete Version"
        message={`Version ${deleteItem?.version_number} will be permanently deleted from cloud storage. This action cannot be undone.`}
        confirmText="Delete Forever"
        isLoading={actionLoading}
      />
    </>
  );
}
