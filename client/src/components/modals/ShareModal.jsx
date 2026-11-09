import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { LinkIcon, CopyIcon, CheckIcon, ExternalLinkIcon } from "lucide-react";
import api from "../../config/api";
import toast from "react-hot-toast";

export function ShareModal({ isOpen, onClose, item, itemType = "file" }) {
  const [shareLink, setShareLink] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !item) {
      setShareLink(null);
      setCopied(false);
      return;
    }
    let cancelled = false;
    setIsCreating(true);
    api
      .post("/api/shares", {
        resource_id: item.id,
        resource_type: itemType,
        permission: "download",
      })
      .then(({ data }) => {
        if (!cancelled) setShareLink(data.share || data.share_link);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to create share link");
      })
      .finally(() => {
        if (!cancelled) setIsCreating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, item, itemType]);

  const getShareUrl = () => {
    if (!shareLink?.token) return "";
    return `${window.location.origin}/s/${shareLink.token}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Link">
      <div className="space-y-5">
        {isCreating ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : shareLink ? (
          <>
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <LinkIcon className="size-5 text-orange-500 shrink-0" />
              <span className="text-sm text-slate-700 truncate flex-1">
                {getShareUrl()}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={handleCopy}
                icon={copied ? CheckIcon : CopyIcon}
                className="flex-1"
              >
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.open(getShareUrl(), "_blank")}
                icon={ExternalLinkIcon}
              >
                Open
              </Button>
            </div>
            <p className="text-xs text-slate-400 text-center">
              Anyone with this link can view and download this {itemType}.
            </p>
          </>
        ) : null}

        <div className="flex items-center justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

