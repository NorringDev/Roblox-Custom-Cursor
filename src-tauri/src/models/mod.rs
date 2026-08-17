use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RobloxStatus {
    pub installed: bool,
    pub version_path: String,
    pub version_id: String,
    pub cursor_path: String,
    pub current_crosshair_name: Option<String>,
    pub is_modified: bool,
    pub last_checked: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(alias = "roblox_path")]
    pub roblox_path: String,
    #[serde(alias = "auto_detect_roblox")]
    pub auto_detect_roblox: bool,
    #[serde(alias = "auto_backup")]
    pub auto_backup: bool,
    #[serde(alias = "launch_on_startup")]
    pub launch_on_startup: bool,
    #[serde(alias = "theme")]
    pub theme: String,
    #[serde(default, alias = "active_crosshair_id")]
    pub active_crosshair_id: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            roblox_path: String::new(),
            auto_detect_roblox: true,
            auto_backup: true,
            launch_on_startup: false,
            theme: "dark".to_string(),
            active_crosshair_id: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub id: String,
    pub crosshair_name: String,
    pub timestamp: String,
    pub file_path: String,
    pub is_original: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub thumbnail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    pub width: u32,
    pub height: u32,
    pub has_alpha: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub success: bool,
    pub message: String,
    pub saved_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub updated: bool,
    pub new_version: String,
}
