use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    Frame,
};
use claude_dashboard::data::usage::UsageData;
use super::{scrolled_paragraph, section_block, stat_card};

pub fn render(f: &mut Frame, area: Rect, data: &UsageData, scroll: usize) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(5),
            Constraint::Length(8),
            Constraint::Min(0),
        ])
        .split(area);

    // Summary cards
    let card_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Ratio(1, 3), Constraint::Ratio(1, 3), Constraint::Ratio(1, 3)])
        .split(chunks[0]);

    let achieved = data.outcome_counts.get("mostly_achieved").copied().unwrap_or(0)
        + data.outcome_counts.get("fully_achieved").copied().unwrap_or(0);
    let very_helpful = data.helpfulness_counts.get("very_helpful").copied().unwrap_or(0);

    stat_card(f, card_chunks[0], "SESSIONS TRACKED", &data.total_sessions.to_string(), "with outcome data", true);
    stat_card(f, card_chunks[1], "GOALS ACHIEVED", &achieved.to_string(), "fully or mostly", false);
    stat_card(f, card_chunks[2], "VERY HELPFUL", &very_helpful.to_string(), &format!("{:.0}% of sessions", if data.total_sessions > 0 { very_helpful as f64 / data.total_sessions as f64 * 100.0 } else { 0.0 }), false);

    // Outcome breakdown
    let mut outcome_lines: Vec<Line> = vec![
        Line::from(Span::styled("Outcome Distribution", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))),
        Line::from(""),
    ];
    let mut outcomes: Vec<_> = data.outcome_counts.iter().collect();
    outcomes.sort_by(|a, b| b.1.cmp(a.1));
    for (outcome, count) in &outcomes {
        let bar_len = (*count * 30 / data.total_sessions.max(1)).min(30);
        outcome_lines.push(Line::from(vec![
            Span::styled(format!("{:<25}", outcome), Style::default().fg(Color::White)),
            Span::styled("█".repeat(bar_len), Style::default().fg(Color::Yellow)),
            Span::styled(format!(" {}", count), Style::default().fg(Color::DarkGray)),
        ]));
    }
    scrolled_paragraph(f, chunks[1], section_block("Outcomes"), outcome_lines, 0);

    // Helpfulness breakdown + session list
    let mut lines: Vec<Line> = vec![
        Line::from(Span::styled("Helpfulness Distribution", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))),
        Line::from(""),
    ];
    let mut helpfulness: Vec<_> = data.helpfulness_counts.iter().collect();
    helpfulness.sort_by(|a, b| b.1.cmp(a.1));
    for (h, count) in &helpfulness {
        let bar_len = (*count * 30 / data.total_sessions.max(1)).min(30);
        lines.push(Line::from(vec![
            Span::styled(format!("{:<25}", h), Style::default().fg(Color::White)),
            Span::styled("█".repeat(bar_len), Style::default().fg(Color::Green)),
            Span::styled(format!(" {}", count), Style::default().fg(Color::DarkGray)),
        ]));
    }

    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled("Recent Sessions", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))));
    lines.push(Line::from(""));

    for facet in data.facets.iter().take(50) {
        let outcome_color = match facet.outcome.as_deref() {
            Some(o) if o.contains("achieved") => Color::Green,
            Some(o) if o.contains("partial") => Color::Yellow,
            _ => Color::DarkGray,
        };
        lines.push(Line::from(vec![
            Span::styled(
                format!("{:<40}", facet.brief_summary.as_deref().unwrap_or("—").chars().take(38).collect::<String>()),
                Style::default().fg(Color::White),
            ),
            Span::styled(
                format!("  {}", facet.outcome.as_deref().unwrap_or("unknown")),
                Style::default().fg(outcome_color),
            ),
        ]));
    }

    scrolled_paragraph(f, chunks[2], section_block("Helpfulness & Sessions"), lines, scroll);
}
