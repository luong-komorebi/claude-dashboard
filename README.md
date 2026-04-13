# Claude Dashboard

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H71LA8V)

A fully client-side dashboard for `~/.claude`. React + Rust/WASM + PWA. Runs in the browser, reads your local Claude Code data directly via the File System Access API, and never sends a byte over the network.

- **Overview** — hero metrics, cost trends, model breakdown, recent sessions
- **Insights** — Holt-Winters forecasting, anomaly detection, GitHub-style activity heatmap, what-if cost simulator
- **Reports** — Daily / Weekly / Monthly / Sessions / 5-hour Blocks tables
- **Projects** — tree view with memory-file search
- **Usage · Sessions · Plugins · Todos · Settings** — with client-side search

All data processing runs locally:
- **Web Worker** parses every `~/.claude/projects/*.jsonl` off the main thread
- **Rust/WASM** powers forecasting, aggregation, and cost calculation
- **OPFS** caches parsed state with gzip compression for instant reopen
- **CSP `connect-src 'self'`** physically blocks any outbound network call

## Running it offline

There are two ways to get the dashboard onto a machine that has no internet:

### Option 1 — Install as a PWA from the hosted URL

1. Visit the hosted dashboard (`https://<user>.github.io/claude-dashboard/`) once while online
2. Click **Install** in the in-app hint (or the browser's address-bar install icon)
3. After that, the dashboard works offline forever — the service worker precaches every asset
4. Optional: enable **persistent storage** via the shield icon in the sidebar to prevent the browser from evicting the cache under disk pressure

### Option 2 — Download the standalone binary

Grab the single-file executable for your platform from the [Releases page](../../releases):

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `claude-dashboard-macos-arm64` |
| macOS (Intel) | `claude-dashboard-macos-x64` |
| Linux (x64) | `claude-dashboard-linux-x64` |
| Windows (x64) | `claude-dashboard-windows-x64.exe` |

Then:

```bash
chmod +x claude-dashboard-macos-arm64     # macOS/Linux only
./claude-dashboard-macos-arm64
```

The binary:
- Embeds the entire built web app (HTML, JS, CSS, WASM) at compile time
- Serves on `http://localhost:7878` (change with `PORT=9000`)
- Opens your default browser automatically (skip with `NO_OPEN=1`)
- Is ~1.5 MB, has zero runtime dependencies, runs 100% offline

Why `http://localhost` instead of `file://`? The File System Access API requires a secure context — `localhost` qualifies everywhere, `file://` has spotty support.

## Development

```bash
just install      # installs pnpm deps + rust wasm32 target + wasm-pack
just wasm         # build the Rust analytics module
just dev          # Vite dev server at http://localhost:5173
just test         # rust + web tests
just check        # full CI-equivalent: typecheck + tests + build
just server-build # build the standalone binary (embeds dist/)
just server-run   # build + run the standalone binary
```

### Project layout

```
wasm/      Rust analytics crate (trends, forecasting, reports, insights, what-if)
server/    Rust static-server binary (embeds web/dist via rust-embed)
web/       Vite + React + TypeScript app
scripts/   Python helpers (pricing table filter)
```

### Updating model pricing

The Reports and Insights tabs show API-equivalent costs using [LiteLLM's canonical pricing data](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json). A scheduled GitHub Action refreshes it weekly and opens a PR. To refresh manually:

```bash
just pricing-update
```

## Privacy

Nothing this app does involves a network request beyond fetching its own bundled assets. To prove it:

- Open DevTools → Network → filter "Fetch/XHR" — you'll see `0 external requests`
- Check page source — there's a `Content-Security-Policy` meta tag with `connect-src 'self'` that makes the browser physically refuse any outbound connection
- The in-sidebar **privacy badge** shows a live count of external requests (always 0)
- The [source code](./web/src) is ~3k lines you can audit yourself

## Support

If this saves you time or teaches you something, a small tip keeps the project going:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H71LA8V)

The in-app "Support me" button is a plain `<a>` link — no third-party scripts load, no tracking pixels, and the CSP still shows zero external requests. Clicking opens Ko-fi in a new tab with `rel="noreferrer"` so they don't even see what site referred you.
