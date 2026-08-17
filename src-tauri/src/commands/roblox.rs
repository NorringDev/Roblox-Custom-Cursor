use crate::core::roblox_detector;
use crate::models::{RobloxStatus, UpdateCheckResult};

#[tauri::command]
pub fn detect_roblox() -> RobloxStatus {
    roblox_detector::detect_roblox(None)
}

#[tauri::command]
pub fn get_active_version_path() -> Result<String, String> {
    let versions_dir =
        roblox_detector::get_roblox_versions_dir(None).ok_or("Roblox not found")?;
    let version_path =
        roblox_detector::find_active_version(&versions_dir).ok_or("No active Roblox version")?;
    Ok(version_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn check_roblox_update() -> Result<UpdateCheckResult, String> {
    let versions_dir =
        roblox_detector::get_roblox_versions_dir(None).ok_or("Roblox not found")?;
    let version_path =
        roblox_detector::find_active_version(&versions_dir).ok_or("No active Roblox version")?;
    let version_id = version_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    Ok(UpdateCheckResult {
        updated: false,
        new_version: version_id,
    })
}

#[tauri::command]
pub fn get_current_crosshair() -> Result<Option<serde_json::Value>, String> {
    let versions_dir =
        roblox_detector::get_roblox_versions_dir(None).ok_or("Roblox not found")?;
    let version_path =
        roblox_detector::find_active_version(&versions_dir).ok_or("No active Roblox version")?;
    let cursor_path = roblox_detector::get_cursor_path(&version_path);
    if cursor_path.exists() {
        let meta = std::fs::metadata(&cursor_path).ok();
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        if size > 0 {
            let name = "Custom Crosshair".to_string();
            let path = cursor_path.to_string_lossy().to_string();
            return Ok(Some(serde_json::json!({
                "name": name,
                "path": path
            })));
        }
    }
    Ok(Some(serde_json::json!({
        "name": "Default Arrow Cursor",
        "path": ""
    })))
}
