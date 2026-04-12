use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    Frame,
};
use claude_dashboard::data::sessions::Session;
use super::{scrolled_paragraph, section_block, stat_card};

pub fn render(f: &mut Frame, area: Rect, sessions: &[Session], scroll: usize) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(5), Constraint::Min(0)])
        .split(area);

    let achieved = sessions.iter().filter(|s| {
        s.outcome.as_deref().map(|o| o.contains("achieved")).unwrap_or(false)
    }).count();

    let card_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Ratio(1, 3), Constraint::Ratio(1, 3), Constraint::Ratio(1, 3)])
        .split(chunks[0]);

    stat_card(f, card_chunks[0], "SESSIONS", &sessions.len().to_string(), "with summaries", true);
    stat_card(f, card_chunks[1], "GOALS ACHIEVED", &achieved.to_string(), &format!("{:.0}%", if sessions.is_empty() { 0.0 } else { achieved as f64 / sessions.len() as f64 * 100.0 }), false);
    stat_card(f, card_chunks[2], "SESSION TYPES", &count_unique_types(sessions).to_string(), "distinct types", false);

    let mut lines: Vec<Line> = vec![
        Line::from(vec![
            Span::styled(format!("{:<40}", "SUMMARY"), Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
            Span::styled(format!("{:<20}", "TYPE"), Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
            Span::styled("OUTCOME", Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(Span::styled("─".repeat(80), Style::default().fg(Color::DarkGray))),
    ];

    for s in sessions {
        let outcome_color = match s.outcome.as_deref() {
            Some(o) if o.contains("achieved") => Color::Green,
            Some(o) if o.contains("partial") => Color::Yellow,
            _ => Color::DarkGray,
        };

        let summary = s.brief_summary.as_deref()
            .unwrap_or(s.underlying_goal.as_deref().unwrap_or("—"));
        let summary: String = summary.chars().take(38).collect();
        let session_type: String = s.session_type.as_deref().unwrap_or("—").chars().take(18).collect();
        let outcome = s.outcome.as_deref().unwrap_or("unknown");

        lines.push(Line::from(vec![
            Span::styled(format!("{:<40}", summary), Style::default().fg(Color::White)),
            Span::styled(format!("{:<20}", session_type), Style::default().fg(Color::Cyan)),
            Span::styled(outcome.to_string(), Style::default().fg(outcome_color)),
        ]));
    }

    scrolled_paragraph(f, chunks[1], section_block("Session History"), lines, scroll);
}

fn count_unique_types(sessions: &[Session]) -> usize {
    let mut types = std::collections::HashSet::new();
    for s in sessions {
        if let Some(t) = &s.session_type {
            types.insert(t.as_str());
        }
    }
    types.len()
}
