import { FolderIcon } from "lucide-react";
import { ItemDropdown } from "../ui/ItemDropdown";

export function FolderCard({ folder, onClick, onShare, onRename, onMove, onDelete }) {
  return (
    <div
      onClick={() => onClick(folder)}
      className="group flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-orange-200 hover:bg-orange-50/30 transition-all duration-150 cursor-pointer"
    >
      <div className="size-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
        <FolderIcon className="size-5 text-orange-500" />
      </div>
      <span className="text-sm font-medium text-slate-800 truncate flex-1">
        {folder.name}
      </span>
      <ItemDropdown
        item={folder}
        onShare={onShare}
        onRename={onRename}
        onMove={onMove}
        onDelete={onDelete}
      />
    </div>
  );
}

