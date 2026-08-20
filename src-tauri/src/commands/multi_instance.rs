use std::path::PathBuf;
use std::os::windows::process::CommandExt;
use serde::{Deserialize, Serialize};
use crate::models::CommandResult;
use crate::core::roblox_detector;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RobloxInstance {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub status: String,
    pub pid: Option<u32>,
}

fn get_instances_dir() -> PathBuf {
    let local = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    local.join("RobloxCrosshairManager").join("instances")
}

fn get_instances_file() -> PathBuf {
    get_instances_dir().join("instances.json")
}

fn load_instances() -> Vec<RobloxInstance> {
    let file = get_instances_file();
    if file.exists() {
        if let Ok(content) = std::fs::read_to_string(&file) {
            if let Ok(instances) = serde_json::from_str(&content) {
                return instances;
            }
        }
    }
    Vec::new()
}

fn save_instances(instances: &[RobloxInstance]) -> Result<(), String> {
    let dir = get_instances_dir();
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create instances directory: {}", e))?;
    let file = get_instances_file();
    std::fs::write(&file, serde_json::to_string_pretty(instances).unwrap())
        .map_err(|e| format!("Failed to save instances: {}", e))?;
    Ok(())
}

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

fn get_roblox_version_path() -> Result<PathBuf, String> {
    let versions_dir = roblox_detector::get_roblox_versions_dir(None)
        .ok_or("Roblox not found.")?;
    roblox_detector::find_active_version(&versions_dir)
        .ok_or("No active Roblox version found.".to_string())
}

#[tauri::command]
pub fn create_instance(name: String) -> Result<CommandResult, String> {
    let _exe_path = get_roblox_exe_path()?;
    let _version_path = get_roblox_version_path()?;
    let instances = load_instances();

    let id = uuid::Uuid::new_v4().to_string();
    let instance_data_dir = get_instances_dir().join(&id);

    std::fs::create_dir_all(&instance_data_dir)
        .map_err(|e| format!("Failed to create instance directory: {}", e))?;

    let instance = RobloxInstance {
        id: id.clone(),
        name,
        created_at: chrono::Utc::now().to_rfc3339(),
        status: "stopped".to_string(),
        pid: None,
    };

    let mut new_instances = instances;
    new_instances.push(instance);
    save_instances(&new_instances)?;

    Ok(CommandResult {
        success: true,
        message: format!("Instance created at {}", instance_data_dir.display()),
    })
}

#[tauri::command]
pub fn launch_instance(id: String) -> Result<CommandResult, String> {
    let mut instances = load_instances();
    let instance = instances.iter_mut().find(|i| i.id == id)
        .ok_or("Instance not found")?;

    if instance.status == "running" {
        return Err("Instance is already running".to_string());
    }

    let exe_path = get_roblox_exe_path()?;
    let instance_data_dir = get_instances_dir().join(&id);
    let app_data_dir = instance_data_dir.join("AppData");
    let local_app_data_dir = instance_data_dir.join("LocalAppData");

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create AppData dir: {}", e))?;
    std::fs::create_dir_all(&local_app_data_dir)
        .map_err(|e| format!("Failed to create LocalAppData dir: {}", e))?;

    let app_data_str = app_data_dir.to_string_lossy().to_string();
    let local_app_data_str = local_app_data_dir.to_string_lossy().to_string();
    let exe_str = exe_path.to_string_lossy().to_string();

    let ps_script = format!(
        r#"
        $env:LOCALAPPDATA = '{}'
        $env:APPDATA = '{}'
        Start-Process -FilePath '{}' -ArgumentList '-appData','{}' -PassThru
        "#,
        local_app_data_str.replace("\\", "\\\\"),
        app_data_str.replace("\\", "\\\\"),
        exe_str.replace("\\", "\\\\"),
        app_data_str.replace("\\", "\\\\"),
    );

    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &ps_script])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| format!("Failed to launch Roblox: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Err(format!("Failed to launch: {} {}", stdout, stderr));
    }

    let pid_str = stdout.trim().lines().last().unwrap_or("");
    let pid = pid_str.parse::<u32>().ok();

    instance.status = "running".to_string();
    instance.pid = pid;
    save_instances(&instances)?;

    Ok(CommandResult {
        success: true,
        message: "Roblox instance launched!".to_string(),
    })
}

#[tauri::command]
pub fn stop_instance(id: String) -> Result<CommandResult, String> {
    let mut instances = load_instances();
    let instance = instances.iter_mut().find(|i| i.id == id)
        .ok_or("Instance not found")?;

    if instance.status != "running" {
        return Err("Instance is not running".to_string());
    }

    if let Some(pid) = instance.pid {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .creation_flags(0x08000000)
            .output();
    }

    instance.status = "stopped".to_string();
    instance.pid = None;
    save_instances(&instances)?;

    Ok(CommandResult {
        success: true,
        message: "Instance stopped".to_string(),
    })
}

#[tauri::command]
pub fn get_instances() -> Result<Vec<RobloxInstance>, String> {
    let instances = load_instances();
    Ok(instances)
}

#[tauri::command]
pub fn delete_instance(id: String) -> Result<CommandResult, String> {
    let mut instances = load_instances();

    if let Some(inst) = instances.iter().find(|i| i.id == id) {
        if inst.status == "running" {
            if let Some(pid) = inst.pid {
                let _ = std::process::Command::new("taskkill")
                    .args(["/PID", &pid.to_string(), "/F"])
                    .creation_flags(0x08000000)
                    .output();
            }
        }
    }

    let instance_data_dir = get_instances_dir().join(&id);
    if instance_data_dir.exists() {
        std::fs::remove_dir_all(&instance_data_dir)
            .map_err(|e| format!("Failed to delete instance data: {}", e))?;
    }

    instances.retain(|i| i.id != id);
    save_instances(&instances)?;

    Ok(CommandResult {
        success: true,
        message: "Instance deleted".to_string(),
    })
}

#[tauri::command]
pub fn get_multi_instance_status() -> Result<serde_json::Value, String> {
    let instances = load_instances();
    let running = instances.iter().filter(|i| i.status == "running").count();
    Ok(serde_json::json!({
        "total": instances.len(),
        "running": running,
    }))
}
