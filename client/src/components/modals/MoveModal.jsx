import { useState, useEffect, useCallback } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { FolderIcon, ChevronRightIcon, HomeIcon } from "lucide-react";
import api from "../../config/api";

export function MoveModal({ isOpen, onClose, item, onMove, isLoading }) {
  const [folders, setFolders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [browseFolderId, setBrowseFolderId] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  const loadFolders = useCallback(
    async (parentId) => {
      setLoadingFolders(true);
      try {
        const { data } = await api.get("/api/folders", {
          params: { parent_id: parentId || null },
        });
        // Filter out the item being moved (if it is a folder)
        const filtered = (data.folders || []).filter(
          (f) => f.id !== item?.id
        );
        setFolders(filtered);

        if (parentId) {
          const res = await api.get(`/api/folders/${parentId}`);
          setBreadcrumbs(res.data.breadcrumbs || []);
        } else {
          setBreadcrumbs([]);
        }
      } catch {
        setFolders([]);
      } finally {
        setLoadingFolders(false);
      }
    },
    [item]
  );

  useEffect(() => {
    if (isOpen) {
      setBrowseFolderId(null);
      setSelectedId(null);
      loadFolders(null);
    }
  }, [isOpen, loadFolders]);

  const handleNavigate = (folderId) => {
    setBrowseFolderId(folderId);
    setSelectedId(folderId);
    loadFolders(folderId);
  };

  const handleGoHome = () => {
    setBrowseFolderId(null);
    setSelectedId(null);
    loadFolders(null);
  };

  const handleMove = () => {
    onMove(item, selectedId);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Move to…">
      <div className="space-y-4">
        {/* Breadcrumb trail */}
        <div className="flex items-center gap-1 text-sm text-slate-500 flex-wrap">
          <button
            onClick={handleGoHome}
            className="flex items-center gap-1 hover:text-orange-600 transition px-1.5 py-0.5 rounded-md hover:bg-orange-50"
          >
            <HomeIcon className="size-3.5" />
            <span>My Drive</span>
          </button>
          {breadcrumbs.map((bc) => (
            <span key={bc.id} className="flex items-center gap-1">
              <ChevronRightIcon className="size-3.5 text-slate-400" />
              <button
                onClick={() => handleNavigate(bc.id)}
                className="hover:text-orange-600 transition px-1.5 py-0.5 rounded-md hover:bg-orange-50"
              >
                {bc.name}
              </button>
            </span>
          ))}
          {browseFolderId && (
            <span className="flex items-center gap-1">
              <ChevronRightIcon className="size-3.5 text-slate-400" />
              <span className="text-slate-700 font-medium">Current</span>
            </span>
          )}
        </div>

        {/* Folder list */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          {/* Root option when browsing inside a folder */}
          {browseFolderId && (
            <button
              onClick={() => {
                setSelectedId(null);
                handleGoHome();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition text-left border-b border-slate-100 ${
                selectedId === null
                  ? "bg-orange-50 text-orange-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <HomeIcon className="size-4 shrink-0" />
              <span>Root (My Drive)</span>
            </button>
          )}

          {loadingFolders ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">
              No subfolders here
            </div>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.id}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition border-b border-slate-50 last:border-0 ${
                  selectedId === folder.id
                    ? "bg-orange-50 text-orange-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <button
                  onClick={() => setSelectedId(folder.id)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <FolderIcon className="size-4 shrink-0 text-orange-500" />
                  <span className="truncate">{folder.name}</span>
                </button>
                <button
                  onClick={() => handleNavigate(folder.id)}
                  className="p-1 rounded-md hover:bg-slate-200 transition shrink-0"
                >
                  <ChevronRightIcon className="size-4 text-slate-400" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleMove} isLoading={isLoading}>
            Move Here
          </Button>
        </div>
      </div>
    </Modal>
  );
}

