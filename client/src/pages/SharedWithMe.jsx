import { useState, useEffect, useCallback } from "react";
import {
  Share2Icon,
  LinkIcon,
  CopyIcon,
  Trash2Icon,
  FolderIcon,
  ExternalLinkIcon,
} from "lucide-react";
import api from "../config/api";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { getFileIcon, formatBytes, copyShareLink } from "../assets/assets";
import toast from "react-hot-toast";

const SharedWithMe = () => {
  const [shares, setShares] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokeItem, setRevokeItem] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchShares = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/api/shares");
      setShares(data.share_links || data.shares || []);
    } catch {
      toast.error("Failed to load shared links");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const handleRevoke = async () => {
    if (!revokeItem) return;
    setActionLoading(true);
    try {
      await api.delete(`/api/shares/${revokeItem.id}`);
      toast.success("Share link revoked");
      setRevokeItem(null);
      await fetchShares();
    } catch {
      toast.error("Failed to revoke link");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200">
        <div className="px-6 py-4 flex items-center gap-3">
          <Share2Icon className="size-5 text-slate-500" />
          <h1 className="text-lg font-medium text-slate-900">Shared Links</h1>
          {shares.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              {shares.length} link{shares.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="md" />
          </div>
        ) : shares.length === 0 ? (
          <EmptyState
            icon={LinkIcon}
            title="No shared links"
            description="When you share files or folders, their share links will appear here."
          />
        ) : (
          <div className="space-y-3">
            {shares.map((share) => {
              const resource = share.resource || {};
              const isFolder = share.resource_type === "folder";

              return (
                <div
                  key={share.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-4 bg-white border border-slate-200 rounded-xl"
                >
                  {/* Icon */}
                  <div className="size-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    {isFolder ? (
                      <FolderIcon className="size-5 text-orange-500" />
                    ) : (
                      getFileIcon(resource.mime_type, "size-5")
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {resource.name || "Unknown"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                      <span className="capitalize">
                        {share.resource_type || "file"}
                      </span>
                      <span>·</span>
                      <span>{share.permission || "download"}</span>
                      <span>·</span>
                      <span>{share.access_count || 0} views</span>
                      {resource.size && (
                        <>
                          <span>·</span>
                          <span>{formatBytes(resource.size)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={CopyIcon}
                      onClick={() => copyShareLink(share.token)}
                    >
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={ExternalLinkIcon}
                      onClick={() =>
                        window.open(`/s/${share.token}`, "_blank")
                      }
                    >
                      Open
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2Icon}
                      onClick={() => setRevokeItem(share)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!revokeItem}
        onClose={() => setRevokeItem(null)}
        onConfirm={handleRevoke}
        title="Revoke Share Link"
        message="This share link will be permanently deactivated. Anyone with the link will lose access."
        confirmText="Revoke Link"
        isLoading={actionLoading}
      />
    </div>
  );
};

export default SharedWithMe;
