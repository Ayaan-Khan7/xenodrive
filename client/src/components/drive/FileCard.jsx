import { getFileIcon, formatBytes } from "../../assets/assets";
import { ItemDropdown } from "../ui/ItemDropdown";

export function FileCard({
  file,
  onPreview,
  onDownload,
  onShare,
  onVersionHistory,
  onRename,
  onMove,
  onDelete,
}) {
  const formattedDate = file.created_at
    ? new Date(file.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="group flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all duration-150">
      <div
        onClick={() => onPreview && onPreview(file)}
        className="size-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-100 transition"
        title="Click to preview"
      >
        {getFileIcon(file.mime_type, "size-5")}
      </div>
      <div
        onClick={() => onPreview && onPreview(file)}
        className="flex-1 min-w-0 cursor-pointer"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate hover:text-orange-600 transition">
            {file.name}
          </p>
          {file.version && file.version > 1 && (
            <span className="text-[10px] font-semibold bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.2 rounded-md shrink-0">
              v{file.version}
            </span>
          )}
          {file.matched_in_content && (
            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded-md shrink-0">
              Content match
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 truncate">
          <span>{formatBytes(file.size)}</span>
          {formattedDate && (
            <>
              <span>·</span>
              <span>{formattedDate}</span>
            </>
          )}
        </div>
      </div>
      <ItemDropdown
        item={file}
        onPreview={onPreview}
        onDownload={onDownload}
        onShare={onShare}
        onVersionHistory={onVersionHistory}
        onRename={onRename}
        onMove={onMove}
        onDelete={onDelete}
      />
    </div>
  );
}
