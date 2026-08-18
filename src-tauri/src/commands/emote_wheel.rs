use std::path::PathBuf;
use crate::core::{roblox_detector, backup, image_validator};
use crate::models::CommandResult;

#[tauri::command]
pub fn apply_emote_bg(source_path: String) -> Result<CommandResult, String> {
    let versions_dir =
        roblox_detector::get_roblox_versions_dir(None).ok_or("Roblox not found. Please check Settings.")?;
    let version_path = roblox_detector::find_active_version(&versions_dir)
        .ok_or("No active Roblox version found.")?;

    let src = PathBuf::from(&source_path);
    if !src.exists() {
        return Err(format!("Image file not found: {}", source_path));
    }

    let validation = image_validator::validate_image(&src);
    if !validation.valid {
        return Err(format!("Invalid image: {}", validation.message));
    }

    roblox_detector::ensure_emote_bg_dir(&version_path)?;

    backup::save_emote_bg_original_if_needed(&version_path)?;

    let emote_bg_dest = roblox_detector::get_emote_bg_path(&version_path);

    let img = image::open(&src)
        .map_err(|e| format!("Failed to open image: {}", e))?;

    let resized = img.resize(256, 256, image::imageops::FilterType::Lanczos3);

    resized.save(&emote_bg_dest)
        .map_err(|e| format!("Failed to save emote background: {}", e))?;

    Ok(CommandResult {
        success: true,
        message: "Emote wheel background applied successfully!".to_string(),
    })
}

#[tauri::command]
pub fn restore_emote_bg() -> Result<CommandResult, String> {
    let versions_dir =
        roblox_detector::get_roblox_versions_dir(None).ok_or("Roblox not found.")?;
    let version_path = roblox_detector::find_active_version(&versions_dir)
        .ok_or("No active Roblox version found.")?;

    backup::restore_emote_bg_original(&version_path)?;

    Ok(CommandResult {
        success: true,
        message: "Emote wheel background restored to default!".to_string(),
    })
}

#[tauri::command]
pub fn get_emote_bg_status() -> Result<bool, String> {
    let versions_dir =
        roblox_detector::get_roblox_versions_dir(None).ok_or("Roblox not found.")?;
    let version_path = roblox_detector::find_active_version(&versions_dir)
        .ok_or("No active Roblox version found.")?;

    let originals_dir = {
        let local = dirs::data_local_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
        local.join("RobloxCrosshairManager").join("originals")
    };

    let has_original = {
        let mut found = false;
        for ext in &["png", "jpg", "jpeg", "webp", "dds"] {
            if originals_dir.join(format!("SegmentedCircle.{}", ext)).exists() {
                found = true;
                break;
            }
        }
        found
    };

    let emote_bg_path = roblox_detector::get_emote_bg_path(&version_path);
    let is_modified = if has_original && emote_bg_path.exists() {
        let original_path = {
            let mut p = None;
            for ext in &["png", "jpg", "jpeg", "webp", "dds"] {
                let candidate = originals_dir.join(format!("SegmentedCircle.{}", ext));
                if candidate.exists() {
                    p = Some(candidate);
                    break;
                }
            }
            p
        };
        if let Some(orig) = original_path {
            let orig_bytes = std::fs::read(&orig).unwrap_or_default();
            let current_bytes = std::fs::read(&emote_bg_path).unwrap_or_default();
            orig_bytes != current_bytes
        } else {
            false
        }
    } else {
        false
    };

    Ok(is_modified)
}
