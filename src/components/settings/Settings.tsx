import { useEffect, useState } from "react";
import {
  FolderOpen,
  Shield,
  Palette,
  RotateCcw,
  RefreshCw,
  Monitor,
  HardDrive,
} from "lucide-react";
import { Header } from "../layout/Header";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useUIStore } from "../../stores/uiStore";
import { useRobloxStore } from "../../stores/robloxStore";
import * as api from "../../lib/tauri";
import type { AppSettings } from "../../types";

export function Settings() {
  const { addToast } = useUIStore();
  const { detect } = useRobloxStore();
  const [settings, setSettings] = useState<AppSettings>({
    robloxPath: "",
    autoDetectRoblox: true,
    autoBackup: true,
    launchOnStartup: false,
    theme: "dark",
    activeCrosshairId: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
      applyTheme(s.theme);
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (theme: "dark" | "light") => {
    const html = document.documentElement;
    html.classList.remove("dark", "light");
    html.classList.add(theme);
  };

  const saveSettings = async (updated: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updated };
    setSettings(newSettings);
    if (updated.theme) {
      applyTheme(updated.theme);
    }
    try {
      await api.saveSettings(updated);
      addToast("success", "Settings saved!");
    } catch (e) {
      addToast("error", "Failed to save settings: " + String(e));
    }
  };

  const handleBrowsePath = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        title: "Select Roblox Installation Folder",
      });
      if (selected) {
        saveSettings({ robloxPath: selected as string });
      }
    } catch (e) {
      addToast("error", "Failed to open folder dialog: " + String(e));
    }
  };

  const handleResetSettings = async () => {
    const defaults: AppSettings = {
      robloxPath: "",
      autoDetectRoblox: true,
      autoBackup: true,
      launchOnStartup: false,
      theme: "dark",
      activeCrosshairId: null,
    };
    setSettings(defaults);
    applyTheme("dark");
    try {
      await api.saveSettings(defaults);
      addToast("success", "Settings reset to defaults!");
    } catch (e) {
      addToast("error", "Failed to reset settings: " + String(e));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-surface-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header title="Settings" subtitle="Configure the application" />

      {/* Roblox Installation */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-600/15 flex items-center justify-center">
            <HardDrive size={20} className="text-brand-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-100">
              Roblox Installation
            </h3>
            <p className="text-xs text-surface-500">
              Path to your Roblox installation
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.robloxPath}
              onChange={(e) => saveSettings({ robloxPath: e.target.value })}
              placeholder="Auto-detect (leave empty)"
              className="flex-1 px-3 py-2 bg-surface-950 border border-surface-700/50 rounded-xl text-sm text-surface-200 placeholder:text-surface-600 focus:outline-none focus:border-brand-600/50"
            />
            <Button variant="secondary" size="sm" onClick={handleBrowsePath}>
              <FolderOpen size={14} />
              Browse
            </Button>
          </div>

          <label className="flex items-center justify-between p-3 bg-surface-950 rounded-xl border border-surface-800 cursor-pointer">
            <div className="flex items-center gap-3">
              <RefreshCw size={16} className="text-surface-400" />
              <div>
                <span className="text-sm text-surface-200">
                  Auto-detect Roblox
                </span>
                <p className="text-[11px] text-surface-500">
                  Automatically find Roblox installation
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                saveSettings({ autoDetectRoblox: !settings.autoDetectRoblox })
              }
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                settings.autoDetectRoblox ? "bg-brand-600" : "bg-surface-700"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  settings.autoDetectRoblox ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>
      </Card>

      {/* Backup Settings */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Shield size={20} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-100">Backup</h3>
            <p className="text-xs text-surface-500">
              Automatic backup before changes
            </p>
          </div>
        </div>

        <label className="flex items-center justify-between p-3 bg-surface-950 rounded-xl border border-surface-800 cursor-pointer">
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-surface-400" />
            <div>
              <span className="text-sm text-surface-200">
                Auto-backup files
              </span>
              <p className="text-[11px] text-surface-500">
                Create backup before modifying Roblox files
              </p>
            </div>
          </div>
          <button
            onClick={() => saveSettings({ autoBackup: !settings.autoBackup })}
            className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.autoBackup ? "bg-brand-600" : "bg-surface-700"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                settings.autoBackup ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      </Card>

      {/* Appearance */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <Palette size={20} className="text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-100">
              Appearance
            </h3>
            <p className="text-xs text-surface-500">
              Customize the app theme
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {(["dark", "light"] as const).map((theme) => (
            <button
              key={theme}
              onClick={() => saveSettings({ theme })}
              className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                settings.theme === theme
                  ? "bg-brand-600/15 text-brand-400 border-brand-600/30"
                  : "bg-surface-950 text-surface-400 border-surface-800 hover:text-surface-300"
              }`}
            >
              <Monitor size={16} className="mx-auto mb-1" />
              {theme === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </div>
      </Card>

      {/* Reset */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-surface-100">
              Reset Settings
            </h3>
            <p className="text-xs text-surface-500">
              Restore all settings to defaults
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={handleResetSettings}>
            <RotateCcw size={14} />
            Reset
          </Button>
        </div>
      </Card>
    </div>
  );
}
