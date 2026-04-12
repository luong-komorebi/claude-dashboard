pub mod stats;
pub mod usage;
pub mod projects;
pub mod plugins;
pub mod todos;
pub mod sessions;
pub mod settings;

use anyhow::Result;
use serde::Serialize;

#[derive(Serialize, Clone, Default)]
pub struct DashboardData {
    pub stats: stats::StatsData,
    pub usage: usage::UsageData,
    pub projects: Vec<projects::Project>,
    pub plugins: Vec<plugins::Plugin>,
    pub todos: todos::TodosData,
    pub sessions: Vec<sessions::Session>,
    pub settings: settings::SettingsData,
}

pub fn claude_dir() -> std::path::PathBuf {
    dirs::home_dir()
        .expect("home dir not found")
        .join(".claude")
}

pub async fn load_all() -> Result<DashboardData> {
    let base = claude_dir();
    load_all_from(&base)
}

pub fn load_all_from(base: &std::path::Path) -> Result<DashboardData> {
    Ok(DashboardData {
        stats: stats::load_from(base)?,
        usage: usage::load_from(base)?,
        projects: projects::load_from(base)?,
        plugins: plugins::load_from(base)?,
        todos: todos::load_from(base)?,
        sessions: sessions::load_from(base)?,
        settings: settings::load_from(base)?,
    })
}
