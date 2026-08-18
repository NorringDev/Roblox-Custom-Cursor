use std::path::PathBuf;
use image::{Rgba, RgbaImage};
use crate::core::{roblox_detector, backup, image_validator};
use crate::models::CommandResult;

fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

fn sample_bilinear(img: &RgbaImage, x: f64, y: f64) -> Rgba<u8> {
    let w = img.width() as f64;
    let h = img.height() as f64;
    let x0 = x.floor().max(0.0).min(w - 1.0);
    let y0 = y.floor().max(0.0).min(h - 1.0);
    let x1 = (x0 + 1.0).min(w - 1.0);
    let y1 = (y0 + 1.0).min(h - 1.0);
    let fx = x - x.floor();
    let fy = y - y.floor();

    let p00 = img.get_pixel(x0 as u32, y0 as u32);
    let p10 = img.get_pixel(x1 as u32, y0 as u32);
    let p01 = img.get_pixel(x0 as u32, y1 as u32);
    let p11 = img.get_pixel(x1 as u32, y1 as u32);

    let mut result = [0u8; 4];
    for c in 0..4 {
        let top = lerp(p00[c] as f64, p10[c] as f64, fx);
        let bot = lerp(p01[c] as f64, p11[c] as f64, fx);
        result[c] = lerp(top, bot, fy).round() as u8;
    }
    Rgba(result)
}

fn render_emote_bg(
    source_path: &str,
    zoom: f64,
    offset_x: f64,
    offset_y: f64,
    border_color: &str,
    border_width: u32,
) -> Result<RgbaImage, String> {
    let src = PathBuf::from(source_path);
    let img = image::open(&src)
        .map_err(|e| format!("Failed to open image: {}", e))?;
    let img = img.to_rgba8();

    let border_w = if border_width > 0 { border_width } else { 0 };
    let canvas_size: u32 = 512 + border_w * 2;
    let mut output = RgbaImage::new(canvas_size, canvas_size);

    let img_w = img.width() as f64;
    let img_h = img.height() as f64;
    let base_scale = (512.0 / img_w).max(512.0 / img_h);
    let scale = base_scale * zoom;
    let draw_w = img_w * scale;
    let draw_h = img_h * scale;
    let draw_x = (512.0 - draw_w) / 2.0 + offset_x + border_w as f64;
    let draw_y = (512.0 - draw_h) / 2.0 + offset_y + border_w as f64;

    let cx = canvas_size as f64 / 2.0;
    let cy = canvas_size as f64 / 2.0;
    let radius = 512.0 / 2.0;

    let border_rgba = parse_color(border_color);

    for py in 0..canvas_size {
        for px in 0..canvas_size {
            let dx = px as f64 - cx;
            let dy = py as f64 - cy;
            let dist = (dx * dx + dy * dy).sqrt();

            if dist <= radius + border_w as f64 {
                if border_w > 0 && dist > radius {
                    let t = ((dist - radius) / border_w as f64).min(1.0);
                    let alpha = ((1.0 - t) * border_rgba[3] as f64).round() as u8;
                    output.put_pixel(px, py, Rgba([border_rgba[0], border_rgba[1], border_rgba[2], alpha]));
                } else if dist <= radius {
                    let src_x = (px as f64 - draw_x) / scale;
                    let src_y = (py as f64 - draw_y) / scale;
                    if src_x >= 0.0 && src_x < img_w && src_y >= 0.0 && src_y < img_h {
                        let pixel = sample_bilinear(&img, src_x, src_y);
                        output.put_pixel(px, py, pixel);
                    }
                }
            }
        }
    }

    Ok(output)
}

fn parse_color(color: &str) -> [u8; 4] {
    let c = color.trim_start_matches('#');
    match c.len() {
        6 => {
            let r = u8::from_str_radix(&c[0..2], 16).unwrap_or(255);
            let g = u8::from_str_radix(&c[2..4], 16).unwrap_or(255);
            let b = u8::from_str_radix(&c[4..6], 16).unwrap_or(255);
            [r, g, b, 255]
        }
        8 => {
            let r = u8::from_str_radix(&c[0..2], 16).unwrap_or(255);
            let g = u8::from_str_radix(&c[2..4], 16).unwrap_or(255);
            let b = u8::from_str_radix(&c[4..6], 16).unwrap_or(255);
            let a = u8::from_str_radix(&c[6..8], 16).unwrap_or(255);
            [r, g, b, a]
        }
        _ => [255, 255, 255, 255],
    }
}

fn get_collection_dir() -> PathBuf {
    let local = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    local.join("RobloxCrosshairManager").join("emote_bg_collection")
}

fn ensure_collection_dir() -> Result<PathBuf, String> {
    let dir = get_collection_dir();
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create collection directory: {}", e))?;
    Ok(dir)
}

#[tauri::command]
pub fn apply_emote_bg(
    source_path: String,
    zoom: f64,
    offset_x: f64,
    offset_y: f64,
    border_color: String,
    border_width: u32,
) -> Result<CommandResult, String> {
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

    let output = render_emote_bg(&source_path, zoom, offset_x, offset_y, &border_color, border_width)?;

    output.save(&emote_bg_dest)
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

#[tauri::command]
pub fn save_emote_bg_collection(
    name: String,
    source_path: String,
    zoom: f64,
    offset_x: f64,
    offset_y: f64,
    border_color: String,
    border_width: u32,
) -> Result<CommandResult, String> {
    let collection_dir = ensure_collection_dir()?;
    let id = uuid::Uuid::new_v4().to_string();

    let output = render_emote_bg(&source_path, zoom, offset_x, offset_y, &border_color, border_width)?;

    let img_path = collection_dir.join(format!("{}.png", id));
    output.save(&img_path)
        .map_err(|e| format!("Failed to save collection image: {}", e))?;

    let meta = serde_json::json!({
        "id": id,
        "name": name,
        "source_path": source_path,
        "zoom": zoom,
        "offset_x": offset_x,
        "offset_y": offset_y,
        "border_color": border_color,
        "border_width": border_width,
    });
    let meta_path = collection_dir.join(format!("{}.json", id));
    std::fs::write(&meta_path, serde_json::to_string_pretty(&meta).unwrap())
        .map_err(|e| format!("Failed to save metadata: {}", e))?;

    Ok(CommandResult {
        success: true,
        message: format!("'{}' saved to collection!", name),
    })
}

#[tauri::command]
pub fn get_emote_bg_collection() -> Result<Vec<serde_json::Value>, String> {
    let collection_dir = ensure_collection_dir()?;
    let mut items = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&collection_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&content) {
                        let id = meta["id"].as_str().unwrap_or("").to_string();
                        let img_path = collection_dir.join(format!("{}.png", id));
                        if img_path.exists() {
                            items.push(serde_json::json!({
                                "id": id,
                                "name": meta["name"].as_str().unwrap_or("Unknown"),
                                "path": img_path.to_string_lossy(),
                                "border_color": meta["border_color"].as_str().unwrap_or("#ffffff"),
                                "border_width": meta["border_width"].as_u64().unwrap_or(0),
                            }));
                        }
                    }
                }
            }
        }
    }

    items.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()));
    Ok(items)
}

#[tauri::command]
pub fn delete_emote_bg_collection(id: String) -> Result<CommandResult, String> {
    let collection_dir = get_collection_dir();
    let img = collection_dir.join(format!("{}.png", id));
    let meta = collection_dir.join(format!("{}.json", id));
    if img.exists() {
        std::fs::remove_file(&img).map_err(|e| format!("Failed to delete: {}", e))?;
    }
    if meta.exists() {
        std::fs::remove_file(&meta).map_err(|e| format!("Failed to delete metadata: {}", e))?;
    }
    Ok(CommandResult { success: true, message: "Deleted".to_string() })
}

#[tauri::command]
pub fn apply_emote_bg_collection(id: String) -> Result<CommandResult, String> {
    let collection_dir = get_collection_dir();
    let meta_path = collection_dir.join(format!("{}.json", id));
    if !meta_path.exists() {
        return Err("Collection item not found".to_string());
    }

    let content = std::fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;
    let meta: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid metadata: {}", e))?;

    let versions_dir =
        roblox_detector::get_roblox_versions_dir(None).ok_or("Roblox not found.")?;
    let version_path = roblox_detector::find_active_version(&versions_dir)
        .ok_or("No active Roblox version found.")?;

    roblox_detector::ensure_emote_bg_dir(&version_path)?;
    backup::save_emote_bg_original_if_needed(&version_path)?;

    let emote_bg_dest = roblox_detector::get_emote_bg_path(&version_path);
    let img_path = collection_dir.join(format!("{}.png", id));

    std::fs::copy(&img_path, &emote_bg_dest)
        .map_err(|e| format!("Failed to apply collection item: {}", e))?;

    Ok(CommandResult {
        success: true,
        message: "Applied from collection!".to_string(),
    })
}
