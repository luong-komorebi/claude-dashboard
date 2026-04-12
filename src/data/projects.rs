use anyhow::Result;
use serde::Serialize;
use std::path::Path;
use super::claude_dir;

#[derive(Serialize, Clone)]
pub struct MemoryFile {
    pub name: String,
    pub content: String,
}

#[derive(Serialize, Clone)]
pub struct Project {
    pub id: String,
    pub path: String,
    pub memory_files: Vec<MemoryFile>,
}

pub fn load() -> Result<Vec<Project>> {
    load_from(&claude_dir())
}

pub fn load_from(base: &Path) -> Result<Vec<Project>> {
    let projects_dir = base.join("projects");
    if !projects_dir.exists() {
        return Ok(vec![]);
    }

    let mut projects = Vec::new();

    for entry in std::fs::read_dir(&projects_dir)? {
        let entry = entry?;
        let id = entry.file_name().to_string_lossy().to_string();
        let path = format!("/{}", id.replace('-', "/").trim_start_matches('/'));

        let memory_dir = entry.path().join("memory");
        let mut memory_files = Vec::new();

        if memory_dir.exists() {
            for mfile in std::fs::read_dir(&memory_dir)? {
                let mfile = mfile?;
                let name = mfile.file_name().to_string_lossy().to_string();
                let content = std::fs::read_to_string(mfile.path()).unwrap_or_default();
                memory_files.push(MemoryFile { name, content });
            }
        }

        projects.push(Project { id, path, memory_files });
    }

    projects.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(projects)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn make_project(base: &Path, id: &str, memory_files: &[(&str, &str)]) {
        let proj_dir = base.join("projects").join(id);
        fs::create_dir_all(&proj_dir).unwrap();
        if !memory_files.is_empty() {
            let mem_dir = proj_dir.join("memory");
            fs::create_dir_all(&mem_dir).unwrap();
            for (name, content) in memory_files {
                fs::write(mem_dir.join(name), content).unwrap();
            }
        }
    }

    #[test]
    fn returns_empty_when_no_projects_dir() {
        let dir = TempDir::new().unwrap();
        let projects = load_from(dir.path()).unwrap();
        assert!(projects.is_empty());
    }

    #[test]
    fn loads_project_with_no_memory() {
        let dir = TempDir::new().unwrap();
        make_project(dir.path(), "-Users-alice-myrepo", &[]);
        let projects = load_from(dir.path()).unwrap();
        assert_eq!(projects.len(), 1);
        assert!(projects[0].memory_files.is_empty());
    }

    #[test]
    fn loads_memory_files() {
        let dir = TempDir::new().unwrap();
        make_project(
            dir.path(),
            "-Users-alice-myrepo",
            &[
                ("user_role.md", "---\nname: User role\ntype: user\n---\nSenior engineer"),
                ("feedback.md", "---\nname: Feedback\ntype: feedback\n---\nPrefer terse"),
            ],
        );
        let projects = load_from(dir.path()).unwrap();
        assert_eq!(projects[0].memory_files.len(), 2);
    }

    #[test]
    fn projects_sorted_by_path() {
        let dir = TempDir::new().unwrap();
        make_project(dir.path(), "-Users-zoe-repo", &[]);
        make_project(dir.path(), "-Users-alice-repo", &[]);
        make_project(dir.path(), "-Users-bob-repo", &[]);
        let projects = load_from(dir.path()).unwrap();
        let paths: Vec<&str> = projects.iter().map(|p| p.path.as_str()).collect();
        let mut sorted = paths.clone();
        sorted.sort();
        assert_eq!(paths, sorted);
    }

    #[test]
    fn memory_file_content_is_preserved() {
        let dir = TempDir::new().unwrap();
        let content = "---\nname: Test\ntype: feedback\n---\nDo not mock databases.";
        make_project(dir.path(), "-Users-alice-repo", &[("feedback.md", content)]);
        let projects = load_from(dir.path()).unwrap();
        assert_eq!(projects[0].memory_files[0].content, content);
    }
}
