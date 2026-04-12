use claude_dashboard::data;
mod api;
mod tui;

use clap::{Parser, Subcommand};
use anyhow::Result;

#[derive(Parser)]
#[command(name = "claude-dashboard", about = "Claude Code local dashboard")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Run TUI only
    Tui,
    /// Run HTTP API server only (for web app)
    Serve {
        #[arg(short, long, default_value = "7878")]
        port: u16,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        None => {
            // Run both TUI and HTTP API concurrently
            let api_handle = tokio::spawn(api::serve(7878));
            let tui_result = tui::run().await;
            api_handle.abort();
            tui_result
        }
        Some(Command::Tui) => tui::run().await,
        Some(Command::Serve { port }) => api::serve(port).await,
    }
}
