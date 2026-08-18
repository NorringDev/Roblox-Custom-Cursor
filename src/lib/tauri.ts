import { invoke } from "@tauri-apps/api/core";
import type { RobloxStatus, AppSettings, BackupEntry } from "../types";

export async function detectRoblox(): Promise<RobloxStatus> {
  return invoke<RobloxStatus>("detect_roblox");
}

export async function getCurrentCrosshair(): Promise<{ name: string; path: string } | null> {
  return invoke("get_current_crosshair");
}

export async function applyCrosshair(
  crosshairId: string,
  sourcePath: string
): Promise<{ success: boolean; message: string }> {
  return invoke("apply_crosshair", { crosshairId, sourcePath });
}

export async function restoreDefault(): Promise<{ success: boolean; message: string }> {
  return invoke("restore_default");
}

export async function importCrosshair(
  filePath: string,
  name: string
): Promise<{ success: boolean; message: string; savedPath: string }> {
  return invoke("import_crosshair", { filePath, name });
}

export async function validateImage(
  filePath: string
): Promise<{ valid: boolean; width: number; height: number; hasAlpha: boolean; message: string }> {
  return invoke("validate_image", { filePath });
}

export async function getLibrary(): Promise<{ id: string; name: string; path: string; thumbnail: string }[]> {
  return invoke("get_library");
}

export async function deleteLibraryItem(id: string): Promise<{ success: boolean; message: string }> {
  return invoke("delete_library_item", { id });
}

export async function renameLibraryItem(id: string, newName: string): Promise<{ success: boolean; message: string }> {
  return invoke("rename_library_item", { id, newName });
}

export async function clearLibrary(): Promise<{ success: boolean; message: string }> {
  return invoke("clear_library");
}

export async function getBackups(): Promise<BackupEntry[]> {
  return invoke("get_backups");
}

export async function restoreBackup(backupId: string): Promise<{ success: boolean; message: string }> {
  return invoke("restore_backup", { backupId });
}

export async function getSettings(): Promise<AppSettings> {
  return invoke("get_settings");
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<{ success: boolean; message: string }> {
  return invoke("save_settings", { settings });
}

export async function getActiveVersionPath(): Promise<string> {
  return invoke("get_active_version_path");
}

export async function checkRobloxUpdate(): Promise<{ updated: boolean; newVersion: string }> {
  return invoke("check_roblox_update");
}

export async function initPremade(): Promise<{ success: boolean; message: string }> {
  return invoke("init_premade");
}

export async function getPremadeCrosshairs(): Promise<{ id: string; name: string }[]> {
  return invoke("get_premade_crosshairs");
}

export async function getPremadePreview(premadeId: string): Promise<string | null> {
  return invoke("get_premade_preview", { premadeId });
}

export async function applyPremadeCrosshair(premadeId: string): Promise<{ success: boolean; message: string }> {
  return invoke("apply_premade_crosshair", { premadeId });
}

export async function saveDrawnPngCrosshair(
  pngData: string,
  name: string
): Promise<{ success: boolean; message: string; savedPath: string }> {
  return invoke("save_drawn_crosshair", { pngData, name });
}
