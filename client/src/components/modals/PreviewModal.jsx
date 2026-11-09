import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";
import { Button } from "../ui/Button";
import { DownloadIcon, FileIcon } from "lucide-react";
import { formatBytes } from "../../assets/assets";
import api from "../../config/api";

export function PreviewModal({ isOpen, onClose, file }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    if (!isOpen || !file) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    setIsLoadingPreview(true);
    api
      .get(`/api/files/${file.id}/preview`)
      .then(({ data }) => {
        if (!cancelled) setPreviewUrl(data.preview_url || data.url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, file]);

  const mime = file?.mime_type || "";

  const renderPreview = () => {
    if (isLoadingPreview) {
      return (
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      );
    }

    if (!previewUrl) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <FileIcon className="size-12 mb-3" />
          <p className="text-sm">Preview not available</p>
        </div>
      );
    }

    if (mime.startsWith("image/")) {
      return (
        <img
          src={previewUrl}
          alt={file.name}
          className="max-w-full max-h-[60vh] object-contain rounded-lg mx-auto"
        />
      );
    }

    if (mime.startsWith("video/")) {
      return (
        <video
          src={previewUrl}
          controls
          className="max-w-full max-h-[60vh] rounded-lg mx-auto"
        />
      );
    }

    if (mime.startsWith("audio/")) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-6">
          <div className="size-24 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center">
            <div className="size-12 rounded-full bg-pink-100 animate-pulse" />
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
          className="w-full h-[60vh] rounded-lg border border-slate-200"
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <FileIcon className="size-12 mb-3" />
        <p className="text-sm">Preview not available for this file type</p>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={file?.name || "Preview"}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        {renderPreview()}

        {/* File info */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-400 space-y-0.5">
            <p>{file?.mime_type || "Unknown type"}</p>
            <p>{formatBytes(file?.size)}</p>
          </div>
          {previewUrl && (
            <Button
              variant="secondary"
              size="sm"
              icon={DownloadIcon}
              onClick={() => window.open(previewUrl, "_blank")}
            >
              Download
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

