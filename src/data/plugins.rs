use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;
use super::claude_dir;

#[derive(Serialize, Clone)]
pub struct Plugin {
    pub id: String,
    pub enabled: bool,
}

#[derive(Deserialize)]
struct InstalledPlugins {
    plugins: std::collections::HashMap<String, serde_json::Value>,
}

pub fn load() -> Result<Vec<Plugin>> {
    load_from(&claude_dir())
}

pub fn load_from(base: &Path) -> Result<Vec<Plugin>> {
    let path = base.join("plugins").join("installed_plugins.json");
    let settings_path = base.join("settings.json");

    let enabled_plugins: std::collections::HashSet<String> = if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)?;
        let settings: serde_json::Value = serde_json::from_str(&content)?;
        settings["enabledPlugins"]
            .as_object()
            .map(|obj| {
                obj.iter()
                    .filter_map(|(k, v)| if v.as_bool().unwrap_or(false) { Some(k.clone()) } else { None })
                    .collect()
            })
            .unwrap_or_default()
    } else {
        Default::default()
    };

    if !path.exists() {
        return Ok(vec![]);
    }

    let content = std::fs::read_to_string(&path)?;
    let installed: InstalledPlugins = serde_json::from_str(&content)?;

    let mut plugins: Vec<Plugin> = installed
        .plugins
        .keys()
        .map(|id| Plugin {
            enabled: enabled_plugins.contains(id),
            id: id.clone(),
        })
        .collect();

    plugins.sort_by(|a, b| b.enabled.cmp(&a.enabled).then(a.id.cmp(&b.id)));
    Ok(plugins)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_installed(base: &Path, plugin_ids: &[&str]) {
        let plugins_dir = base.join("plugins");
        fs::create_dir_all(&plugins_dir).unwrap();
        let mut map = serde_json::Map::new();
        for id in plugin_ids {
            map.insert(id.to_string(), serde_json::json!({}));
        }
        let data = serde_json::json!({ "version": 1, "plugins": map });
        fs::write(plugins_dir.join("installed_plugins.json"), data.to_string()).unwrap();
    }

    fn write_settings(base: &Path, enabled: &[&str]) {
        let mut map = serde_json::Map::new();
        for id in enabled {
            map.insert(id.to_string(), serde_json::json!(true));
        }
        let data = serde_json::json!({ "enabledPlugins": map });
        fs::write(base.join("settings.json"), data.to_string()).unwrap();
    }

    #[test]
    fn returns_empty_when_installed_missing() {
        let dir = TempDir::new().unwrap();
        let plugins = load_from(dir.path()).unwrap();
        assert!(plugins.is_empty());
    }

    #[test]
    fn marks_enabled_plugins_correctly() {
        let dir = TempDir::new().unwrap();
        write_installed(dir.path(), &["plugin-a", "plugin-b", "plugin-c"]);
        write_settings(dir.path(), &["plugin-a", "plugin-c"]);

        let plugins = load_from(dir.path()).unwrap();
        let enabled: Vec<_> = plugins.iter().filter(|p| p.enabled).map(|p| p.id.as_str()).collect();
        let disabled: Vec<_> = plugins.iter().filter(|p| !p.enabled).map(|p| p.id.as_str()).collect();

        assert!(enabled.contains(&"plugin-a"));
        assert!(enabled.contains(&"plugin-c"));
        assert!(disabled.contains(&"plugin-b"));
    }

    #[test]
    fn enabled_plugins_sorted_before_disabled() {
        let dir = TempDir::new().unwrap();
        write_installed(dir.path(), &["z-disabled", "a-enabled"]);
        write_settings(dir.path(), &["a-enabled"]);

        let plugins = load_from(dir.path()).unwrap();
        assert!(plugins[0].enabled);
        assert!(!plugins[1].enabled);
    }

    #[test]
    fn no_settings_file_all_disabled() {
        let dir = TempDir::new().unwrap();
        write_installed(dir.path(), &["plugin-a", "plugin-b"]);
        // no settings.json written

        let plugins = load_from(dir.path()).unwrap();
        assert!(plugins.iter().all(|p| !p.enabled));
    }
}
