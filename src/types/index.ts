export interface RobloxStatus {
  installed: boolean;
  versionPath: string;
  versionId: string;
  cursorPath: string;
  currentCrosshairName: string | null;
  isModified: boolean;
  lastChecked: string;
}

export interface AppSettings {
  robloxPath: string;
  autoDetectRoblox: boolean;
  autoBackup: boolean;
  launchOnStartup: boolean;
  theme: "dark" | "light";
  activeCrosshairId: string | null;
}

export interface BackupEntry {
  id: string;
  crosshairName: string;
  timestamp: string;
  filePath: string;
  isOriginal: boolean;
}

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}
