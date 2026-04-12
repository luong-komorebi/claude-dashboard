use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    Frame,
};
use claude_dashboard::data::projects::Project;
use super::{scrolled_paragraph, section_block, stat_card};

pub fn render(f: &mut Frame, area: Rect, projects: &[Project], scroll: usize) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(5), Constraint::Min(0)])
        .split(area);

    let card_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Ratio(1, 2), Constraint::Ratio(1, 2)])
        .split(chunks[0]);

    let total_memory: usize = projects.iter().map(|p| p.memory_files.len()).sum();
    stat_card(f, card_chunks[0], "PROJECTS", &projects.len().to_string(), "with Claude memory", true);
    stat_card(f, card_chunks[1], "MEMORY FILES", &total_memory.to_string(), "across all projects", false);

    let mut lines: Vec<Line> = vec![];
    for project in projects {
        lines.push(Line::from(vec![
            Span::styled("▸ ", Style::default().fg(Color::Yellow)),
            Span::styled(project.path.clone(), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
        ]));

        if project.memory_files.is_empty() {
            lines.push(Line::from(Span::styled("  (no memory files)", Style::default().fg(Color::DarkGray))));
        } else {
            for mf in &project.memory_files {
                // Show frontmatter name if present, else filename
                let display_name = extract_memory_name(&mf.content).unwrap_or_else(|| mf.name.clone());
                let preview = first_content_line(&mf.content);
                lines.push(Line::from(vec![
                    Span::styled(format!("  {:30}", display_name), Style::default().fg(Color::Cyan)),
                    Span::styled(preview, Style::default().fg(Color::DarkGray)),
                ]));
            }
        }
        lines.push(Line::from(""));
    }

    scrolled_paragraph(f, chunks[1], section_block("Projects & Memory"), lines, scroll);
}

fn extract_memory_name(content: &str) -> Option<String> {
    let mut in_frontmatter = false;
    for line in content.lines() {
        if line == "---" {
            if !in_frontmatter { in_frontmatter = true; continue; }
            else { break; }
        }
        if in_frontmatter {
            if let Some(rest) = line.strip_prefix("name:") {
                return Some(rest.trim().to_string());
            }
        }
    }
    None
}

fn first_content_line(content: &str) -> String {
    let mut past_frontmatter = false;
    let mut dashes = 0;
    for line in content.lines() {
        if line == "---" {
            dashes += 1;
            if dashes == 2 { past_frontmatter = true; }
            continue;
        }
        if past_frontmatter || dashes == 0 {
            let trimmed = line.trim();
            if !trimmed.is_empty() && !trimmed.starts_with('#') {
                return trimmed.chars().take(60).collect();
            }
        }
    }
    String::new()
}
