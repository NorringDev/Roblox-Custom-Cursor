use std::path::PathBuf;
use crate::core::image_validator;
use crate::models::{LibraryItem, ImportResult};

fn get_library_dir() -> PathBuf {
    let local = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    local.join("RobloxCrosshairManager").join("library")
}

pub fn ensure_library_dir() -> Result<PathBuf, String> {
    let dir = get_library_dir();
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create library directory: {}", e))?;
    Ok(dir)
}

#[tauri::command]
pub fn import_crosshair(
    file_path: String,
    name: String,
) -> Result<ImportResult, String> {
    let src = PathBuf::from(&file_path);
    if !src.exists() {
        return Err("File not found".to_string());
    }

    let validation = image_validator::validate_image(&src);
    if !validation.valid {
        return Err(format!("Invalid image: {}", validation.message));
    }

    let library_dir = ensure_library_dir()?;
    let id = uuid::Uuid::new_v4().to_string();
    let dest = library_dir.join(format!("{}.png", id));

    image_validator::prepare_cursor_image(&src, &dest)?;

    // Save metadata
    let meta_path = library_dir.join(format!("{}.json", id));
    let meta = serde_json::json!({
        "id": id,
        "name": name,
        "original_path": file_path,
    });
    std::fs::write(&meta_path, serde_json::to_string_pretty(&meta).unwrap())
        .map_err(|e| format!("Failed to save metadata: {}", e))?;

    Ok(ImportResult {
        success: true,
        message: format!("'{}' imported successfully!", name),
        saved_path: dest.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn get_library() -> Result<Vec<LibraryItem>, String> {
    let library_dir = ensure_library_dir()?;
    let mut items = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&library_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&content) {
                        let id = meta["id"].as_str().unwrap_or("").to_string();
                        let name = meta["name"].as_str().unwrap_or("Unknown").to_string();
                        let img_path = library_dir.join(format!("{}.png", id));
                        if img_path.exists() {
                            items.push(LibraryItem {
                                id,
                                name,
                                path: img_path.to_string_lossy().to_string(),
                                thumbnail: String::new(),
                            });
                        }
                    }
                }
            }
        }
    }

    items.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(items)
}

#[tauri::command]
pub fn delete_library_item(id: String) -> Result<crate::models::CommandResult, String> {
    let library_dir = ensure_library_dir()?;
    let img = library_dir.join(format!("{}.png", id));
    let meta = library_dir.join(format!("{}.json", id));
    if img.exists() {
        std::fs::remove_file(&img).map_err(|e| format!("Failed to delete: {}", e))?;
    }
    if meta.exists() {
        std::fs::remove_file(&meta).map_err(|e| format!("Failed to delete metadata: {}", e))?;
    }
    Ok(crate::models::CommandResult { success: true, message: "Deleted".to_string() })
}

#[tauri::command]
pub fn rename_library_item(id: String, new_name: String) -> Result<crate::models::CommandResult, String> {
    let library_dir = ensure_library_dir()?;
    let meta_path = library_dir.join(format!("{}.json", id));
    if meta_path.exists() {
        let content = std::fs::read_to_string(&meta_path)
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        let mut meta: serde_json::Value =
            serde_json::from_str(&content).map_err(|e| format!("Invalid metadata: {}", e))?;
        meta["name"] = serde_json::Value::String(new_name);
        std::fs::write(
            &meta_path,
            serde_json::to_string_pretty(&meta).unwrap(),
        )
        .map_err(|e| format!("Failed to save metadata: {}", e))?;
    }
    Ok(crate::models::CommandResult { success: true, message: "Renamed".to_string() })
}

#[tauri::command]
pub fn clear_library() -> Result<crate::models::CommandResult, String> {
    let library_dir = get_library_dir();
    if !library_dir.exists() {
        return Ok(crate::models::CommandResult { success: true, message: "Library already empty".to_string() });
    }
    let mut count = 0;
    if let Ok(entries) = std::fs::read_dir(&library_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                std::fs::remove_file(&path).ok();
                count += 1;
            }
        }
    }
    Ok(crate::models::CommandResult {
        success: true,
        message: format!("Removed {} files", count),
    })
}
