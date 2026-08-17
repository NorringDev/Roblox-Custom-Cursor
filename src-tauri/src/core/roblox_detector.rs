use std::path::{Path, PathBuf};
use crate::models::RobloxStatus;
use chrono::Utc;

const CURSOR_FILENAME: &str = "ArrowCursor.png";
const FAR_CURSOR_FILENAME: &str = "ArrowFarCursor.png";
const LOCKED_CURSOR_FILENAME: &str = "MouseLockedCursor.png";
const CURSOR_SUBPATH: &str = "content\\textures\\Cursors\\KeyboardMouse";
const TEXTURES_SUBPATH: &str = "content\\textures";

pub fn get_roblox_versions_dir(custom_path: Option<&str>) -> Option<PathBuf> {
    if let Some(p) = custom_path {
        let path = PathBuf::from(p);
        if path.exists() {
            return Some(path);
        }
    }
    if let Some(local_app_data) = dirs::data_local_dir() {
        let versions_dir = local_app_data.join("Roblox").join("Versions");
        if versions_dir.exists() {
            return Some(versions_dir);
        }
    }
    None
}

pub fn find_active_version(versions_dir: &Path) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(versions_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let dir_name = path.file_name().unwrap_or_default().to_string_lossy();
                if dir_name.starts_with("version-") {
                    let exe = path.join("RobloxPlayerBeta.exe");
                    if exe.exists() {
                        candidates.push(path);
                    }
                }
            }
        }
    }
    candidates.sort_by(|a, b| {
        let meta_a = std::fs::metadata(a).ok().and_then(|m| m.modified().ok());
        let meta_b = std::fs::metadata(b).ok().and_then(|m| m.modified().ok());
        meta_b.cmp(&meta_a)
    });
    candidates.into_iter().next()
}

pub fn get_cursor_dir(version_path: &Path) -> PathBuf {
    version_path.join(CURSOR_SUBPATH)
}

pub fn get_cursor_path(version_path: &Path) -> PathBuf {
    get_cursor_dir(version_path).join(CURSOR_FILENAME)
}

pub fn get_far_cursor_path(version_path: &Path) -> PathBuf {
    get_cursor_dir(version_path).join(FAR_CURSOR_FILENAME)
}

pub fn get_textures_dir(version_path: &Path) -> PathBuf {
    version_path.join(TEXTURES_SUBPATH)
}

pub fn get_locked_cursor_path(version_path: &Path) -> PathBuf {
    get_textures_dir(version_path).join(LOCKED_CURSOR_FILENAME)
}

pub fn detect_roblox(custom_path: Option<&str>) -> RobloxStatus {
    let now = Utc::now().to_rfc3339();
    match get_roblox_versions_dir(custom_path) {
        Some(versions_dir) => {
            match find_active_version(&versions_dir) {
                Some(version_path) => {
                    let version_id = version_path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let cursor_path = get_cursor_path(&version_path);
                    let is_modified = if cursor_path.exists() {
                        let content = std::fs::read(&cursor_path).unwrap_or_default();
                        content.len() != 0
                    } else {
                        false
                    };
                    let current_name = if is_modified {
                        Some("Custom Crosshair".to_string())
                    } else {
                        None
                    };
                    RobloxStatus {
                        installed: true,
                        version_path: version_path.to_string_lossy().to_string(),
                        version_id,
                        cursor_path: cursor_path.to_string_lossy().to_string(),
                        current_crosshair_name: current_name,
                        is_modified,
                        last_checked: now,
                    }
                }
                None => RobloxStatus {
                    installed: false,
                    version_path: String::new(),
                    version_id: String::new(),
                    cursor_path: String::new(),
                    current_crosshair_name: None,
                    is_modified: false,
                    last_checked: now,
                },
            }
        }
        None => RobloxStatus {
            installed: false,
            version_path: String::new(),
            version_id: String::new(),
            cursor_path: String::new(),
            current_crosshair_name: None,
            is_modified: false,
            last_checked: now,
        },
    }
}

pub fn ensure_cursor_dir(version_path: &Path) -> Result<PathBuf, String> {
    let dir = get_cursor_dir(version_path);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create cursor directory: {}", e))?;
    Ok(dir)
}
