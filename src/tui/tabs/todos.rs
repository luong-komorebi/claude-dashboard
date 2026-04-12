use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    Frame,
};
use claude_dashboard::data::todos::TodosData;
use super::{scrolled_paragraph, section_block, stat_card};

pub fn render(f: &mut Frame, area: Rect, data: &TodosData, scroll: usize) {
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

    stat_card(f, card_chunks[0], "TODO SESSIONS", &data.sessions.len().to_string(), "tracked", true);
    stat_card(f, card_chunks[1], "IN PROGRESS", &data.in_progress_count.to_string(), "tasks active", false);
    stat_card(f, card_chunks[2], "PENDING", &data.pending_count.to_string(), "tasks queued", false);
    stat_card(f, card_chunks[3], "PLANS", &data.plans.len().to_string(), "active plans", false);

    let mut lines: Vec<Line> = vec![];

    // Show in-progress and pending todos first
    for session in &data.sessions {
        let active: Vec<_> = session.items.iter()
            .filter(|i| i.status == "in_progress" || i.status == "pending")
            .collect();
        if active.is_empty() { continue; }

        lines.push(Line::from(Span::styled(
            format!("Session: {}", &session.id.chars().take(36).collect::<String>()),
            Style::default().fg(Color::DarkGray),
        )));

        for item in active {
            let (icon, color) = match item.status.as_str() {
                "in_progress" => ("▶ ", Color::Yellow),
                "pending" => ("○ ", Color::White),
                _ => ("✓ ", Color::DarkGray),
            };
            lines.push(Line::from(vec![
                Span::styled(format!("  {}", icon), Style::default().fg(color)),
                Span::styled(item.content.clone(), Style::default().fg(color)),
            ]));
        }
        lines.push(Line::from(""));
    }

    // Plans
    if !data.plans.is_empty() {
        lines.push(Line::from(Span::styled("Plans", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))));
        lines.push(Line::from(""));
        for plan in &data.plans {
            lines.push(Line::from(vec![
                Span::styled("  📋 ", Style::default().fg(Color::Cyan)),
                Span::styled(plan.name.clone(), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
            ]));
            // Show first non-empty line of plan content
            if let Some(first_line) = plan.content.lines().find(|l| !l.trim().is_empty()) {
                lines.push(Line::from(Span::styled(
                    format!("     {}", first_line.trim().chars().take(70).collect::<String>()),
                    Style::default().fg(Color::DarkGray),
                )));
            }
        }
    }

    scrolled_paragraph(f, chunks[1], section_block("Todos & Plans"), lines, scroll);
}
