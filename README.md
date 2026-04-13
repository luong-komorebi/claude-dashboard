# Claude Dashboard

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H71LA8V)

A fully client-side dashboard for `~/.claude`. Reads your Claude Code data directly in the browser, never sends a byte over the network. Forecasts, cost tracking, heatmap, and a what-if simulator — all powered by Rust/WASM.

![Overview screenshot](./web/public/screenshots/overview.png)

## Quickstart

**Open [luong-komorebi.github.io/claude-dashboard](https://luong-komorebi.github.io/claude-dashboard/) → click "Open ~/.claude folder" → pick your home or `.claude` folder. Done.**

The app walks you through the 3-click picker flow on first visit (including a copy-path helper for macOS `⇧⌘G` / Windows address-bar paste).

## Features

- **Overview** — cost, streak, active 5h block, top insights, 14-day forecast preview, mini heatmap, model + project breakdown, recent sessions, hour-of-day pattern, budget tracker
- **Analytics** — full Reports tables · Holt-Winters forecast · year-calendar heatmap · what-if cost simulator
- **Projects** — path-tree with memory-file search (lossless — uses real `cwd` from session logs)
- **Activity · Config** — searchable sessions, usage facets, todos, plans, plugins, settings, command history
- **14 themes** — Tokyo Night (default), GitHub Dark/Light, Catppuccin, Dracula, Nord, Gruvbox, Rosé Pine, One Dark, Solarized, Monokai, …

## Offline use

Three ways to run without internet:

1. **PWA install** — visit the hosted URL once online, click the in-app Install button; service worker precaches everything. Works forever after that.
2. **Standalone binary** — grab `claude-dashboard-<platform>` from the [Releases page](../../releases) and run it. Embeds the full web app in a ~1.5 MB single file. No runtime dependencies. Serves on `http://localhost:7878` and auto-opens your browser.
3. **Build from source** — see [DEVELOPMENT.md](./DEVELOPMENT.md).

## Privacy

- `Content-Security-Policy: connect-src 'self'` physically blocks outbound connections — verifiable in DevTools → Network (shows 0 external requests)
- No telemetry, no analytics, no third-party scripts
- All parsing + analytics runs locally in a Web Worker + Rust/WASM
- Persistent storage API enabled on request so the browser never evicts your folder handle

## Support

If this saves you time, a tip keeps the project going:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H71LA8V)

The in-app "Support me" button is a plain `<a>` link — no Ko-fi scripts load until you click. The privacy badge stays green.

---

**Contributing?** See [DEVELOPMENT.md](./DEVELOPMENT.md) for setup, architecture, release process, and everything else.
