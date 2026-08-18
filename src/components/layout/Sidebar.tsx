import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  Heart,
  Target,
  Sparkles,
  PenTool,
  Clock,
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { useUIStore } from "../../stores/uiStore";
import { cn } from "../../lib/utils";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "library", label: "My Crosshairs", icon: FolderOpen },
  { id: "editor", label: "Create Cursor (Beta)", icon: PenTool },
  { id: "premade", label: "Premade", icon: Sparkles },
  { id: "coming-soon", label: "More Coming Soon", icon: Clock },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "credits", label: "Credits", icon: Heart },
];

export function Sidebar() {
  const { currentPage, setPage } = useUIStore();
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <aside className="w-60 h-full bg-surface-950 border-r border-surface-800/50 flex flex-col shrink-0">
      <div className="p-5 flex items-center gap-3" data-tauri-drag-region>
        <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
          <Target size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-surface-100 leading-tight">
            Crosshair
          </h1>
          <p className="text-[10px] text-surface-500 leading-tight">
            Manager
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          const isComingSoon = item.id === "coming-soon";
          return (
            <button
              key={item.id}
              onClick={() => !isComingSoon && setPage(item.id)}
              disabled={isComingSoon}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isComingSoon
                  ? "text-surface-600 cursor-default border border-transparent opacity-50"
                  : active
                    ? "bg-brand-600/15 text-brand-400 border border-brand-600/20 cursor-pointer"
                    : "text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 border border-transparent cursor-pointer"
              )}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-surface-800/50">
        <p className="text-[10px] text-surface-600 text-center">
          Roblox Crosshair Manager
        </p>
        <p className="text-[10px] text-surface-700 text-center">v{version}</p>
      </div>
    </aside>
  );
}
