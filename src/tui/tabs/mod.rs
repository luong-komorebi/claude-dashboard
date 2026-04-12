pub mod stats;
pub mod usage;
pub mod projects;
pub mod plugins;
pub mod todos;
pub mod sessions;
pub mod settings;

use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Wrap},
    Frame,
};

pub fn stat_card(f: &mut Frame, area: Rect, label: &str, value: &str, sub: &str, highlight: bool) {
    let border_style = if highlight {
        Style::default().fg(Color::Yellow)
    } else {
        Style::default().fg(Color::DarkGray)
    };

    let block = Block::default().borders(Borders::ALL).border_style(border_style);
    let inner = block.inner(area);
    f.render_widget(block, area);

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(1), Constraint::Length(1), Constraint::Length(1)])
        .split(inner);

    f.render_widget(
        Paragraph::new(label).style(Style::default().fg(Color::DarkGray)),
        chunks[0],
    );
    f.render_widget(
        Paragraph::new(value)
            .style(Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
        chunks[1],
    );
    f.render_widget(
        Paragraph::new(sub).style(Style::default().fg(Color::DarkGray)),
        chunks[2],
    );
}

pub fn section_block(title: &str) -> Block<'_> {
    Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::DarkGray))
        .title(Span::styled(
            format!(" {} ", title),
            Style::default().fg(Color::Yellow),
        ))
}

pub fn scrolled_paragraph<'a>(
    f: &mut Frame,
    area: Rect,
    block: Block<'a>,
    lines: Vec<Line<'a>>,
    scroll: usize,
) {
    let inner_height = block.inner(area).height as usize;
    let max_scroll = lines.len().saturating_sub(inner_height);
    let scroll = scroll.min(max_scroll) as u16;
    let p = Paragraph::new(lines)
        .block(block)
        .wrap(Wrap { trim: false })
        .scroll((scroll, 0));
    f.render_widget(p, area);
}
