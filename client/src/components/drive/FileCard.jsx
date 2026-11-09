import { getFileIcon, formatBytes } from "../../assets/assets";
import { ItemDropdown } from "../ui/ItemDropdown";

export function FileCard({ file, onPreview, onShare, onRename, onMove, onDelete }) {
  return (
    <div className="group flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all duration-150">
      <div className="size-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
        {getFileIcon(file.mime_type, "size-5")}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{formatBytes(file.size)}</p>
      </div>
      <ItemDropdown
        item={file}
        onPreview={onPreview}
        onShare={onShare}
        onRename={onRename}
        onMove={onMove}
        onDelete={onDelete}
      />
    </div>
  );
}

