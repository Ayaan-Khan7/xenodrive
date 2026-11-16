import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import {
  LinkIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  CalendarIcon,
  ShieldCheckIcon,
  Trash2Icon,
  DownloadIcon,
  EyeIcon as ViewIcon,
} from "lucide-react";
import api from "../../config/api";
import toast from "react-hot-toast";

const EXPIRATION_OPTIONS = [
  { label: "Never", value: "never" },
  { label: "1 Hour", value: "1h" },
  { label: "24 Hours", value: "24h" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
];

export function ShareModal({ isOpen, onClose, item, itemType = "file" }) {
  const [shareLink, setShareLink] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form options
  const [permission, setPermission] = useState("download");
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [expiryOption, setExpiryOption] = useState("never");

  // Load existing share link or create default
  useEffect(() => {
    if (!isOpen || !item) {
      setShareLink(null);
      setCopied(false);
      setPassword("");
      setEnablePassword(false);
      setPermission("download");
      setExpiryOption("never");
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    api
      .post("/api/shares", {
        resource_id: item.id || item._id,
        resource_type: itemType,
        permission: "download",
      })
      .then(({ data }) => {
        if (!cancelled) {
          const share = data.share || data.share_link;
          setShareLink(share);
          if (share) {
            setPermission(share.permission || "download");
            setEnablePassword(Boolean(share.has_password || share.is_password_protected));
            if (share.expires_at) {
              setExpiryOption("custom");
            }
          }
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load share settings");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, item, itemType]);

  const computeExpiresAt = (option) => {
    if (option === "never") return null;
    const now = new Date();
    if (option === "1h") now.setHours(now.getHours() + 1);
    else if (option === "24h") now.setHours(now.getHours() + 24);
    else if (option === "7d") now.setDate(now.getDate() + 7);
    else if (option === "30d") now.setDate(now.getDate() + 30);
    return now.toISOString();
  };

  const handleSaveSettings = async () => {
    if (!item) return;
    setIsSaving(true);
    try {
      const expires_at = computeExpiresAt(expiryOption);
      const payload = {
        resource_id: item.id || item._id,
        resource_type: itemType,
        permission,
        expires_at,
      };

      if (enablePassword) {
        if (password.trim()) {
          payload.password = password.trim();
        }
      } else {
        payload.remove_password = true;
      }

      const { data } = await api.post("/api/shares", payload);
      const updated = data.share || data.share_link;
      setShareLink(updated);
      toast.success("Share settings updated");
      setPassword("");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to update share link");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!shareLink) return;
    setIsSaving(true);
    try {
      await api.delete(`/api/shares/${shareLink.id || shareLink._id}`);
      toast.success("Share link revoked");
      setShareLink(null);
      onClose();
    } catch {
      toast.error("Failed to revoke share link");
    } finally {
      setIsSaving(false);
    }
  };

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share ${itemType === "folder" ? "Folder" : "File"}`}
    >
      <div className="space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : (
          <>
            {/* Share Link Preview Bar */}
            {shareLink && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <LinkIcon className="size-4 text-orange-500 shrink-0 ml-1" />
                  <input
                    type="text"
                    readOnly
                    value={getShareUrl()}
                    className="flex-1 bg-transparent text-xs text-slate-700 outline-none truncate select-all"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCopy}
                    icon={copied ? CheckIcon : CopyIcon}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(getShareUrl(), "_blank")}
                    icon={ExternalLinkIcon}
                  />
                </div>

                {/* Link status & counters */}
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <div className="flex items-center gap-3">
                    <span>{shareLink.access_count || 0} views</span>
                    <span>·</span>
                    <span>{shareLink.download_count || 0} downloads</span>
                  </div>
                  {shareLink.has_password && (
                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                      <LockIcon className="size-3" /> Password Protected
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Permissions Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Access Permission
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPermission("download")}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition ${
                    permission === "download"
                      ? "border-orange-500 bg-orange-50/50 text-orange-950 font-medium"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <DownloadIcon
                    className={`size-4 ${
                      permission === "download" ? "text-orange-600" : "text-slate-400"
                    }`}
                  />
                  <div>
                    <p className="text-xs font-medium">View & Download</p>
                    <p className="text-[11px] text-slate-400">Can view and download</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPermission("view")}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition ${
                    permission === "view"
                      ? "border-orange-500 bg-orange-50/50 text-orange-950 font-medium"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <ViewIcon
                    className={`size-4 ${
                      permission === "view" ? "text-orange-600" : "text-slate-400"
                    }`}
                  />
                  <div>
                    <p className="text-xs font-medium">View Only</p>
                    <p className="text-[11px] text-slate-400">Read-only preview</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Password Protection */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enablePassword}
                    onChange={(e) => setEnablePassword(e.target.checked)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 size-4"
                  />
                  <span>Password Protection</span>
                </label>
                {shareLink?.has_password && (
                  <span className="text-[11px] text-emerald-600">Active</span>
                )}
              </div>

              {enablePassword && (
                <div className="relative mt-2">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={
                      shareLink?.has_password
                        ? "Enter new password to change (or leave empty)"
                        : "Enter a secure password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 pl-3 pr-9 py-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Expiration Settings */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Link Expiration
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {EXPIRATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExpiryOption(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition ${
                      expiryOption === opt.value
                        ? "bg-orange-600 text-white font-medium"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {shareLink?.expires_at && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Expires on {new Date(shareLink.expires_at).toLocaleString()}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              {shareLink ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2Icon}
                  onClick={handleRevoke}
                  disabled={isSaving}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  Revoke Link
                </Button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveSettings}
                  isLoading={isSaving}
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
