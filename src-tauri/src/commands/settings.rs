use std::path::PathBuf;
use crate::models::{AppSettings, CommandResult};

pub fn get_settings_path() -> PathBuf {
    let local = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    local
        .join("RobloxCrosshairManager")
        .join("settings.json")
}

pub fn ensure_settings_dir() -> Result<PathBuf, String> {
    let path = get_settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }
    Ok(path)
}

#[tauri::command]
pub fn get_settings() -> Result<AppSettings, String> {
    let path = get_settings_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        let settings: AppSettings = serde_json::from_str(&content)
            .map_err(|e| format!("Invalid settings: {}", e))?;
        Ok(settings)
    } else {
        Ok(AppSettings::default())
    }
}

#[tauri::command]
pub fn save_settings(settings: serde_json::Value) -> Result<CommandResult, String> {
    let path = ensure_settings_dir()?;
    let mut current = get_settings()?;

    if let Some(v) = settings.get("robloxPath") {
        current.roblox_path = v.as_str().unwrap_or("").to_string();
    }
    if let Some(v) = settings.get("autoDetectRoblox") {
        current.auto_detect_roblox = v.as_bool().unwrap_or(true);
    }
    if let Some(v) = settings.get("autoBackup") {
        current.auto_backup = v.as_bool().unwrap_or(true);
    }
    if let Some(v) = settings.get("launchOnStartup") {
        current.launch_on_startup = v.as_bool().unwrap_or(false);
    }
    if let Some(v) = settings.get("theme") {
        current.theme = v.as_str().unwrap_or("dark").to_string();
    }
    if let Some(v) = settings.get("activeCrosshairId") {
        current.active_crosshair_id = v.as_str().map(|s| s.to_string());
    }

    let json = serde_json::to_string_pretty(&current)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write settings: {}", e))?;
    Ok(CommandResult { success: true, message: "Settings saved".to_string() })
}

#[tauri::command]
pub fn validate_image(file_path: String) -> crate::models::ValidationResult {
    crate::core::image_validator::validate_image(&PathBuf::from(&file_path))
}
