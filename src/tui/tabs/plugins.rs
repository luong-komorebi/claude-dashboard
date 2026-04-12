use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    Frame,
};
use claude_dashboard::data::plugins::Plugin;
use super::{scrolled_paragraph, section_block, stat_card};

pub fn render(f: &mut Frame, area: Rect, plugins: &[Plugin], scroll: usize) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(5), Constraint::Min(0)])
        .split(area);

    let enabled_count = plugins.iter().filter(|p| p.enabled).count();
    let disabled_count = plugins.len() - enabled_count;

    let card_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Ratio(1, 3), Constraint::Ratio(1, 3), Constraint::Ratio(1, 3)])
        .split(chunks[0]);

    stat_card(f, card_chunks[0], "TOTAL PLUGINS", &plugins.len().to_string(), "installed", true);
    stat_card(f, card_chunks[1], "ENABLED", &enabled_count.to_string(), "active", false);
    stat_card(f, card_chunks[2], "DISABLED", &disabled_count.to_string(), "inactive", false);

    let mut lines: Vec<Line> = vec![];

    let (enabled, disabled): (Vec<_>, Vec<_>) = plugins.iter().partition(|p| p.enabled);

    if !enabled.is_empty() {
        lines.push(Line::from(Span::styled("Enabled", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD))));
        lines.push(Line::from(""));
        for p in &enabled {
            let (name, registry) = split_plugin_id(&p.id);
            lines.push(Line::from(vec![
                Span::styled("  ✓ ", Style::default().fg(Color::Green)),
                Span::styled(name, Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
                Span::styled(format!("  @{}", registry), Style::default().fg(Color::DarkGray)),
            ]));
        }
        lines.push(Line::from(""));
    }

    if !disabled.is_empty() {
        lines.push(Line::from(Span::styled("Disabled", Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD))));
        lines.push(Line::from(""));
        for p in &disabled {
            let (name, registry) = split_plugin_id(&p.id);
            lines.push(Line::from(vec![
                Span::styled("  ✗ ", Style::default().fg(Color::DarkGray)),
                Span::styled(name, Style::default().fg(Color::DarkGray)),
                Span::styled(format!("  @{}", registry), Style::default().fg(Color::DarkGray)),
            ]));
        }
    }

    scrolled_paragraph(f, chunks[1], section_block("Plugins"), lines, scroll);
}

fn split_plugin_id(id: &str) -> (String, String) {
    if let Some(pos) = id.rfind('@') {
        (id[..pos].to_string(), id[pos + 1..].to_string())
    } else {
        (id.to_string(), String::new())
    }
}
