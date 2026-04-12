use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;
use super::claude_dir;

#[derive(Serialize, Clone, Default)]
pub struct SettingsData {
    pub allowed_tools: Vec<String>,
    pub enabled_plugins: Vec<String>,
    pub disabled_plugins: Vec<String>,
    pub effort_level: Option<String>,
    pub always_thinking: Option<bool>,
    pub recent_history: Vec<HistoryEntry>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HistoryEntry {
    pub display: String,
    pub timestamp: Option<i64>,
    pub project: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawSettings {
    permissions: Option<Permissions>,
    enabled_plugins: Option<std::collections::HashMap<String, bool>>,
    effort_level: Option<String>,
    always_thinking_enabled: Option<bool>,
}

#[derive(Deserialize)]
struct Permissions {
    allow: Option<Vec<String>>,
}

pub fn load() -> Result<SettingsData> {
    load_from(&claude_dir())
}

pub fn load_from(base: &Path) -> Result<SettingsData> {
    let settings_path = base.join("settings.json");
    let history_path = base.join("history.jsonl");

    let mut allowed_tools = Vec::new();
    let mut enabled_plugins = Vec::new();
    let mut disabled_plugins = Vec::new();
    let mut effort_level = None;
    let mut always_thinking = None;

    if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)?;
        if let Ok(raw) = serde_json::from_str::<RawSettings>(&content) {
            if let Some(perms) = raw.permissions {
                allowed_tools = perms.allow.unwrap_or_default();
            }
            if let Some(plugins) = raw.enabled_plugins {
                for (id, en) in plugins {
                    if en {
                        enabled_plugins.push(id);
                    } else {
                        disabled_plugins.push(id);
                    }
                }
                enabled_plugins.sort();
                disabled_plugins.sort();
            }
            effort_level = raw.effort_level;
            always_thinking = raw.always_thinking_enabled;
        }
    }

    let mut recent_history = Vec::new();
    if history_path.exists() {
        let content = std::fs::read_to_string(&history_path)?;
        let mut entries: Vec<HistoryEntry> = content
            .lines()
            .filter_map(|line| serde_json::from_str(line).ok())
            .collect();
        entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        entries.dedup_by(|a, b| a.display == b.display);
        recent_history = entries.into_iter().take(50).collect();
    }

    Ok(SettingsData {
        allowed_tools,
        enabled_plugins,
        disabled_plugins,
        effort_level,
        always_thinking,
        recent_history,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_settings(base: &Path, json: serde_json::Value) {
        fs::write(base.join("settings.json"), json.to_string()).unwrap();
    }

    fn write_history(base: &Path, entries: &[(&str, Option<i64>)]) {
        let lines: Vec<String> = entries
            .iter()
            .map(|(display, ts)| {
                serde_json::json!({ "display": display, "timestamp": ts, "project": "/some/project" })
                    .to_string()
            })
            .collect();
        fs::write(base.join("history.jsonl"), lines.join("\n")).unwrap();
    }

    #[test]
    fn returns_default_when_files_missing() {
        let dir = TempDir::new().unwrap();
        let data = load_from(dir.path()).unwrap();
        assert!(data.allowed_tools.is_empty());
        assert!(data.recent_history.is_empty());
        assert!(data.effort_level.is_none());
    }

    #[test]
    fn parses_allowed_tools() {
        let dir = TempDir::new().unwrap();
        write_settings(
            dir.path(),
            serde_json::json!({
                "permissions": { "allow": ["Bash(git:*)", "WebSearch", "Edit"] }
            }),
        );
        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.allowed_tools.len(), 3);
        assert!(data.allowed_tools.contains(&"WebSearch".to_string()));
    }

    #[test]
    fn parses_enabled_disabled_plugins() {
        let dir = TempDir::new().unwrap();
        write_settings(
            dir.path(),
            serde_json::json!({
                "enabledPlugins": {
                    "plugin-a": true,
                    "plugin-b": false,
                    "plugin-c": true
                }
            }),
        );
        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.enabled_plugins.len(), 2);
        assert_eq!(data.disabled_plugins.len(), 1);
        assert!(data.enabled_plugins.contains(&"plugin-a".to_string()));
        assert!(data.disabled_plugins.contains(&"plugin-b".to_string()));
    }

    #[test]
    fn parses_effort_and_thinking() {
        let dir = TempDir::new().unwrap();
        write_settings(
            dir.path(),
            serde_json::json!({
                "effortLevel": "high",
                "alwaysThinkingEnabled": true
            }),
        );
        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.effort_level.as_deref(), Some("high"));
        assert_eq!(data.always_thinking, Some(true));
    }

    #[test]
    fn history_sorted_by_timestamp_desc() {
        let dir = TempDir::new().unwrap();
        write_history(
            dir.path(),
            &[
                ("first command", Some(1000)),
                ("third command", Some(3000)),
                ("second command", Some(2000)),
            ],
        );
        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.recent_history[0].display, "third command");
        assert_eq!(data.recent_history[1].display, "second command");
        assert_eq!(data.recent_history[2].display, "first command");
    }

    #[test]
    fn history_deduplicates_by_display() {
        let dir = TempDir::new().unwrap();
        write_history(
            dir.path(),
            &[
                ("git status", Some(3000)),
                ("git status", Some(2000)),
                ("git log", Some(1000)),
            ],
        );
        let data = load_from(dir.path()).unwrap();
        let displays: Vec<&str> = data.recent_history.iter().map(|e| e.display.as_str()).collect();
        assert_eq!(displays.iter().filter(|&&d| d == "git status").count(), 1);
    }

    #[test]
    fn history_capped_at_50() {
        let dir = TempDir::new().unwrap();
        let entries: Vec<(&str, Option<i64>)> = (0..100)
            .map(|i| (Box::leak(format!("cmd-{}", i).into_boxed_str()) as &str, Some(i as i64)))
            .collect();
        write_history(dir.path(), &entries);
        let data = load_from(dir.path()).unwrap();
        assert!(data.recent_history.len() <= 50);
    }
}
