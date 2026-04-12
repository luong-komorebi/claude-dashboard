use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;
use super::claude_dir;

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DailyActivity {
    pub date: String,
    pub message_count: u64,
    pub session_count: u64,
    pub tool_call_count: u64,
}

#[derive(Serialize, Clone, Default)]
pub struct StatsData {
    pub daily_activity: Vec<DailyActivity>,
    pub total_messages: u64,
    pub total_sessions: u64,
    pub total_tool_calls: u64,
    pub active_days: usize,
    pub date_range: Option<(String, String)>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StatsCache {
    daily_activity: Vec<DailyActivity>,
}

pub fn load() -> Result<StatsData> {
    load_from(&claude_dir())
}

pub fn load_from(base: &Path) -> Result<StatsData> {
    let path = base.join("stats-cache.json");
    if !path.exists() {
        return Ok(StatsData::default());
    }

    let content = std::fs::read_to_string(&path)?;
    let cache: StatsCache = serde_json::from_str(&content)?;

    let total_messages = cache.daily_activity.iter().map(|d| d.message_count).sum();
    let total_sessions = cache.daily_activity.iter().map(|d| d.session_count).sum();
    let total_tool_calls = cache.daily_activity.iter().map(|d| d.tool_call_count).sum();
    let active_days = cache.daily_activity.len();
    let date_range = if active_days > 0 {
        Some((
            cache.daily_activity.first().unwrap().date.clone(),
            cache.daily_activity.last().unwrap().date.clone(),
        ))
    } else {
        None
    };

    Ok(StatsData {
        daily_activity: cache.daily_activity,
        total_messages,
        total_sessions,
        total_tool_calls,
        active_days,
        date_range,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn make_stats_cache(dir: &TempDir, days: &[(&str, u64, u64, u64)]) {
        let activity: Vec<serde_json::Value> = days
            .iter()
            .map(|(date, msgs, sessions, tools)| {
                serde_json::json!({
                    "date": date,
                    "messageCount": msgs,
                    "sessionCount": sessions,
                    "toolCallCount": tools
                })
            })
            .collect();
        let cache = serde_json::json!({ "version": 1, "dailyActivity": activity });
        fs::write(dir.path().join("stats-cache.json"), cache.to_string()).unwrap();
    }

    #[test]
    fn returns_default_when_file_missing() {
        let dir = TempDir::new().unwrap();
        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.active_days, 0);
        assert_eq!(data.total_messages, 0);
        assert!(data.date_range.is_none());
    }

    #[test]
    fn aggregates_totals_correctly() {
        let dir = TempDir::new().unwrap();
        make_stats_cache(
            &dir,
            &[
                ("2026-01-01", 100, 2, 30),
                ("2026-01-02", 200, 3, 60),
                ("2026-01-03", 50, 1, 10),
            ],
        );
        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.total_messages, 350);
        assert_eq!(data.total_sessions, 6);
        assert_eq!(data.total_tool_calls, 100);
        assert_eq!(data.active_days, 3);
    }

    #[test]
    fn date_range_is_first_and_last() {
        let dir = TempDir::new().unwrap();
        make_stats_cache(
            &dir,
            &[("2026-01-01", 10, 1, 5), ("2026-01-15", 20, 2, 8)],
        );
        let data = load_from(dir.path()).unwrap();
        let range = data.date_range.unwrap();
        assert_eq!(range.0, "2026-01-01");
        assert_eq!(range.1, "2026-01-15");
    }

    #[test]
    fn daily_activity_preserves_order() {
        let dir = TempDir::new().unwrap();
        make_stats_cache(
            &dir,
            &[
                ("2026-03-01", 5, 1, 2),
                ("2026-03-05", 15, 2, 6),
                ("2026-03-10", 25, 3, 10),
            ],
        );
        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.daily_activity[0].date, "2026-03-01");
        assert_eq!(data.daily_activity[2].date, "2026-03-10");
    }
}
