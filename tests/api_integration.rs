use std::fs;
use tempfile::TempDir;

// Helpers to build a minimal ~/.claude structure in a temp dir
fn setup_test_dir() -> TempDir {
    let dir = TempDir::new().unwrap();
    let base = dir.path();

    // stats-cache.json
    fs::write(
        base.join("stats-cache.json"),
        serde_json::json!({
            "version": 1,
            "lastComputedDate": "2026-04-12",
            "dailyActivity": [
                { "date": "2026-04-10", "messageCount": 100, "sessionCount": 2, "toolCallCount": 30 },
                { "date": "2026-04-11", "messageCount": 200, "sessionCount": 3, "toolCallCount": 60 }
            ]
        })
        .to_string(),
    )
    .unwrap();

    // usage-data/facets
    let facets = base.join("usage-data").join("facets");
    fs::create_dir_all(&facets).unwrap();
    fs::write(
        facets.join("session-1.json"),
        serde_json::json!({
            "session_id": "session-1",
            "brief_summary": "Fix auth bug",
            "outcome": "mostly_achieved",
            "claude_helpfulness": "very_helpful",
            "session_type": "bug_fix"
        })
        .to_string(),
    )
    .unwrap();

    // projects
    let proj = base.join("projects").join("-Users-test-repo");
    let mem = proj.join("memory");
    fs::create_dir_all(&mem).unwrap();
    fs::write(
        mem.join("user.md"),
        "---\nname: User role\ntype: user\n---\nSenior engineer",
    )
    .unwrap();

    // plugins
    let plugins_dir = base.join("plugins");
    fs::create_dir_all(&plugins_dir).unwrap();
    fs::write(
        plugins_dir.join("installed_plugins.json"),
        serde_json::json!({ "version": 1, "plugins": { "superpowers@official": {} } }).to_string(),
    )
    .unwrap();

    // settings.json
    fs::write(
        base.join("settings.json"),
        serde_json::json!({
            "permissions": { "allow": ["WebSearch", "Bash(git:*)"] },
            "enabledPlugins": { "superpowers@official": true },
            "effortLevel": "high",
            "alwaysThinkingEnabled": false
        })
        .to_string(),
    )
    .unwrap();

    // todos
    let todos_dir = base.join("todos");
    fs::create_dir_all(&todos_dir).unwrap();
    fs::write(
        todos_dir.join("session-abc.json"),
        serde_json::json!([
            { "content": "Write tests", "status": "in_progress", "activeForm": "Writing tests" },
            { "content": "Review PR", "status": "pending", "activeForm": "Reviewing PR" }
        ])
        .to_string(),
    )
    .unwrap();

    // plans
    let plans_dir = base.join("plans");
    fs::create_dir_all(&plans_dir).unwrap();
    fs::write(plans_dir.join("my-plan.md"), "# My Plan\nStep 1\nStep 2").unwrap();

    // history.jsonl
    fs::write(
        base.join("history.jsonl"),
        [
            serde_json::json!({ "display": "cargo test", "timestamp": 2000, "project": "/repo" }),
            serde_json::json!({ "display": "git status", "timestamp": 1000, "project": "/repo" }),
        ]
        .iter()
        .map(|v| v.to_string())
        .collect::<Vec<_>>()
        .join("\n"),
    )
    .unwrap();

    dir
}

mod data_integration {
    use super::*;
    use claude_dashboard::data;

    #[test]
    fn load_all_from_succeeds_with_full_fixture() {
        let dir = setup_test_dir();
        let result = data::load_all_from(dir.path());
        assert!(result.is_ok(), "load_all_from failed: {:?}", result.err());
    }

    #[test]
    fn stats_totals_match_fixture() {
        let dir = setup_test_dir();
        let d = data::load_all_from(dir.path()).unwrap();
        assert_eq!(d.stats.total_messages, 300);
        assert_eq!(d.stats.active_days, 2);
    }

    #[test]
    fn usage_sessions_loaded() {
        let dir = setup_test_dir();
        let d = data::load_all_from(dir.path()).unwrap();
        assert_eq!(d.usage.total_sessions, 1);
        assert_eq!(d.usage.outcome_counts["mostly_achieved"], 1);
    }

    #[test]
    fn projects_loaded_with_memory() {
        let dir = setup_test_dir();
        let d = data::load_all_from(dir.path()).unwrap();
        assert_eq!(d.projects.len(), 1);
        assert_eq!(d.projects[0].memory_files.len(), 1);
    }

    #[test]
    fn plugins_enabled_status() {
        let dir = setup_test_dir();
        let d = data::load_all_from(dir.path()).unwrap();
        assert_eq!(d.plugins.len(), 1);
        assert!(d.plugins[0].enabled);
        assert_eq!(d.plugins[0].id, "superpowers@official");
    }

    #[test]
    fn todos_counts_correct() {
        let dir = setup_test_dir();
        let d = data::load_all_from(dir.path()).unwrap();
        assert_eq!(d.todos.in_progress_count, 1);
        assert_eq!(d.todos.pending_count, 1);
        assert_eq!(d.todos.plans.len(), 1);
    }

    #[test]
    fn settings_parsed() {
        let dir = setup_test_dir();
        let d = data::load_all_from(dir.path()).unwrap();
        assert_eq!(d.settings.allowed_tools.len(), 2);
        assert_eq!(d.settings.effort_level.as_deref(), Some("high"));
        assert_eq!(d.settings.always_thinking, Some(false));
        assert_eq!(d.settings.recent_history.len(), 2);
    }

    #[test]
    fn load_all_from_empty_dir_returns_defaults() {
        let dir = TempDir::new().unwrap();
        let d = data::load_all_from(dir.path()).unwrap();
        assert_eq!(d.stats.active_days, 0);
        assert!(d.projects.is_empty());
        assert!(d.plugins.is_empty());
    }
}
