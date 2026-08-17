use std::path::PathBuf;
use crate::core::{roblox_detector, backup, image_validator};
use crate::models::CommandResult;

fn save_active_crosshair_id(crosshair_id: &str) {
    let settings_path = crate::commands::settings::get_settings_path();
    if let Ok(content) = std::fs::read_to_string(&settings_path) {
        if let Ok(mut settings) = serde_json::from_str::<crate::models::AppSettings>(&content) {
            settings.active_crosshair_id = Some(crosshair_id.to_string());
            if let Ok(json) = serde_json::to_string_pretty(&settings) {
                let _ = std::fs::write(&settings_path, json);
            }
        }
    }
}

fn clear_active_crosshair_id() {
    let settings_path = crate::commands::settings::get_settings_path();
    if let Ok(content) = std::fs::read_to_string(&settings_path) {
        if let Ok(mut settings) = serde_json::from_str::<crate::models::AppSettings>(&content) {
            settings.active_crosshair_id = None;
            if let Ok(json) = serde_json::to_string_pretty(&settings) {
                let _ = std::fs::write(&settings_path, json);
            }
        }
    }
}

#[tauri::command]
pub fn apply_crosshair(
    crosshair_id: String,
    source_path: String,
) -> Result<CommandResult, String> {
    let versions_dir =
        roblox_detector::get_roblox_versions_dir(None).ok_or("Roblox not found. Please check Settings.")?;
    let version_path = roblox_detector::find_active_version(&versions_dir)
        .ok_or("No active Roblox version found.")?;

    let src = PathBuf::from(&source_path);

    let actual_src = if image_validator::is_builtin_crosshair(&source_path) {
        let temp_dir = std::env::temp_dir().join("roblox-crosshair-manager").join("generated");
        std::fs::create_dir_all(&temp_dir).ok();
        let temp_path = temp_dir.join(format!("{}.png", source_path));
        image_validator::generate_builtin_crosshair(&source_path, &temp_path)?;
        temp_path
    } else if src.exists() {
        src.clone()
    } else {
        return Err(format!(
            "Crosshair file not found: {}",
            source_path
        ));
    };

    let validation = image_validator::validate_image(&actual_src);
    if !validation.valid {
        return Err(format!("Invalid image: {}", validation.message));
    }

    let cursor_dir = roblox_detector::ensure_cursor_dir(&version_path)?;

    backup::save_original_if_needed(&version_path)?;
    let _backup_entry = backup::create_backup(&version_path, &crosshair_id)?;

    let cursor_dest = cursor_dir.join("ArrowCursor.png");
    image_validator::prepare_cursor_image(&actual_src, &cursor_dest)?;

    let far_cursor_dest = cursor_dir.join("ArrowFarCursor.png");
    image_validator::prepare_cursor_image(&actual_src, &far_cursor_dest)?;

    let locked_cursor_dest = roblox_detector::get_locked_cursor_path(&version_path);
    image_validator::prepare_cursor_image(&actual_src, &locked_cursor_dest)?;

    save_active_crosshair_id(&crosshair_id);

    Ok(CommandResult {
        success: true,
        message: format!("Crosshair '{}' applied successfully!", crosshair_id),
    })
}

#[tauri::command]
pub fn restore_default() -> Result<CommandResult, String> {
    let versions_dir =
        roblox_detector::get_roblox_versions_dir(None).ok_or("Roblox not found.")?;
    let version_path = roblox_detector::find_active_version(&versions_dir)
        .ok_or("No active Roblox version found.")?;

    backup::restore_original(&version_path)?;
    clear_active_crosshair_id();

    Ok(CommandResult {
        success: true,
        message: "Crosshair restored to default!".to_string(),
    })
}

#[tauri::command]
pub fn restore_backup(backup_id: String) -> Result<CommandResult, String> {
    let versions_dir =
        roblox_detector::get_roblox_versions_dir(None).ok_or("Roblox not found.")?;
    let version_path = roblox_detector::find_active_version(&versions_dir)
        .ok_or("No active Roblox version found.")?;

    backup::restore_backup(&backup_id, &version_path)?;

    Ok(CommandResult {
        success: true,
        message: "Crosshair restored from backup!".to_string(),
    })
}

#[tauri::command]
pub fn get_backups() -> Result<Vec<crate::models::BackupEntry>, String> {
    Ok(backup::get_backups())
}
