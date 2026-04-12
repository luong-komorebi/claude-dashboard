use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;
use super::claude_dir;

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct SessionFacet {
    pub session_id: String,
    pub brief_summary: Option<String>,
    pub underlying_goal: Option<String>,
    pub outcome: Option<String>,
    pub claude_helpfulness: Option<String>,
    pub session_type: Option<String>,
}

#[derive(Serialize, Clone, Default)]
pub struct UsageData {
    pub facets: Vec<SessionFacet>,
    pub total_sessions: usize,
    pub outcome_counts: std::collections::HashMap<String, usize>,
    pub helpfulness_counts: std::collections::HashMap<String, usize>,
}

pub fn load() -> Result<UsageData> {
    load_from(&claude_dir())
}

pub fn load_from(base: &Path) -> Result<UsageData> {
    let facets_dir = base.join("usage-data").join("facets");
    if !facets_dir.exists() {
        return Ok(UsageData::default());
    }

    let mut facets = Vec::new();
    let mut outcome_counts = std::collections::HashMap::new();
    let mut helpfulness_counts = std::collections::HashMap::new();

    for entry in std::fs::read_dir(&facets_dir)? {
        let entry = entry?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let content = std::fs::read_to_string(entry.path())?;
        if let Ok(facet) = serde_json::from_str::<SessionFacet>(&content) {
            if let Some(ref outcome) = facet.outcome {
                *outcome_counts.entry(outcome.clone()).or_insert(0) += 1;
            }
            if let Some(ref h) = facet.claude_helpfulness {
                *helpfulness_counts.entry(h.clone()).or_insert(0) += 1;
            }
            facets.push(facet);
        }
    }

    let total_sessions = facets.len();
    Ok(UsageData {
        facets,
        total_sessions,
        outcome_counts,
        helpfulness_counts,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_facet(dir: &Path, id: &str, outcome: &str, helpfulness: &str) {
        let facets_dir = dir.join("usage-data").join("facets");
        fs::create_dir_all(&facets_dir).unwrap();
        let facet = serde_json::json!({
            "session_id": id,
            "brief_summary": format!("Session {}", id),
            "outcome": outcome,
            "claude_helpfulness": helpfulness,
            "session_type": "iterative_refinement"
        });
        fs::write(facets_dir.join(format!("{}.json", id)), facet.to_string()).unwrap();
    }

    #[test]
    fn returns_default_when_dir_missing() {
        let dir = TempDir::new().unwrap();
        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.total_sessions, 0);
        assert!(data.facets.is_empty());
    }

    #[test]
    fn counts_outcomes_correctly() {
        let dir = TempDir::new().unwrap();
        write_facet(dir.path(), "a", "mostly_achieved", "very_helpful");
        write_facet(dir.path(), "b", "mostly_achieved", "helpful");
        write_facet(dir.path(), "c", "partially_achieved", "very_helpful");

        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.total_sessions, 3);
        assert_eq!(data.outcome_counts["mostly_achieved"], 2);
        assert_eq!(data.outcome_counts["partially_achieved"], 1);
        assert_eq!(data.helpfulness_counts["very_helpful"], 2);
        assert_eq!(data.helpfulness_counts["helpful"], 1);
    }

    #[test]
    fn skips_non_json_files() {
        let dir = TempDir::new().unwrap();
        let facets_dir = dir.path().join("usage-data").join("facets");
        fs::create_dir_all(&facets_dir).unwrap();
        fs::write(facets_dir.join("notes.txt"), "not json").unwrap();
        write_facet(dir.path(), "valid", "mostly_achieved", "very_helpful");

        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.total_sessions, 1);
    }

    #[test]
    fn skips_malformed_json() {
        let dir = TempDir::new().unwrap();
        let facets_dir = dir.path().join("usage-data").join("facets");
        fs::create_dir_all(&facets_dir).unwrap();
        fs::write(facets_dir.join("bad.json"), "{ broken json }").unwrap();
        write_facet(dir.path(), "good", "mostly_achieved", "very_helpful");

        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.total_sessions, 1);
    }

    #[test]
    fn handles_missing_optional_fields() {
        let dir = TempDir::new().unwrap();
        let facets_dir = dir.path().join("usage-data").join("facets");
        fs::create_dir_all(&facets_dir).unwrap();
        let minimal = serde_json::json!({ "session_id": "minimal" });
        fs::write(facets_dir.join("minimal.json"), minimal.to_string()).unwrap();

        let data = load_from(dir.path()).unwrap();
        assert_eq!(data.total_sessions, 1);
        assert!(data.facets[0].outcome.is_none());
        assert!(data.outcome_counts.is_empty());
    }
}
