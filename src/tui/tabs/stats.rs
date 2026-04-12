use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::BarChart,
    Frame,
};
use claude_dashboard::data::stats::StatsData;
use super::{scrolled_paragraph, section_block, stat_card};

pub fn render(f: &mut Frame, area: Rect, data: &StatsData, scroll: usize) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(5),  // summary cards
            Constraint::Length(10), // bar chart
            Constraint::Min(0),     // daily table
        ])
        .split(area);

    // Summary cards
    let card_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Ratio(1, 4),
            Constraint::Ratio(1, 4),
            Constraint::Ratio(1, 4),
            Constraint::Ratio(1, 4),
        ])
        .split(chunks[0]);

    let avg_per_day = if data.active_days > 0 {
        data.total_messages / data.active_days as u64
    } else {
        0
    };

    stat_card(f, card_chunks[0], "MESSAGES", &fmt_num(data.total_messages), &format!("{} active days", data.active_days), true);
    stat_card(f, card_chunks[1], "SESSIONS", &fmt_num(data.total_sessions), &data.date_range.as_ref().map(|(a, b)| format!("{} – {}", a, b)).unwrap_or_default(), false);
    stat_card(f, card_chunks[2], "TOOL CALLS", &fmt_num(data.total_tool_calls), &format!("avg {}/session", if data.total_sessions > 0 { data.total_tool_calls / data.total_sessions } else { 0 }), false);
    stat_card(f, card_chunks[3], "AVG MSG/DAY", &fmt_num(avg_per_day), "across active days", false);

    // Bar chart — last 20 days of messages
    let recent: Vec<(&str, u64)> = data.daily_activity
        .iter()
        .rev()
        .take(20)
        .rev()
        .map(|d| (d.date.as_str(), d.message_count))
        .collect();

    let bar_data: Vec<(&str, u64)> = recent.iter().map(|(d, v)| {
        let short = if d.len() >= 5 { &d[5..] } else { d };
        (short, *v)
    }).collect();

    let bar_chart = BarChart::default()
        .block(section_block("Daily Messages (recent)"))
        .data(&bar_data)
        .bar_width(3)
        .bar_gap(1)
        .bar_style(Style::default().fg(Color::Yellow))
        .value_style(Style::default().fg(Color::Black).bg(Color::Yellow));

    f.render_widget(bar_chart, chunks[1]);

    // Daily activity table
    let mut lines: Vec<Line> = vec![
        Line::from(vec![
            Span::styled(format!("{:<12}", "DATE"), Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
            Span::styled(format!("{:>10}", "MESSAGES"), Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
            Span::styled(format!("{:>10}", "SESSIONS"), Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
            Span::styled(format!("{:>12}", "TOOL CALLS"), Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
        ]),
        Line::from("─".repeat(44)),
    ];

    for day in data.daily_activity.iter().rev() {
        lines.push(Line::from(vec![
            Span::styled(format!("{:<12}", day.date), Style::default().fg(Color::White)),
            Span::styled(format!("{:>10}", fmt_num(day.message_count)), Style::default().fg(Color::Yellow)),
            Span::styled(format!("{:>10}", day.session_count), Style::default().fg(Color::White)),
            Span::styled(format!("{:>12}", fmt_num(day.tool_call_count)), Style::default().fg(Color::White)),
        ]));
    }

    scrolled_paragraph(f, chunks[2], section_block("Daily Activity"), lines, scroll);
}

fn fmt_num(n: u64) -> String {
    if n >= 1_000_000 {
        format!("{:.1}M", n as f64 / 1_000_000.0)
    } else if n >= 1_000 {
        format!("{:.1}K", n as f64 / 1_000.0)
    } else {
        n.to_string()
    }
}
