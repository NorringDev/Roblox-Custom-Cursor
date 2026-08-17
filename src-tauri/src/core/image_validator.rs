use crate::models::ValidationResult;
use image::{GenericImageView, RgbaImage, Rgba};
use std::path::Path;

pub fn validate_image(path: &Path) -> ValidationResult {
    if !path.exists() {
        return ValidationResult {
            valid: false,
            width: 0,
            height: 0,
            has_alpha: false,
            message: "File not found".to_string(),
        };
    }

    let ext = path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();

    match ext.as_str() {
        "png" | "jpg" | "jpeg" | "webp" => {}
        _ => {
            return ValidationResult {
                valid: false,
                width: 0,
                height: 0,
                has_alpha: false,
                message: format!(
                    "Unsupported format '{}'. Use PNG, JPG, JPEG, or WEBP.",
                    ext
                ),
            };
        }
    }

    match image::open(path) {
        Ok(img) => {
            let (w, h) = img.dimensions();
            let has_alpha = img.color().has_alpha();

            let mut message = String::new();

            if w > 256 || h > 256 {
                message.push_str(&format!(
                    "Image is {}x{} pixels. Recommended max 256x256. ",
                    w, h
                ));
            }

            if w < 16 || h < 16 {
                message.push_str(&format!(
                    "Image is {}x{} pixels. Minimum recommended 16x16. ",
                    w, h
                ));
            }

            if w != h {
                message.push_str("Image is not square. Recommended square ratio. ");
            }

            if ext == "png" && !has_alpha {
                message.push_str("PNG has no transparency. Transparent background recommended. ");
            }

            if ext == "jpg" || ext == "jpeg" {
                message.push_str("JPG does not support transparency. PNG recommended. ");
            }

            if message.is_empty() {
                message = format!("Valid {}x{} image. Ready to use!", w, h);
            }

            ValidationResult {
                valid: true,
                width: w,
                height: h,
                has_alpha,
                message,
            }
        }
        Err(e) => ValidationResult {
            valid: false,
            width: 0,
            height: 0,
            has_alpha: false,
            message: format!("Failed to read image: {}", e),
        },
    }
}

pub fn prepare_cursor_image(src_path: &Path, dest_path: &Path) -> Result<(), String> {
    let img = image::open(src_path)
        .map_err(|e| format!("Failed to open image: {}", e))?;

    let resized = img.resize(64, 64, image::imageops::FilterType::Lanczos3);

    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    resized
        .save(dest_path)
        .map_err(|e| format!("Failed to save cursor image: {}", e))?;

    Ok(())
}

fn set_pixel(img: &mut RgbaImage, x: i32, y: i32, r: u8, g: u8, b: u8) {
    let w = img.width() as i32;
    let h = img.height() as i32;
    if x >= 0 && x < w && y >= 0 && y < h {
        img.put_pixel(x as u32, y as u32, Rgba([r, g, b, 255]));
    }
}

fn draw_line(img: &mut RgbaImage, x0: i32, y0: i32, x1: i32, y1: i32, r: u8, g: u8, b: u8, thickness: i32) {
    let dx = (x1 - x0).abs();
    let dy = (y1 - y0).abs();
    let sx = if x0 < x1 { 1 } else { -1 };
    let sy = if y0 < y1 { 1 } else { -1 };
    let mut err = dx - dy;
    let mut x = x0;
    let mut y = y0;
    let half = thickness / 2;
    loop {
        for tx in -half..=half {
            for ty in -half..=half {
                set_pixel(img, x + tx, y + ty, r, g, b);
            }
        }
        if x == x1 && y == y1 { break; }
        let e2 = 2 * err;
        if e2 > -dy { err -= dy; x += sx; }
        if e2 < dx { err += dx; y += sy; }
    }
}

fn draw_circle(img: &mut RgbaImage, cx: i32, cy: i32, radius: i32, r: u8, g: u8, b: u8) {
    let mut angle = 0.0_f64;
    while angle < 360.0 {
        let rad = angle * std::f64::consts::PI / 180.0;
        let x = cx as f64 + rad.cos() * radius as f64;
        let y = cy as f64 + rad.sin() * radius as f64;
        set_pixel(img, x as i32, y as i32, r, g, b);
        angle += 0.5;
    }
}

fn filled_circle(img: &mut RgbaImage, cx: i32, cy: i32, radius: i32, r: u8, g: u8, b: u8) {
    for dy in -radius..=radius {
        for dx in -radius..=radius {
            if dx * dx + dy * dy <= radius * radius {
                set_pixel(img, cx + dx, cy + dy, r, g, b);
            }
        }
    }
}

pub fn generate_builtin_crosshair(id: &str, dest_path: &Path) -> Result<(), String> {
    let size: u32 = 64;
    let mut img = RgbaImage::new(size, size);
    let c = (size / 2) as i32;

    match id {
        "classic" => {
            for i in 0..10 {
                draw_line(&mut img, 3, 3 + i, 3 + i * 2, 3 + i, 255, 255, 255, 2);
            }
            draw_line(&mut img, 12, 14, 16, 22, 255, 255, 255, 2);
            draw_line(&mut img, 15, 15, 22, 16, 255, 255, 255, 2);
        }
        "dot" => {
            filled_circle(&mut img, c, c, 3, 255, 255, 255);
        }
        "small-cross" => {
            draw_line(&mut img, c, c - 6, c, c - 2, 255, 255, 255, 1);
            draw_line(&mut img, c, c + 2, c, c + 6, 255, 255, 255, 1);
            draw_line(&mut img, c - 6, c, c - 2, c, 255, 255, 255, 1);
            draw_line(&mut img, c + 2, c, c + 6, c, 255, 255, 255, 1);
        }
        "minimal" => {
            draw_line(&mut img, c - 5, c, c + 5, c, 220, 220, 220, 1);
            draw_line(&mut img, c, c - 5, c, c + 5, 220, 220, 220, 1);
            set_pixel(&mut img, c, c, 255, 60, 60);
        }
        "circle" => {
            draw_circle(&mut img, c, c, 12, 255, 255, 255);
            set_pixel(&mut img, c, c, 255, 60, 60);
        }
        "hollow-circle" => {
            draw_circle(&mut img, c, c, 14, 200, 200, 200);
        }
        "thin-cross" => {
            draw_line(&mut img, c, c - 16, c, c - 3, 255, 255, 255, 1);
            draw_line(&mut img, c, c + 3, c, c + 16, 255, 255, 255, 1);
            draw_line(&mut img, c - 16, c, c - 3, c, 255, 255, 255, 1);
            draw_line(&mut img, c + 3, c, c + 16, c, 255, 255, 255, 1);
        }
        "thick-cross" => {
            draw_line(&mut img, c, c - 16, c, c - 3, 255, 255, 255, 3);
            draw_line(&mut img, c, c + 3, c, c + 16, 255, 255, 255, 3);
            draw_line(&mut img, c - 16, c, c - 3, c, 255, 255, 255, 3);
            draw_line(&mut img, c + 3, c, c + 16, c, 255, 255, 255, 3);
        }
        "rgb" => {
            draw_line(&mut img, c, c - 14, c, c - 2, 255, 50, 50, 2);
            draw_line(&mut img, c, c + 2, c, c + 14, 50, 50, 255, 2);
            draw_line(&mut img, c - 14, c, c - 2, c, 50, 255, 50, 2);
            draw_line(&mut img, c + 2, c, c + 14, c, 255, 255, 50, 2);
            filled_circle(&mut img, c, c, 2, 255, 255, 255);
        }
        "clean" => {
            draw_line(&mut img, c - 10, c, c + 10, c, 255, 255, 255, 1);
            draw_line(&mut img, c, c - 10, c, c + 10, 255, 255, 255, 1);
        }
        "competitive" => {
            draw_line(&mut img, c, c - 12, c, c - 3, 0, 255, 100, 2);
            draw_line(&mut img, c, c + 3, c, c + 12, 0, 255, 100, 2);
            draw_line(&mut img, c - 12, c, c - 3, c, 0, 255, 100, 2);
            draw_line(&mut img, c + 3, c, c + 12, c, 0, 255, 100, 2);
            filled_circle(&mut img, c, c, 2, 0, 255, 100);
        }
        "valorant-style" => {
            draw_line(&mut img, c, c - 14, c, c - 4, 255, 70, 70, 2);
            draw_line(&mut img, c, c + 4, c, c + 14, 255, 70, 70, 2);
            draw_line(&mut img, c - 14, c, c - 4, c, 255, 70, 70, 2);
            draw_line(&mut img, c + 4, c, c + 14, c, 255, 70, 70, 2);
        }
        "cs-style" => {
            draw_line(&mut img, c, c - 12, c, c - 3, 0, 200, 255, 2);
            draw_line(&mut img, c, c + 3, c, c + 12, 0, 200, 255, 2);
            draw_line(&mut img, c - 12, c, c - 3, c, 0, 200, 255, 2);
            draw_line(&mut img, c + 3, c, c + 12, c, 0, 200, 255, 2);
        }
        _ => {
            return Err(format!("Unknown crosshair ID: {}", id));
        }
    }

    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    img.save(dest_path)
        .map_err(|e| format!("Failed to save crosshair image: {}", e))?;

    Ok(())
}

pub fn is_builtin_crosshair(source_path: &str) -> bool {
    let builtins = [
        "classic", "dot", "small-cross", "minimal", "circle",
        "hollow-circle", "thin-cross", "thick-cross", "rgb",
        "clean", "competitive", "valorant-style", "cs-style",
    ];
    builtins.contains(&source_path)
}
