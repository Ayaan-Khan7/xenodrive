import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  SearchIcon,
  UploadIcon,
  FolderPlusIcon,
  ChevronRightIcon,
  HomeIcon,
  FilterIcon,
  XIcon,
} from "lucide-react";
import api from "../config/api";
import { SORT_OPTIONS } from "../assets/assets";
import { useApp } from "../context/appcontext";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { FolderCard } from "../components/drive/FolderCard";
import { FileCard } from "../components/drive/FileCard";
import { NewFolderModal } from "../components/modals/NewFolderModal";
import { RenameModal } from "../components/modals/RenameModal";
import { MoveModal } from "../components/modals/MoveModal";
import { ShareModal } from "../components/modals/ShareModal";
import { PreviewModal } from "../components/modals/PreviewModal";
import toast from "react-hot-toast";

const Drive = () => {
  const { refreshUser } = useApp();

  /* ───── data ───── */
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  /* ───── navigation ───── */
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [currentFolderName, setCurrentFolderName] = useState("");
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  /* ───── search / sort ───── */
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");
  const [showSortMenu, setShowSortMenu] = useState(false);

  /* ───── upload ───── */
  const [isUploading, setIsUploading] = useState(false);

  /* ───── modal states ───── */
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [renameItem, setRenameItem] = useState(null);
  const [moveItem, setMoveItem] = useState(null);
  const [shareItem, setShareItem] = useState(null);
  const [shareItemType, setShareItemType] = useState("file");
  const [previewFile, setPreviewFile] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  /* ───── debounced search ───── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* ───── fetch contents ───── */
  const fetchContents = useCallback(async () => {
    setIsLoading(true);
    try {
      const [foldersRes, filesRes] = await Promise.all([
        api.get("/api/folders", {
          params: { parent_id: currentFolderId || null },
        }),
        api.get("/api/files", {
          params: {
            folder_id: currentFolderId || null,
            sort: sortBy,
            search: debouncedSearch || undefined,
          },
        }),
      ]);
      setFolders(foldersRes.data.folders || []);
      setFiles(filesRes.data.files || []);

      if (currentFolderId) {
        const { data } = await api.get(`/api/folders/${currentFolderId}`);
        setBreadcrumbs(data.breadcrumbs || []);
        setCurrentFolderName(data.folder?.name || "");
      } else {
        setBreadcrumbs([]);
        setCurrentFolderName("");
      }
    } catch {
      toast.error("Failed to load contents");
    } finally {
      setIsLoading(false);
    }
  }, [currentFolderId, sortBy, debouncedSearch]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  /* ───── close sort menu on outside click ───── */
  useEffect(() => {
    if (!showSortMenu) return;
    const handler = () => setShowSortMenu(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showSortMenu]);

  /* ───── folder navigation ───── */
  const navigateToFolder = (folder) => {
    setCurrentFolderId(folder.id);
    setSearchInput("");
  };

  const navigateHome = () => {
    setCurrentFolderId(null);
    setSearchInput("");
  };

  const navigateToBreadcrumb = (id) => {
    setCurrentFolderId(id);
    setSearchInput("");
  };

  /* ───── upload via drag-and-drop ───── */
  const onDrop = useCallback(
    async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("folder_id", currentFolderId || "");
        acceptedFiles.forEach((f) => formData.append("files", f));
        await api.post("/api/files/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success(`${acceptedFiles.length} file(s) uploaded`);
        await fetchContents();
        refreshUser?.();
      } catch {
        toast.error("Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [currentFolderId, fetchContents, refreshUser]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openFilePicker,
  } = useDropzone({ onDrop, noClick: true, noKeyboard: true });

  /* ───── CRUD helpers ───── */
  const handleCreateFolder = async (name) => {
    setActionLoading(true);
    try {
      await api.post("/api/folders", {
        name,
        parent_id: currentFolderId || null,
      });
      toast.success("Folder created");
      setShowNewFolder(false);
      await fetchContents();
    } catch {
      toast.error("Failed to create folder");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRename = async (item, newName) => {
    setActionLoading(true);
    const isFolder = !item.mime_type;
    const endpoint = isFolder
      ? `/api/folders/${item.id}/rename`
      : `/api/files/${item.id}/rename`;
    try {
      await api.patch(endpoint, { name: newName });
      toast.success("Renamed successfully");
      setRenameItem(null);
      await fetchContents();
    } catch {
      toast.error("Rename failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMove = async (item, targetId) => {
    setActionLoading(true);
    const isFolder = !item.mime_type;
    const endpoint = isFolder
      ? `/api/folders/${item.id}/move`
      : `/api/files/${item.id}/move`;
    const body = isFolder
      ? { target_parent: targetId }
      : { target_folder: targetId };
    try {
      await api.patch(endpoint, body);
      toast.success("Moved successfully");
      setMoveItem(null);
      await fetchContents();
    } catch {
      toast.error("Move failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setActionLoading(true);
    const isFolder = !deleteItem.mime_type;
    const endpoint = isFolder
      ? `/api/folders/${deleteItem.id}`
      : `/api/files/${deleteItem.id}`;
    try {
      await api.delete(endpoint);
      toast.success("Moved to trash");
      setDeleteItem(null);
      await fetchContents();
    } catch {
      toast.error("Delete failed");
    } finally {
      setActionLoading(false);
    }
  };

  /* ───── share / delete helpers ───── */
  const openShareFolder = (f) => {
    setShareItem(f);
    setShareItemType("folder");
  };
  const openShareFile = (f) => {
    setShareItem(f);
    setShareItemType("file");
  };
  const openDeleteItem = (item, type) => {
    setDeleteItem(item);
  };

  /* ─────────── RENDER ─────────── */
  return (
    <div {...getRootProps()} className="relative min-h-full">
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="absolute inset-0 z-30 bg-orange-50/80 backdrop-blur-xs border-2 border-dashed border-orange-400 rounded-2xl flex items-center justify-center m-4">
          <div className="text-center">
            <UploadIcon className="size-12 text-orange-500 mx-auto mb-3" />
            <p className="text-lg font-medium text-orange-700">
              Drop files here to upload
            </p>
            <p className="text-sm text-orange-500 mt-1">
              Files will be added to the current folder
            </p>
          </div>
        </div>
      )}

      {/* ── Header bar ── */}
      <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200">
        <div className="px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full sm:max-w-sm">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search files…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 pl-9 pr-8 py-2.5 transition focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600"
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Sort dropdown */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={FilterIcon}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSortMenu((p) => !p);
                  }}
                >
                  Sort
                </Button>
                {showSortMenu && (
                  <div
                    className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl py-1.5 z-50 animate-fade-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSortBy(opt.value);
                          setShowSortMenu(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition ${
                          sortBy === opt.value
                            ? "text-orange-600 bg-orange-50 font-medium"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={UploadIcon}
                onClick={openFilePicker}
                isLoading={isUploading}
              >
                Upload
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={FolderPlusIcon}
                onClick={() => setShowNewFolder(true)}
              >
                New Folder
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Breadcrumbs ── */}
      <div className="px-6 py-3 flex items-center gap-1 text-sm border-b border-slate-100 bg-white/50">
        <button
          onClick={navigateHome}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
            !currentFolderId
              ? "text-orange-600 font-medium"
              : "text-slate-500 hover:text-orange-600 hover:bg-orange-50"
          }`}
        >
          <HomeIcon className="size-4" />
          <span>My Drive</span>
        </button>

        {breadcrumbs.map((bc) => (
          <span key={bc.id} className="flex items-center gap-1">
            <ChevronRightIcon className="size-3.5 text-slate-300" />
            <button
              onClick={() => navigateToBreadcrumb(bc.id)}
              className="px-2 py-1 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition truncate max-w-[120px]"
            >
              {bc.name}
            </button>
          </span>
        ))}

        {currentFolderId && currentFolderName && (
          <span className="flex items-center gap-1">
            <ChevronRightIcon className="size-3.5 text-slate-300" />
            <span className="px-2 py-1 text-orange-600 font-medium truncate max-w-[160px]">
              {currentFolderName}
            </span>
          </span>
        )}
      </div>

      {/* ── Content area ── */}
      <div className="px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="md" />
          </div>
        ) : folders.length === 0 && files.length === 0 ? (
          <EmptyState
            title={
              debouncedSearch ? "No results found" : "This folder is empty"
            }
            description={
              debouncedSearch
                ? `No files match "${debouncedSearch}". Try a different search.`
                : "Drag & drop files here or click Upload to get started."
            }
            action={
              !debouncedSearch && (
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={UploadIcon}
                    onClick={openFilePicker}
                  >
                    Upload Files
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={FolderPlusIcon}
                    onClick={() => setShowNewFolder(true)}
                  >
                    New Folder
                  </Button>
                </div>
              )
            }
          />
        ) : (
          <div className="space-y-6">
            {/* Folders */}
            {folders.length > 0 && (
              <section>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Folders ({folders.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {folders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      onClick={navigateToFolder}
                      onShare={openShareFolder}
                      onRename={setRenameItem}
                      onMove={setMoveItem}
                      onDelete={(f) => openDeleteItem(f, "folder")}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Files */}
            {files.length > 0 && (
              <section>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Files ({files.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {files.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onPreview={setPreviewFile}
                      onShare={openShareFile}
                      onRename={setRenameItem}
                      onMove={setMoveItem}
                      onDelete={(f) => openDeleteItem(f, "file")}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <NewFolderModal
        isOpen={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        onCreate={handleCreateFolder}
        isLoading={actionLoading}
      />
      <RenameModal
        isOpen={!!renameItem}
        onClose={() => setRenameItem(null)}
        item={renameItem}
        onRename={handleRename}
        isLoading={actionLoading}
      />
      <MoveModal
        isOpen={!!moveItem}
        onClose={() => setMoveItem(null)}
        item={moveItem}
        onMove={handleMove}
        isLoading={actionLoading}
      />
      <ShareModal
        isOpen={!!shareItem}
        onClose={() => setShareItem(null)}
        item={shareItem}
        itemType={shareItemType}
      />
      <PreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
      />
      <ConfirmDialog
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Move to Trash"
        message={`"${deleteItem?.name}" will be moved to trash. You can restore it later.`}
        confirmText="Move to Trash"
        isLoading={actionLoading}
      />
    </div>
  );
};

export default Drive;
