//! Claude Dashboard — standalone offline server.
//!
//! A tiny HTTP server that embeds the built web app (`web/dist/`) at compile
//! time via `rust-embed`, serves it on `http://localhost:<PORT>`, and opens
//! the user's default browser. The user gets a single-file executable with
//! no runtime dependencies that runs 100% offline.
//!
//! Why a real HTTP origin instead of `file://`?
//!   - File System Access API (used to read `~/.claude`) requires a secure
//!     context. `http://localhost` qualifies as secure in all major browsers;
//!     `file://` has spotty support across OS and browser combinations.
//!   - Service Workers (our PWA offline cache) don't work on `file://`.
//!   - IndexedDB origin separation is weird on `file://` (per-file origins).
//!
//! Usage:
//!   claude-dashboard                 # serve on 7878
//!   PORT=9000 claude-dashboard       # custom port
//!   NO_OPEN=1 claude-dashboard       # don't auto-open browser

use rust_embed::RustEmbed;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::process::ExitCode;
use tiny_http::{Header, Response, Server};

/// Embeds the entire `web/dist/` directory into the binary at compile time.
/// The path is resolved relative to this crate's `Cargo.toml`.
#[derive(RustEmbed)]
#[folder = "../web/dist/"]
struct Assets;

const DEFAULT_PORT: u16 = 7878;

fn main() -> ExitCode {
    // ── Config from environment ───────────────────────────────────────────
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(DEFAULT_PORT);

    let no_open = std::env::var("NO_OPEN").is_ok();

    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port);

    // ── Start listening ───────────────────────────────────────────────────
    let server = match Server::http(addr) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to bind to {addr}: {e}");
            eprintln!("Try a different port: PORT=9000 {}", env!("CARGO_PKG_NAME"));
            return ExitCode::from(1);
        }
    };

    let url = format!("http://{addr}");

    eprintln!();
    eprintln!("  Claude Dashboard v{}", env!("CARGO_PKG_VERSION"));
    eprintln!("  ───────────────────────────────────────");
    eprintln!("  Serving at  {url}");
    eprintln!("  Assets      {} embedded files", Assets::iter().count());
    eprintln!("  Stop        Ctrl+C");
    eprintln!();

    // ── Open browser (best-effort) ────────────────────────────────────────
    if !no_open {
        if let Err(e) = open::that(&url) {
            eprintln!("  (Couldn't open browser automatically: {e})");
            eprintln!("  Open {url} manually.");
        }
    }

    // ── Request loop ──────────────────────────────────────────────────────
    // tiny_http gives us one request at a time on the current thread. We drop
    // any request body implicitly (we're a static asset server, GET-only).
    for req in server.incoming_requests() {
        let path = normalize_path(req.url());
        let response = serve(&path);
        if let Err(e) = req.respond(response) {
            eprintln!("  warn: failed to send response: {e}");
        }
    }

    ExitCode::SUCCESS
}

/// Strip leading slash, reject path-traversal attempts, and map `/` to index.
fn normalize_path(url: &str) -> String {
    // Drop query string
    let without_query = url.split('?').next().unwrap_or(url);
    let trimmed = without_query.trim_start_matches('/');

    // Block path-traversal
    if trimmed.split('/').any(|s| s == "..") {
        return String::new();
    }

    if trimmed.is_empty() {
        "index.html".to_string()
    } else {
        trimmed.to_string()
    }
}

fn serve(path: &str) -> Response<std::io::Cursor<Vec<u8>>> {
    if path.is_empty() {
        return Response::from_string("Forbidden").with_status_code(403);
    }

    // Try the exact path first
    if let Some(file) = Assets::get(path) {
        return build_response(path, file.data.into_owned())
    }

    // SPA fallback: anything that doesn't match an asset gets index.html.
    // Keeps hash-refresh + client-side routing working.
    if let Some(index) = Assets::get("index.html") {
        return build_response("index.html", index.data.into_owned())
    }

    // Last resort: empty 404. In practice we never hit this because index.html
    // is always embedded — but if someone stripped the dist folder, fail loud.
    Response::from_string("Not Found").with_status_code(404)
}

fn build_response(path: &str, data: Vec<u8>) -> Response<std::io::Cursor<Vec<u8>>> {
    let mime = mime_guess::from_path(path).first_or_octet_stream();
    let mime_str = mime.as_ref();

    let content_type_header = Header::from_bytes(
        &b"Content-Type"[..],
        mime_str.as_bytes(),
    )
    .expect("invalid content-type header");

    // WASM specifically needs application/wasm so browsers use streaming compile
    let mut response = Response::from_data(data).with_header(content_type_header);

    // Cache headers — local-first, but tell the browser it can cache heavily
    // hashed assets. Vite puts content hashes in filenames so this is safe.
    if path.contains("/assets/") || path.ends_with(".wasm") {
        if let Ok(h) = Header::from_bytes(
            &b"Cache-Control"[..],
            &b"public, max-age=31536000, immutable"[..],
        ) {
            response = response.with_header(h);
        }
    }

    response
}

