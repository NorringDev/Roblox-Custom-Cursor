use std::path::PathBuf;
use tauri::Manager;
use base64::Engine;
use crate::core::{roblox_detector, backup, image_validator};use crate::models::CommandResult;

fn get_premade_dir() -> PathBuf {
    let local = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    local.join("RobloxCrosshairManager").join("premade")
}

fn find_bundled_premade_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p1 = resource_dir.join("resources").join("premade");
        if p1.exists() {
            return Some(p1);
        }
        let p2 = resource_dir.join("premade");
        if p2.exists() {
            return Some(p2);
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let p1 = parent.join("resources").join("premade");
            if p1.exists() {
                return Some(p1);
            }
            let p2 = parent.join("premade");
            if p2.exists() {
                return Some(p2);
            }
            if let Some(src_tauri) = parent.parent().and_then(|p| p.parent()) {
                let dev_path = src_tauri.join("resources").join("premade");
                if dev_path.exists() {
                    return Some(dev_path);
                }
            }
        }
    }

    None
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PremadeCrosshair {
    pub id: String,
    pub name: String,
}

fn scan_premade_sets(dir: &std::path::Path) -> Vec<PremadeCrosshair> {
    let mut sets = Vec::new();
    if !dir.exists() {
        return sets;
    }

    fn scan_recursive(dir: &std::path::Path, sets: &mut Vec<PremadeCrosshair>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let arrow = path.join("ArrowCursor.png");
                    if arrow.exists() {
                        let name = path.file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        let id = path.to_string_lossy().to_string();
                        sets.push(PremadeCrosshair {
                            id,
                            name,
                        });
                    } else {
                        scan_recursive(&path, sets);
                    }
                }
            }
        }
    }

    scan_recursive(dir, &mut sets);
    sets.sort_by(|a, b| a.name.cmp(&b.name));
    sets
}

#[tauri::command]
pub fn init_premade(app: tauri::AppHandle) -> Result<CommandResult, String> {
    let premade_dir = get_premade_dir();
    log::info!("Premade dir: {}", premade_dir.display());

    if let Some(bundled) = find_bundled_premade_dir(&app) {
        log::info!("Found bundled premade at: {}", bundled.display());
        copy_dir_recursive(&bundled, &premade_dir)
            .map_err(|e| format!("Failed to copy premade crosshairs: {}", e))?;
        return Ok(CommandResult { success: true, message: format!("Premade crosshairs initialized from {}", bundled.display()) });
    }

    log::warn!("No bundled premade dir found");
    Ok(CommandResult { success: true, message: "No bundled premade crosshairs found".to_string() })
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let dest = dst.join(entry.file_name());
        if path.is_dir() {
            copy_dir_recursive(&path, &dest)?;
        } else {
            std::fs::copy(&path, &dest).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_premade_crosshairs(app: tauri::AppHandle) -> Result<Vec<PremadeCrosshair>, String> {
    let premade_dir = get_premade_dir();
    if !premade_dir.exists() || std::fs::read_dir(&premade_dir).map(|mut e| e.next().is_none()).unwrap_or(true) {
        let _ = init_premade(app);
    }
    Ok(scan_premade_sets(&premade_dir))
}

#[tauri::command]
pub fn apply_premade_crosshair(
    premade_id: String,
) -> Result<CommandResult, String> {
    let crosshair_dir = PathBuf::from(&premade_id);

    let arrow_cursor = crosshair_dir.join("ArrowCursor.png");
    let arrow_far = crosshair_dir.join("ArrowFarCursor.png");
    let locked_cursor = crosshair_dir.join("MouseLockedCursor.png");

    if !arrow_cursor.exists() && !arrow_far.exists() {
        return Err("Premade crosshair files not found".to_string());
    }

    let versions_dir =
        roblox_detector::get_roblox_versions_dir(None).ok_or("Roblox not found. Please check Settings.")?;
    let version_path = roblox_detector::find_active_version(&versions_dir)
        .ok_or("No active Roblox version found.")?;

    backup::save_original_if_needed(&version_path)?;

    let cursor_dir = roblox_detector::ensure_cursor_dir(&version_path)?;

    let mut applied = false;

    if arrow_cursor.exists() {
        let validation = image_validator::validate_image(&arrow_cursor);
        if validation.valid {
            let dest = cursor_dir.join("ArrowCursor.png");
            image_validator::prepare_cursor_image(&arrow_cursor, &dest)?;
            let far_dest = cursor_dir.join("ArrowFarCursor.png");
            if arrow_far.exists() {
                image_validator::prepare_cursor_image(&arrow_far, &far_dest)?;
            } else {
                image_validator::prepare_cursor_image(&arrow_cursor, &far_dest)?;
            }
            applied = true;
        }
    }

    let locked_dest = roblox_detector::get_locked_cursor_path(&version_path);
    if locked_cursor.exists() {
        image_validator::prepare_cursor_image(&locked_cursor, &locked_dest)?;
    } else if arrow_cursor.exists() {
        image_validator::prepare_cursor_image(&arrow_cursor, &locked_dest)?;
    }

    if !applied {
        return Err("No valid crosshair images found in premade set".to_string());
    }

    let name = crosshair_dir.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let settings_path = crate::commands::settings::get_settings_path();
    if let Ok(content) = std::fs::read_to_string(&settings_path) {
        if let Ok(mut settings) = serde_json::from_str::<crate::models::AppSettings>(&content) {
            settings.active_crosshair_id = Some(format!("premade:{}", name));
            if let Ok(json) = serde_json::to_string_pretty(&settings) {
                let _ = std::fs::write(&settings_path, json);
            }
        }
    }

    Ok(CommandResult {
        success: true,
        message: format!("Premade crosshair '{}' applied successfully!", name),
    })
}

#[tauri::command]
pub fn get_premade_preview(premade_id: String) -> Result<Option<String>, String> {
    let path = std::path::Path::new(&premade_id);
    let arrow = path.join("ArrowCursor.png");
    if !arrow.exists() {
        return Ok(None);
    }
    let data = std::fs::read(&arrow).map_err(|e| e.to_string())?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(Some(format!("data:image/png;base64,{}", b64)))
}
