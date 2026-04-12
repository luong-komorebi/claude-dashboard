use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    Frame,
};
use claude_dashboard::data::settings::SettingsData;
use super::{scrolled_paragraph, section_block, stat_card};

pub fn render(f: &mut Frame, area: Rect, data: &SettingsData, scroll: usize) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(5), Constraint::Min(0)])
        .split(area);

    let card_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Ratio(1, 4),
            Constraint::Ratio(1, 4),
            Constraint::Ratio(1, 4),
            Constraint::Ratio(1, 4),
        ])
        .split(chunks[0]);

    stat_card(f, card_chunks[0], "ALLOWED TOOLS", &data.allowed_tools.len().to_string(), "permissions", true);
    stat_card(f, card_chunks[1], "EFFORT LEVEL", data.effort_level.as_deref().unwrap_or("default"), "", false);
    stat_card(f, card_chunks[2], "ALWAYS THINKING", if data.always_thinking.unwrap_or(false) { "on" } else { "off" }, "", false);
    stat_card(f, card_chunks[3], "HISTORY ENTRIES", &data.recent_history.len().to_string(), "recent commands", false);

    let mut lines: Vec<Line> = vec![];

    lines.push(Line::from(Span::styled("Allowed Tools / Permissions", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))));
    lines.push(Line::from(""));
    for tool in &data.allowed_tools {
        lines.push(Line::from(vec![
            Span::styled("  ✓ ", Style::default().fg(Color::Green)),
            Span::styled(tool.clone(), Style::default().fg(Color::White)),
        ]));
    }
    lines.push(Line::from(""));

    lines.push(Line::from(Span::styled("Recent History", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))));
    lines.push(Line::from(""));
    for entry in &data.recent_history {
        let display: String = entry.display.trim().chars().take(70).collect();
        let project = entry.project.as_deref()
            .and_then(|p| p.split('/').last())
            .unwrap_or("");
        lines.push(Line::from(vec![
            Span::styled(format!("  {:50}", display), Style::default().fg(Color::White)),
            Span::styled(project.to_string(), Style::default().fg(Color::DarkGray)),
        ]));
    }

    scrolled_paragraph(f, chunks[1], section_block("Settings & History"), lines, scroll);
}
