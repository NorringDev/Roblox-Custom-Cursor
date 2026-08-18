use std::path::PathBuf;
use image::GenericImageView;
use crate::core::{roblox_detector, backup, image_validator};
use crate::models::CommandResult;

#[tauri::command]
pub fn apply_emote_bg(
    source_path: String,
    zoom: f64,
    offset_x: f64,
    offset_y: f64,
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

    let img = image::open(&src)
        .map_err(|e| format!("Failed to open image: {}", e))?;

    let canvas_size: u32 = 256;
    let mut output = image::RgbaImage::new(canvas_size, canvas_size);

    let img_w = img.width() as f64;
    let img_h = img.height() as f64;
    let base_scale = (canvas_size as f64 / img_w).max(canvas_size as f64 / img_h);
    let scale = base_scale * zoom;
    let draw_w = img_w * scale;
    let draw_h = img_h * scale;
    let draw_x = (canvas_size as f64 - draw_w) / 2.0 + offset_x;
    let draw_y = (canvas_size as f64 - draw_h) / 2.0 + offset_y;

    let cx = canvas_size as f64 / 2.0;
    let cy = canvas_size as f64 / 2.0;
    let radius = canvas_size as f64 / 2.0;

    for py in 0..canvas_size {
        for px in 0..canvas_size {
            let dx = px as f64 - cx;
            let dy = py as f64 - cy;
            if dx * dx + dy * dy <= radius * radius {
                let src_x = (px as f64 - draw_x) / scale;
                let src_y = (py as f64 - draw_y) / scale;
                if src_x >= 0.0
                    && src_x < img_w
                    && src_y >= 0.0
                    && src_y < img_h
                {
                    let sample_x = src_x.round() as u32;
                    let sample_y = src_y.round() as u32;
                    let pixel = img.get_pixel(sample_x, sample_y);
                    output.put_pixel(px, py, pixel);
                }
            }
        }
    }

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
