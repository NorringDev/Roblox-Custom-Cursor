mod commands;
mod core;
mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::roblox::detect_roblox,
            commands::roblox::get_active_version_path,
            commands::roblox::check_roblox_update,
            commands::roblox::get_current_crosshair,
            commands::crosshair::apply_crosshair,
            commands::crosshair::restore_default,
            commands::crosshair::restore_backup,
            commands::crosshair::get_backups,
            commands::library::import_crosshair,
            commands::library::get_library,
            commands::library::delete_library_item,
            commands::library::rename_library_item,
            commands::library::clear_library,
            commands::library::save_drawn_crosshair,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::validate_image,
            commands::premade::init_premade,
            commands::premade::get_premade_crosshairs,
            commands::premade::get_premade_preview,
            commands::premade::apply_premade_crosshair,
            commands::emote_wheel::apply_emote_bg,
            commands::emote_wheel::restore_emote_bg,
            commands::emote_wheel::get_emote_bg_status,
            commands::emote_wheel::save_emote_bg_collection,
            commands::emote_wheel::get_emote_bg_collection,
            commands::emote_wheel::delete_emote_bg_collection,
            commands::emote_wheel::apply_emote_bg_collection,
            commands::multi_instance::create_instance,
            commands::multi_instance::launch_instance,
            commands::multi_instance::stop_instance,
            commands::multi_instance::get_instances,
            commands::multi_instance::delete_instance,
            commands::multi_instance::get_multi_instance_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
