use std::path::{Path, PathBuf};
use chrono::Utc;
use crate::models::BackupEntry;
use crate::core::roblox_detector::{get_cursor_path, get_far_cursor_path, get_locked_cursor_path, get_emote_bg_path};

const BACKUP_DIR_NAME: &str = "RobloxCrosshairManager";

fn get_backup_base_dir() -> PathBuf {
    let local = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    local.join(BACKUP_DIR_NAME).join("backups")
}

fn get_originals_dir() -> PathBuf {
    let local = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    local.join(BACKUP_DIR_NAME).join("originals")
}

pub fn ensure_backup_dirs() -> Result<(), String> {
    std::fs::create_dir_all(get_backup_base_dir())
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;
    std::fs::create_dir_all(get_originals_dir())
        .map_err(|e| format!("Failed to create originals directory: {}", e))?;
    Ok(())
}

pub fn save_original_if_needed(version_path: &Path) -> Result<(), String> {
    ensure_backup_dirs()?;
    let originals_dir = get_originals_dir();
    let original_marker = originals_dir.join("saved.flag");
    if original_marker.exists() {
        return Ok(());
    }
    let cursor = get_cursor_path(version_path);
    let far_cursor = get_far_cursor_path(version_path);
    let locked_cursor = get_locked_cursor_path(version_path);

    if cursor.exists() {
        let dest = originals_dir.join("ArrowCursor.png");
        std::fs::copy(&cursor, &dest)
            .map_err(|e| format!("Failed to backup original cursor: {}", e))?;
    }
    if far_cursor.exists() {
        let dest = originals_dir.join("ArrowFarCursor.png");
        std::fs::copy(&far_cursor, &dest)
            .map_err(|e| format!("Failed to backup original far cursor: {}", e))?;
    }
    if locked_cursor.exists() {
        let dest = originals_dir.join("MouseLockedCursor.png");
        std::fs::copy(&locked_cursor, &dest)
            .map_err(|e| format!("Failed to backup original locked cursor: {}", e))?;
    }
    std::fs::write(&original_marker, "saved")
        .map_err(|e| format!("Failed to write backup marker: {}", e))?;
    Ok(())
}

pub fn create_backup(version_path: &Path, crosshair_name: &str) -> Result<BackupEntry, String> {
    ensure_backup_dirs()?;
    let id = uuid::Uuid::new_v4().to_string();
    let backup_dir = get_backup_base_dir().join(&id);
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup dir: {}", e))?;

    let cursor = get_cursor_path(version_path);
    let far_cursor = get_far_cursor_path(version_path);
    let locked_cursor = get_locked_cursor_path(version_path);

    if cursor.exists() {
        let dest = backup_dir.join("ArrowCursor.png");
        std::fs::copy(&cursor, &dest)
            .map_err(|e| format!("Failed to backup cursor: {}", e))?;
    }
    if far_cursor.exists() {
        let dest = backup_dir.join("ArrowFarCursor.png");
        std::fs::copy(&far_cursor, &dest)
            .map_err(|e| format!("Failed to backup far cursor: {}", e))?;
    }
    if locked_cursor.exists() {
        let dest = backup_dir.join("MouseLockedCursor.png");
        std::fs::copy(&locked_cursor, &dest)
            .map_err(|e| format!("Failed to backup locked cursor: {}", e))?;
    }

    let entry = BackupEntry {
        id,
        crosshair_name: crosshair_name.to_string(),
        timestamp: Utc::now().to_rfc3339(),
        file_path: backup_dir.to_string_lossy().to_string(),
        is_original: false,
    };
    Ok(entry)
}

pub fn restore_original(version_path: &Path) -> Result<(), String> {
    let originals_dir = get_originals_dir();
    let cursor_dest = get_cursor_path(version_path);
    let far_cursor_dest = get_far_cursor_path(version_path);
    let locked_cursor_dest = get_locked_cursor_path(version_path);

    let original_cursor = originals_dir.join("ArrowCursor.png");
    let original_far = originals_dir.join("ArrowFarCursor.png");
    let original_locked = originals_dir.join("MouseLockedCursor.png");

    if original_cursor.exists() {
        std::fs::copy(&original_cursor, &cursor_dest)
            .map_err(|e| format!("Failed to restore cursor: {}", e))?;
    } else if cursor_dest.exists() {
        std::fs::remove_file(&cursor_dest)
            .map_err(|e| format!("Failed to remove custom cursor: {}", e))?;
    }

    if original_far.exists() {
        std::fs::copy(&original_far, &far_cursor_dest)
            .map_err(|e| format!("Failed to restore far cursor: {}", e))?;
    } else if far_cursor_dest.exists() {
        std::fs::remove_file(&far_cursor_dest)
            .map_err(|e| format!("Failed to remove custom far cursor: {}", e))?;
    }

    if original_locked.exists() {
        std::fs::copy(&original_locked, &locked_cursor_dest)
            .map_err(|e| format!("Failed to restore locked cursor: {}", e))?;
    } else if locked_cursor_dest.exists() {
        std::fs::remove_file(&locked_cursor_dest)
            .map_err(|e| format!("Failed to remove custom locked cursor: {}", e))?;
    }

    Ok(())
}

pub fn get_backups() -> Vec<BackupEntry> {
    let backup_dir = get_backup_base_dir();
    let mut entries = Vec::new();
    if let Ok(dir_entries) = std::fs::read_dir(&backup_dir) {
        for entry in dir_entries.flatten() {
            if entry.path().is_dir() {
                let name_file = entry.path().join("name.txt");
                let crosshair_name = std::fs::read_to_string(&name_file)
                    .unwrap_or_else(|_| "Unknown".to_string());
                let meta = std::fs::metadata(entry.path()).ok();
                let timestamp = meta
                    .and_then(|m| m.modified().ok())
                    .map(|t| {
                        chrono::DateTime::<Utc>::from(t).to_rfc3339()
                    })
                    .unwrap_or_default();
                entries.push(BackupEntry {
                    id: entry.file_name().to_string_lossy().to_string(),
                    crosshair_name,
                    timestamp,
                    file_path: entry.path().to_string_lossy().to_string(),
                    is_original: false,
                });
            }
        }
    }
    entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    entries
}

pub fn restore_backup(backup_id: &str, version_path: &Path) -> Result<(), String> {
    let backup_dir = get_backup_base_dir().join(backup_id);
    if !backup_dir.exists() {
        return Err("Backup not found".to_string());
    }
    let cursor_dest = get_cursor_path(version_path);
    let far_cursor_dest = get_far_cursor_path(version_path);
    let locked_cursor_dest = get_locked_cursor_path(version_path);

    let backup_cursor = backup_dir.join("ArrowCursor.png");
    let backup_far = backup_dir.join("ArrowFarCursor.png");
    let backup_locked = backup_dir.join("MouseLockedCursor.png");

    if backup_cursor.exists() {
        std::fs::copy(&backup_cursor, &cursor_dest)
            .map_err(|e| format!("Failed to restore from backup: {}", e))?;
    }
    if backup_far.exists() {
        std::fs::copy(&backup_far, &far_cursor_dest)
            .map_err(|e| format!("Failed to restore from backup: {}", e))?;
    }
    if backup_locked.exists() {
        std::fs::copy(&backup_locked, &locked_cursor_dest)
            .map_err(|e| format!("Failed to restore from backup: {}", e))?;
    }
    Ok(())
}

pub fn save_emote_bg_original_if_needed(version_path: &Path) -> Result<(), String> {
    ensure_backup_dirs()?;
    let originals_dir = get_originals_dir();
    let marker = originals_dir.join("emote_bg_saved.flag");
    if marker.exists() {
        return Ok(());
    }
    let emote_bg = get_emote_bg_path(version_path);
    if emote_bg.exists() {
        let ext = emote_bg.extension().unwrap_or_default().to_string_lossy();
        let dest = originals_dir.join(format!("SegmentedCircle.{}", ext));
        std::fs::copy(&emote_bg, &dest)
            .map_err(|e| format!("Failed to backup original emote bg: {}", e))?;
    }
    std::fs::write(&marker, "saved")
        .map_err(|e| format!("Failed to write emote bg backup marker: {}", e))?;
    Ok(())
}

pub fn restore_emote_bg_original(version_path: &Path) -> Result<(), String> {
    let originals_dir = get_originals_dir();
    let emote_bg_dest = get_emote_bg_path(version_path);

    for ext in &["png", "jpg", "jpeg", "webp", "dds"] {
        let original = originals_dir.join(format!("SegmentedCircle.{}", ext));
        if original.exists() {
            std::fs::copy(&original, &emote_bg_dest)
                .map_err(|e| format!("Failed to restore emote bg: {}", e))?;
            return Ok(());
        }
    }

    if emote_bg_dest.exists() {
        std::fs::remove_file(&emote_bg_dest)
            .map_err(|e| format!("Failed to remove custom emote bg: {}", e))?;
    }
    Ok(())
}
