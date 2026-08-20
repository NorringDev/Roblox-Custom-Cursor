use std::path::PathBuf;
use crate::models::CommandResult;
use crate::core::roblox_detector;

fn get_roblox_exe_path() -> Result<PathBuf, String> {
    let versions_dir = roblox_detector::get_roblox_versions_dir(None)
        .ok_or("Roblox not found. Please check Settings.")?;
    let version_path = roblox_detector::find_active_version(&versions_dir)
        .ok_or("No active Roblox version found.")?;
    let exe = version_path.join("RobloxPlayerBeta.exe");
    if !exe.exists() {
        return Err("RobloxPlayerBeta.exe not found".to_string());
    }
    Ok(exe)
}

fn get_backup_dir() -> PathBuf {
    let local = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    local.join("RobloxCrosshairManager").join("instance_backup")
}

fn get_state_file() -> PathBuf {
    let local = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    local.join("RobloxCrosshairManager").join("multi_instance_state.json")
}

fn load_state() -> bool {
    let file = get_state_file();
    if file.exists() {
        if let Ok(content) = std::fs::read_to_string(&file) {
            if let Ok(state) = serde_json::from_str::<serde_json::Value>(&content) {
                return state["enabled"].as_bool().unwrap_or(false);
            }
        }
    }
    false
}

fn save_state(enabled: bool) -> Result<(), String> {
    let dir = get_state_file().parent().unwrap().to_path_buf();
    std::fs::create_dir_all(&dir).ok();
    let state = serde_json::json!({ "enabled": enabled });
    std::fs::write(&get_state_file(), serde_json::to_string_pretty(&state).unwrap())
        .map_err(|e| format!("Failed to save state: {}", e))?;
    Ok(())
}

fn find_mutex_pattern(data: &[u8]) -> Option<usize> {
    let patterns: &[&[u8]] = &[
        b"RobloxPlayerBetaMutex",
        b"ROBLOXSingletonMutex",
        b"Global\\ROBLOX",
    ];
    for pattern in patterns {
        if let Some(pos) = data.windows(pattern.len()).position(|w| w == *pattern) {
            return Some(pos);
        }
    }
    None
}

#[tauri::command]
pub fn get_multi_instance_status() -> Result<serde_json::Value, String> {
    let enabled = load_state();
    Ok(serde_json::json!({
        "enabled": enabled,
    }))
}

#[tauri::command]
pub fn toggle_multi_instance(enable: bool) -> Result<CommandResult, String> {
    let exe_path = get_roblox_exe_path()?;
    let backup_dir = get_backup_dir();
    let backup_exe = backup_dir.join("RobloxPlayerBeta.exe");

    if enable {
        std::fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Failed to create backup dir: {}", e))?;

        if !backup_exe.exists() {
            std::fs::copy(&exe_path, &backup_exe)
                .map_err(|e| format!("Failed to backup Roblox: {}", e))?;
        }

        let mut data = std::fs::read(&exe_path)
            .map_err(|e| format!("Failed to read Roblox executable: {}", e))?;

        if let Some(pos) = find_mutex_pattern(&data) {
            let end = pos + 21;
            if end <= data.len() {
                for i in pos..end {
                    data[i] = b'X';
                }
            }
        } else {
            return Err("Could not find mutex pattern in Roblox executable. Try closing all Roblox instances first.".to_string());
        }

        std::fs::write(&exe_path, &data)
            .map_err(|e| format!("Failed to write patched executable: {}", e))?;

        save_state(true)?;

        Ok(CommandResult {
            success: true,
            message: "Multi-instance enabled! You can now run multiple Roblox instances.".to_string(),
        })
    } else {
        if backup_exe.exists() {
            std::fs::copy(&backup_exe, &exe_path)
                .map_err(|e| format!("Failed to restore Roblox: {}", e))?;
            std::fs::remove_file(&backup_exe).ok();
        }

        save_state(false)?;

        Ok(CommandResult {
            success: true,
            message: "Multi-instance disabled. Roblox restored to original.".to_string(),
        })
    }
}
