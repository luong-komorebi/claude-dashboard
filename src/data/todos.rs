use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;
use super::claude_dir;

#[derive(Serialize, Deserialize, Clone)]
pub struct TodoItem {
    pub content: String,
    pub status: String,
    #[serde(rename = "activeForm")]
    pub active_form: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct TodoSession {
    pub id: String,
    pub items: Vec<TodoItem>,
}

#[derive(Serialize, Clone)]
pub struct Plan {
    pub name: String,
    pub content: String,
}

#[derive(Serialize, Clone, Default)]
pub struct TodosData {
    pub sessions: Vec<TodoSession>,
    pub plans: Vec<Plan>,
    pub pending_count: usize,
    pub in_progress_count: usize,
    pub completed_count: usize,
}

pub fn load() -> Result<TodosData> {
    load_from(&claude_dir())
}

pub fn load_from(base: &Path) -> Result<TodosData> {
    let todos_dir = base.join("todos");
    let plans_dir = base.join("plans");

    let mut sessions = Vec::new();
    let mut pending_count = 0;
    let mut in_progress_count = 0;
    let mut completed_count = 0;

    if todos_dir.exists() {
        for entry in std::fs::read_dir(&todos_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            let id = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
            let content = std::fs::read_to_string(&path)?;
            if let Ok(items) = serde_json::from_str::<Vec<TodoItem>>(&content) {
                for item in &items {
                    match item.status.as_str() {
                        "pending" => pending_count += 1,
                        "in_progress" => in_progress_count += 1,
                        "completed" => completed_count += 1,
                        _ => {}
                    }
                }
                sessions.push(TodoSession { id, items });
            }
        }
    }

    let mut plans = Vec::new();
    if plans_dir.exists() {
        for entry in std::fs::read_dir(&plans_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }
            let name = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            plans.push(Plan { name, content });
        }
    }

    Ok(TodosData {
        sessions,
        plans,
        pending_count,
        in_progress_count,
        completed_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_todo_session(base: &Path, id: &str, items: &[(&str, &str)]) {
        let todos_dir = base.join("todos");
        fs::create_dir_all(&todos_dir).unwrap();
        let items_json: Vec<serde_json::Value> = items
            .iter()
            .map(|(content, status)| serde_json::json!({ "content": content, "status": status, "activeForm": content }))
            .collect();
        fs::write(
            todos_dir.join(format!("{}.json", id)),
            serde_json::to_string(&items_json).unwrap(),
        )
        .unwrap();
    }

    fn write_plan(base: &Path, name: &str, content: &str) {
        let plans_dir = base.join("plans");
        fs::create_dir_all(&plans_dir).unwrap();
        fs::write(plans_dir.join(format!("{}.md", name)), content).unwrap();
    }

    #[test]
    fn returns_default_when_dirs_missing() {
        let dir = TempDir::new().unwrap();
        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.sessions.len(), 0);
        assert_eq!(data.plans.len(), 0);
        assert_eq!(data.pending_count, 0);
    }

    #[test]
    fn counts_statuses_across_sessions() {
        let dir = TempDir::new().unwrap();
        write_todo_session(
            dir.path(),
            "session-1",
            &[("Task A", "pending"), ("Task B", "in_progress"), ("Task C", "completed")],
        );
        write_todo_session(
            dir.path(),
            "session-2",
            &[("Task D", "pending"), ("Task E", "completed")],
        );

        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.pending_count, 2);
        assert_eq!(data.in_progress_count, 1);
        assert_eq!(data.completed_count, 2);
    }

    #[test]
    fn loads_plans() {
        let dir = TempDir::new().unwrap();
        write_plan(dir.path(), "my-feature", "# Plan\nStep 1\nStep 2");
        write_plan(dir.path(), "other-plan", "# Other");

        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.plans.len(), 2);
        assert!(data.plans.iter().any(|p| p.name == "my-feature"));
    }

    #[test]
    fn skips_non_json_todo_files() {
        let dir = TempDir::new().unwrap();
        let todos_dir = dir.path().join("todos");
        fs::create_dir_all(&todos_dir).unwrap();
        fs::write(todos_dir.join("notes.txt"), "not json").unwrap();
        write_todo_session(dir.path(), "valid-session", &[("Task", "pending")]);

        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.sessions.len(), 1);
    }

    #[test]
    fn skips_non_md_plan_files() {
        let dir = TempDir::new().unwrap();
        let plans_dir = dir.path().join("plans");
        fs::create_dir_all(&plans_dir).unwrap();
        fs::write(plans_dir.join("draft.txt"), "not a plan").unwrap();
        write_plan(dir.path(), "real-plan", "# Plan");

        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.plans.len(), 1);
    }
}
