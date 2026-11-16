import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboardIcon,
  HardDriveIcon,
  Share2Icon,
  Trash2Icon,
  LogOutIcon,
  UserIcon,
} from "lucide-react";
import { useApp } from "../../context/appcontext";
import { ProgressBar } from "../ui/ProgressBar";
import { formatBytes } from "../../assets/assets";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboardIcon, label: "Dashboard" },
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

  const storagePercent = user && user.storage_limit
    ? Math.min(100, Math.round(((Number(user.storage_used) || 0) / Number(user.storage_limit)) * 100))
    : 0;

  return (
    <aside className="h-full flex flex-col bg-white border-r border-slate-200 w-64 select-none">
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
                  ? "bg-orange-50 text-orange-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`
            }
          >
            <Icon className="size-5 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Info & Storage Meter + Logout */}
      <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-4">
        {user && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2.5">
            {/* User Profile Info */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-700 font-bold text-xs shrink-0">
                {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user.name || "User"}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>

            {/* Storage Progress */}
            <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Storage</span>
                <span>
                  {formatBytes(user.storage_used || 0)} / {formatBytes(user.storage_limit || 1073741824)}
                </span>
              </div>
              <ProgressBar progress={storagePercent} />
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
        >
          <LogOutIcon className="size-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
