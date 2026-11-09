import { useState, useEffect, useCallback } from "react";
import {
  Trash2Icon,
  RotateCcwIcon,
  FolderIcon,
} from "lucide-react";
import api from "../config/api";
import { useApp } from "../context/appcontext";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { getFileIcon, formatBytes } from "../assets/assets";
import toast from "react-hot-toast";

const Trash = () => {
  const { refreshUser } = useApp();

  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  /* confirm dialogs */
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteType, setDeleteType] = useState("file");

  /* ─── fetch ─── */
  const fetchTrash = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/api/trash");
      setFiles(data.files || []);
      setFolders(data.folders || []);
    } catch {
      toast.error("Failed to load trash");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  /* ─── actions ─── */
  const handleRestore = async (item, type) => {
    setActionLoading(true);
    const endpoint =
      type === "folder"
        ? `/api/folders/${item.id}/restore`
        : `/api/files/${item.id}/restore`;
    try {
      await api.post(endpoint);
      toast.success("Restored successfully");
      await fetchTrash();
    } catch {
      toast.error("Restore failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteItem) return;
    setActionLoading(true);
    const endpoint =
      deleteType === "folder"
        ? `/api/folders/${deleteItem.id}/permanent`
        : `/api/files/${deleteItem.id}/permanent`;
    try {
      await api.delete(endpoint);
      toast.success("Permanently deleted");
      setDeleteItem(null);
      await fetchTrash();
      refreshUser?.();
    } catch {
      toast.error("Delete failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmptyTrash = async () => {
    setActionLoading(true);
    try {
      await api.post("/api/trash/empty");
      toast.success("Trash emptied");
      setEmptyTrashConfirm(false);
      await fetchTrash();
      refreshUser?.();
    } catch {
      toast.error("Failed to empty trash");
    } finally {
      setActionLoading(false);
    }
  };

  const totalItems = files.length + folders.length;

  /* ─── render ─── */
  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trash2Icon className="size-5 text-slate-500" />
            <h1 className="text-lg font-medium text-slate-900">Trash</h1>
            {totalItems > 0 && (
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {totalItems} item{totalItems !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {totalItems > 0 && (
            <Button
              variant="danger"
              size="sm"
              icon={Trash2Icon}
              onClick={() => setEmptyTrashConfirm(true)}
            >
              Empty Trash
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="md" />
          </div>
        ) : totalItems === 0 ? (
          <EmptyState
            icon={Trash2Icon}
            title="Trash is empty"
            description="Items you delete will appear here. They can be restored or permanently deleted."
          />
        ) : (
          <div className="space-y-6">
            {/* Trashed folders */}
            {folders.length > 0 && (
              <section>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Folders ({folders.length})
                </h3>
                <div className="space-y-2">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl"
                    >
                      <div className="size-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                        <FolderIcon className="size-5 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {folder.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Deleted{" "}
                          {folder.trashed_at
                            ? new Date(folder.trashed_at).toLocaleDateString()
                            : "recently"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={RotateCcwIcon}
                          onClick={() => handleRestore(folder, "folder")}
                          disabled={actionLoading}
                        >
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2Icon}
                          onClick={() => {
                            setDeleteItem(folder);
                            setDeleteType("folder");
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Trashed files */}
            {files.length > 0 && (
              <section>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Files ({files.length})
                </h3>
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl"
                    >
                      <div className="size-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        {getFileIcon(file.mime_type, "size-5")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatBytes(file.size)} · Deleted{" "}
                          {file.trashed_at
                            ? new Date(file.trashed_at).toLocaleDateString()
                            : "recently"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={RotateCcwIcon}
                          onClick={() => handleRestore(file, "file")}
                          disabled={actionLoading}
                        >
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2Icon}
                          onClick={() => {
                            setDeleteItem(file);
                            setDeleteType("file");
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handlePermanentDelete}
        title="Permanently Delete"
        message={`"${deleteItem?.name}" will be permanently deleted. This action cannot be undone.`}
        confirmText="Delete Forever"
        isLoading={actionLoading}
      />
      <ConfirmDialog
        isOpen={emptyTrashConfirm}
        onClose={() => setEmptyTrashConfirm(false)}
        onConfirm={handleEmptyTrash}
        title="Empty Trash"
        message="All items in trash will be permanently deleted. This action cannot be undone."
        confirmText="Empty Trash"
        isLoading={actionLoading}
      />
    </div>
  );
};

export default Trash;
