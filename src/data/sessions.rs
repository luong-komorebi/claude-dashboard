use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;
use super::claude_dir;

#[derive(Serialize, Deserialize, Clone)]
pub struct Session {
    pub session_id: String,
    pub brief_summary: Option<String>,
    pub underlying_goal: Option<String>,
    pub outcome: Option<String>,
    pub claude_helpfulness: Option<String>,
    pub session_type: Option<String>,
}

pub fn load() -> Result<Vec<Session>> {
    load_from(&claude_dir())
}

pub fn load_from(base: &Path) -> Result<Vec<Session>> {
    let facets_dir = base.join("usage-data").join("facets");
    if !facets_dir.exists() {
        return Ok(vec![]);
    }

    let mut sessions = Vec::new();
    for entry in std::fs::read_dir(&facets_dir)? {
        let entry = entry?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let content = std::fs::read_to_string(entry.path())?;
        if let Ok(session) = serde_json::from_str::<Session>(&content) {
            sessions.push(session);
        }
    }

    Ok(sessions)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_session(base: &Path, id: &str, summary: &str, outcome: &str) {
        let facets_dir = base.join("usage-data").join("facets");
        fs::create_dir_all(&facets_dir).unwrap();
        let s = serde_json::json!({
            "session_id": id,
            "brief_summary": summary,
            "outcome": outcome,
            "claude_helpfulness": "very_helpful",
            "session_type": "feature_development"
        });
        fs::write(facets_dir.join(format!("{}.json", id)), s.to_string()).unwrap();
    }

    #[test]
    fn returns_empty_when_dir_missing() {
        let dir = TempDir::new().unwrap();
        let sessions = load_from(dir.path()).unwrap();
        assert!(sessions.is_empty());
    }

    #[test]
    fn loads_all_sessions() {
        let dir = TempDir::new().unwrap();
        write_session(dir.path(), "s1", "Fix linting", "mostly_achieved");
        write_session(dir.path(), "s2", "Add feature", "fully_achieved");
        write_session(dir.path(), "s3", "Debug crash", "partially_achieved");

        let sessions = load_from(dir.path()).unwrap();
        assert_eq!(sessions.len(), 3);
    }

    #[test]
    fn preserves_session_fields() {
        let dir = TempDir::new().unwrap();
        write_session(dir.path(), "abc123", "Implement auth", "mostly_achieved");

        let sessions = load_from(dir.path()).unwrap();
        let s = &sessions[0];
        assert_eq!(s.session_id, "abc123");
        assert_eq!(s.brief_summary.as_deref(), Some("Implement auth"));
        assert_eq!(s.outcome.as_deref(), Some("mostly_achieved"));
        assert_eq!(s.claude_helpfulness.as_deref(), Some("very_helpful"));
    }

    #[test]
    fn skips_malformed_json() {
        let dir = TempDir::new().unwrap();
        let facets_dir = dir.path().join("usage-data").join("facets");
        fs::create_dir_all(&facets_dir).unwrap();
        fs::write(facets_dir.join("corrupt.json"), "{ not valid }").unwrap();
        write_session(dir.path(), "good", "Good session", "mostly_achieved");

        let sessions = load_from(dir.path()).unwrap();
        assert_eq!(sessions.len(), 1);
    }
}
