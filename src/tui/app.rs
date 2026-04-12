use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Tabs},
    Frame,
};

use claude_dashboard::data::DashboardData;
use super::tabs;

const TABS: &[&str] = &[
    "Stats", "Usage", "Projects", "Plugins", "Todos", "Sessions", "Settings",
];

pub struct App {
    pub data: DashboardData,
    pub selected_tab: usize,
    pub scroll: usize,
}

impl App {
    pub fn new(data: DashboardData) -> Self {
        Self { data, selected_tab: 0, scroll: 0 }
    }

    pub fn update_data(&mut self, data: DashboardData) {
        self.data = data;
        self.scroll = 0;
    }

    pub fn next_tab(&mut self) {
        self.selected_tab = (self.selected_tab + 1) % TABS.len();
        self.scroll = 0;
    }

    pub fn prev_tab(&mut self) {
        self.selected_tab = self.selected_tab.checked_sub(1).unwrap_or(TABS.len() - 1);
        self.scroll = 0;
    }

    pub fn scroll_down(&mut self) { self.scroll = self.scroll.saturating_add(1); }
    pub fn scroll_up(&mut self) { self.scroll = self.scroll.saturating_sub(1); }

    pub fn render(&self, f: &mut Frame) {
        let area = f.area();
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(3),  // tabs
                Constraint::Min(0),     // content
                Constraint::Length(1),  // status bar
            ])
            .split(area);

        self.render_tabs(f, chunks[0]);
        self.render_content(f, chunks[1]);
        self.render_status_bar(f, chunks[2]);
    }

    fn render_tabs(&self, f: &mut Frame, area: Rect) {
        let tab_titles: Vec<Line> = TABS
            .iter()
            .enumerate()
            .map(|(i, t)| {
                if i == self.selected_tab {
                    Line::from(Span::styled(*t, Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)))
                } else {
                    Line::from(Span::styled(*t, Style::default().fg(Color::DarkGray)))
                }
            })
            .collect();

        let tabs = Tabs::new(tab_titles)
            .block(Block::default().borders(Borders::ALL).title(" Claude Dashboard "))
            .select(self.selected_tab)
            .highlight_style(Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD));

        f.render_widget(tabs, area);
    }

    fn render_content(&self, f: &mut Frame, area: Rect) {
        match self.selected_tab {
            0 => tabs::stats::render(f, area, &self.data.stats, self.scroll),
            1 => tabs::usage::render(f, area, &self.data.usage, self.scroll),
            2 => tabs::projects::render(f, area, &self.data.projects, self.scroll),
            3 => tabs::plugins::render(f, area, &self.data.plugins, self.scroll),
            4 => tabs::todos::render(f, area, &self.data.todos, self.scroll),
            5 => tabs::sessions::render(f, area, &self.data.sessions, self.scroll),
            6 => tabs::settings::render(f, area, &self.data.settings, self.scroll),
            _ => {}
        }
    }

    fn render_status_bar(&self, f: &mut Frame, area: Rect) {
        let text = Line::from(vec![
            Span::styled(" Tab/←→", Style::default().fg(Color::DarkGray)),
            Span::styled(" navigate  ", Style::default().fg(Color::DarkGray)),
            Span::styled("↑↓/jk", Style::default().fg(Color::DarkGray)),
            Span::styled(" scroll  ", Style::default().fg(Color::DarkGray)),
            Span::styled("r", Style::default().fg(Color::Yellow)),
            Span::styled(" refresh  ", Style::default().fg(Color::DarkGray)),
            Span::styled("q", Style::default().fg(Color::Yellow)),
            Span::styled(" quit", Style::default().fg(Color::DarkGray)),
        ]);
        f.render_widget(ratatui::widgets::Paragraph::new(text), area);
    }
}
