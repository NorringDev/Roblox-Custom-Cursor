import { useEffect, useState } from "react";
import {
  Crosshair,
  RotateCcw,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Header } from "../layout/Header";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useRobloxStore } from "../../stores/robloxStore";
import { useUIStore } from "../../stores/uiStore";
import { convertFileSrc } from "@tauri-apps/api/core";

export function Dashboard() {
  const { status, detect, loading } = useRobloxStore();
  const { setPage, addToast } = useUIStore();
  const [activeCrosshair, setActiveCrosshair] = useState<{
    name: string;
    path: string;
  } | null>(null);

  useEffect(() => {
    detect();
    loadActiveCrosshair();
  }, []);

  const loadActiveCrosshair = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ name: string; path: string } | null>(
        "get_current_crosshair"
      );
      setActiveCrosshair(result);
    } catch (e) {
      console.error("Failed to load active crosshair:", e);
    }
  };

  const handleRestore = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ success: boolean; message: string }>(
        "restore_default"
      );
      if (result.success) {
        addToast("success", "Crosshair restored to default!");
        detect();
        loadActiveCrosshair();
      } else {
        addToast("error", result.message);
      }
    } catch (e) {
      addToast("error", "Failed to restore: " + String(e));
    }
  };

  return (
    <div className="space-y-6">
      <Header
        title="Dashboard"
        subtitle="Manage your Roblox crosshair"
      />

      {/* Roblox Status */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center overflow-hidden">
            {status?.isModified && activeCrosshair?.path ? (
              <img
                src={convertFileSrc(activeCrosshair.path)}
                alt="Active crosshair"
                className="w-8 h-8 object-contain"
                style={{ imageRendering: "pixelated" }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling?.classList.remove("hidden");
                }}
              />
            ) : null}
            <Crosshair
              size={20}
              className={`text-brand-400 ${status?.isModified && activeCrosshair?.path ? "hidden" : ""}`}
            />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-surface-100">
              Current Crosshair
            </h3>
            <p className="text-xs text-surface-500">
              {status?.isModified
                ? activeCrosshair?.name || "Custom crosshair is active"
                : "Using default Roblox crosshair"}
            </p>
          </div>
          {status?.isModified ? (
            <Badge variant="success">Custom</Badge>
          ) : (
            <Badge>Default</Badge>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={() => setPage("library")}
          >
            <Crosshair size={14} />
            Import & Apply
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            onClick={handleRestore}
          >
            <RotateCcw size={14} />
            Restore Default
          </Button>
        </div>
      </Card>

      {/* Roblox Detection */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-surface-100">
            Roblox Status
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => detect()}
            className="text-xs"
          >
            <RefreshCw size={12} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <RefreshCw size={14} className="animate-spin" />
            Detecting Roblox installation...
          </div>
        ) : status?.installed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-400" />
              <span className="text-sm text-surface-300">
                Roblox detected
              </span>
            </div>
            <div className="text-xs text-surface-500 space-y-1">
              <p>
                Version:{" "}
                <span className="text-surface-400">{status.versionId}</span>
              </p>
              <p className="truncate">
                Path:{" "}
                <span className="text-surface-400">{status.versionPath}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-sm text-surface-400">
              Roblox not found. Check Settings to set the path manually.
            </span>
          </div>
        )}
      </Card>

      {/* Quick Links */}
      <Card>
        <h3 className="text-sm font-semibold text-surface-100 mb-3">
          Quick Links
        </h3>
        <div className="space-y-2">
          <button
            onClick={() => setPage("library")}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-800/50 hover:bg-surface-800 border border-surface-700/30 transition-colors cursor-pointer"
          >
            <span className="text-sm text-surface-300">
              Import your own crosshair
            </span>
            <ArrowRight size={14} className="text-surface-500" />
          </button>
          <button
            onClick={() => setPage("settings")}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-800/50 hover:bg-surface-800 border border-surface-700/30 transition-colors cursor-pointer"
          >
            <span className="text-sm text-surface-300">App settings</span>
            <ArrowRight size={14} className="text-surface-500" />
          </button>
        </div>
      </Card>
    </div>
  );
}
