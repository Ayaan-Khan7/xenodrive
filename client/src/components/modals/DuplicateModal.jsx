import { useState, useEffect, useCallback } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import {
  CopyIcon,
  Trash2Icon,
  FolderIcon,
  CheckCircle2Icon,
  SparklesIcon,
  ClockIcon,
} from "lucide-react";
import api from "../../config/api";
import { formatBytes, getFileIcon } from "../../assets/assets";
import toast from "react-hot-toast";

export function DuplicateModal({ isOpen, onClose, onCleaned }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDuplicates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/api/files/duplicates");
      setData(res.data);
    } catch {
      toast.error("Failed to scan for duplicate files");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDuplicates();
    } else {
      setData(null);
    }
  }, [isOpen, fetchDuplicates]);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/files/${deleteItem.id}`);
      toast.success(`Removed duplicate "${deleteItem.name}"`);
      setDeleteItem(null);
      await fetchDuplicates();
      onCleaned?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to remove duplicate");
    } finally {
      setIsDeleting(false);
    }
  };

  const clusters = data?.duplicates || [];
  const totalWasted = data?.total_wasted_bytes || 0;
  const totalDupes = data?.total_duplicate_files || 0;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Duplicate File Optimizer">
        <div className="space-y-6">
          {/* Header Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-orange-50/60 border border-orange-100 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0">
                <SparklesIcon className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Storage Deduplication Engine
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Identified via SHA-256 cryptographic checksum matching
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="text-right">
                <p className="text-xs text-slate-400">Reclaimable Space</p>
                <p className="text-sm font-bold text-orange-600">
                  {formatBytes(totalWasted)}
                </p>
              </div>
            </div>
          </div>

          {/* Duplicates List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" />
            </div>
          ) : clusters.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2Icon className="size-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                Zero Duplicates Found!
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                All files in your vault are distinct. Your cloud storage is fully optimized.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {clusters.length} Duplicate Cluster{clusters.length !== 1 ? "s" : ""} ({totalDupes} redundant files)
              </p>

              {clusters.map((cluster, idx) => (
                <div
                  key={cluster.checksum_sha256}
                  className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3"
                >
                  {/* Cluster Header */}
                  <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2 text-slate-600 min-w-0 font-medium">
                      <CopyIcon className="size-3.5 text-orange-500 shrink-0" />
                      <span className="truncate">
                        Cluster #{idx + 1} · {cluster.files.length} copies of identical content
                      </span>
                    </div>
                    <span className="font-semibold text-orange-600 shrink-0">
                      {formatBytes(cluster.wasted_bytes)} wasted
                    </span>
                  </div>

                  {/* Individual file copies in this cluster */}
                  <div className="space-y-2">
                    {cluster.files.map((f, fileIdx) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="size-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                            {getFileIcon(f.mime_type, "size-4")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-800 truncate">
                                {f.name}
                              </p>
                              {fileIdx === 0 && (
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold shrink-0">
                                  Primary
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span className="flex items-center gap-1">
                                <FolderIcon className="size-3" />
                                {f.folder_name}
                              </span>
                              <span>·</span>
                              <span>{formatBytes(f.size)}</span>
                              <span>·</span>
                              <span>{new Date(f.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Delete duplicate action */}
                        {fileIdx > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2Icon}
                            onClick={() => setDeleteItem(f)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0 ml-2"
                            title="Delete duplicate copy"
                          >
                            Delete Copy
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Delete Duplicate Copy"
        message={`Delete "${deleteItem?.name}" from ${deleteItem?.folder_name}? The original copy will remain safe.`}
        confirmText="Delete Copy"
        isLoading={isDeleting}
      />
    </>
  );
}
