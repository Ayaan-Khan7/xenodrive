import { NavLink, useNavigate } from "react-router-dom";
import {
  HardDriveIcon,
  Share2Icon,
  Trash2Icon,
  LogOutIcon,
} from "lucide-react";
import { useApp } from "../../context/appcontext";
import { ProgressBar } from "../ui/ProgressBar";
import { formatBytes } from "../../assets/assets";

const navItems = [
  { to: "/", icon: HardDriveIcon, label: "My Drive" },
  { to: "/shared", icon: Share2Icon, label: "Shared Links" },
  { to: "/trash", icon: Trash2Icon, label: "Trash" },
];

export default function Sidebar({ onClose }) {
  const { user, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const storagePercent = user
    ? (Number(user.storage_used) / Number(user.storage_limit)) * 100
    : 0;

  return (
    <aside className="h-full flex flex-col bg-white border-r border-slate-200 w-64">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
        <img src="/logo.svg" alt="XenoDrive" className="h-8" />
        <span className="text-lg font-semibold uppercase text-slate-900 tracking-tight">
          XenoDrive
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-orange-50 text-orange-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`
            }
          >
            <Icon className="size-5 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Storage + Logout */}
      <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-4">
        {user && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Storage</span>
              <span>
                {formatBytes(user.storage_used)} /{" "}
                {formatBytes(user.storage_limit)}
              </span>
            </div>
            <ProgressBar progress={storagePercent} />
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
        >
          <LogOutIcon className="size-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

