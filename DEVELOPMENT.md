# Development

Everything a contributor needs. Users should read the [README](./README.md) instead.

## Prerequisites

- Node 22+ and `pnpm`
- Rust stable + `wasm32-unknown-unknown` target
- `wasm-pack`
- `just` (task runner)
- Python 3 (only for the pricing-refresh script)

One-liner:

```bash
just install
```

This runs `pnpm install`, adds the Rust `wasm32-unknown-unknown` target, and installs `wasm-pack` if missing.

## Common recipes

```bash
just dev          # Vite dev server at http://localhost:5173
just wasm         # build the Rust analytics module (required before tests)
just test         # cargo test + vitest
just check        # full CI-equivalent: typecheck + tests + build
just server-build # build the standalone binary (embeds dist/)
just server-run   # build + run the standalone binary
just pricing-update  # refresh bundled Anthropic pricing from LiteLLM
```

`just` with no args lists everything.

## Project layout

```
wasm/      Rust analytics crate — trends, forecasting, reports, insights, what-if
server/    Rust static-server binary — embeds web/dist via rust-embed + tiny_http
web/       Vite + React + TypeScript app
scripts/   Python helpers (pricing table filter)
.github/   CI, release, dependabot, pricing-update workflows
```

## Architecture

### Data flow

```
~/.claude (user's folder)
    │
    ▼  File System Access API (user picks once, handle persisted in IndexedDB)
Web Worker (parser.worker.ts)
    │  Parses JSONL line-by-line via Blob.stream() + TextDecoderStream
    │  Extracts: usage events, memory files, plugins, todos, plans, settings,
    │  history, session facets, daily stats — plus real project cwd from
    │  JSONL events (lossless path decoding).
    ▼
DashboardData (structured-cloned back to main thread)
    │
    ├─▶ OPFS cache (gzip-compressed) for instant reopen
    │
    ▼
Rust/WASM (wasm/src/lib.rs)
    │  compute_reports  — Daily / Weekly / Monthly / Sessions / 5h Blocks
    │  compute_trends   — streaks, moving averages, best day, 7-day direction
    │  compute_forecast — Holt-Winters additive, grid-searched α/β/γ + anomalies
    │  compute_insights — rule engine producing ranked observations
    │  compute_what_if  — cost simulation under model-swap rules
    ▼
React pages (pages/*.tsx) — 5 top-level tabs
```

All I/O except the initial folder pick happens in the Worker so the UI never blocks.

### Why http://localhost, not file://

The File System Access API requires a secure context. `http://localhost` qualifies everywhere; `file://` has inconsistent support across browsers. That's why the standalone binary runs a tiny HTTP server rather than just opening an HTML file.

### Why non-async picker call

`showDirectoryPicker()` must be called synchronously from the click handler that initiated it. Wrapping it in an `async` function introduces a microtask break that some browsers reject with `SecurityError: Must be handling a user gesture`. Both `pickClaudeDir` (in `fs-access.ts`) and `grantAccess` (in `App.tsx`) are intentionally NOT async — they use `.then()` chains to keep the gesture chain intact.

## CI

Three workflows:

| Workflow | Trigger | Purpose |
|---|---|---|
| [`deploy.yml`](.github/workflows/deploy.yml) | push to `main` | Type-check, run all tests (cargo + vitest), build, deploy to GitHub Pages |
| [`release-please.yml`](.github/workflows/release-please.yml) | push to `main` | Scans Conventional Commits, opens a Release PR with CHANGELOG + version bumps |
| [`release.yml`](.github/workflows/release.yml) | `v*` tag push | Cross-compiles the standalone binary for 4 platforms, publishes to GitHub Releases |
| [`update-pricing.yml`](.github/workflows/update-pricing.yml) | weekly cron | Refreshes bundled Anthropic pricing from LiteLLM, opens a PR |

## Release process

Fully automated via [release-please](https://github.com/googleapis/release-please):

1. Commit to `main` with Conventional Commits (`feat:`, `fix:`, `perf:`, `docs:`, etc.)
2. `Release Please` opens (or updates) a **Release PR** with a generated `CHANGELOG.md` and synchronized version bumps across `server/Cargo.toml`, `wasm/Cargo.toml`, and `web/package.json`
3. Merge the Release PR — a `v0.x.y` tag is created automatically
4. The Release Please workflow **calls** `Release Standalone Binaries` via `workflow_call`, which checks out the new tag, cross-compiles, and attaches 4 platform binaries to the release. (Direct tag-push trigger doesn't fire because GitHub suppresses workflows for events created with `GITHUB_TOKEN`.)

No manual tagging, no manual changelog, no manual version bumps. Just merge the PR.

**Dry run:** `Actions` → *Release Standalone Binaries* → *Run workflow* produces a **draft** release you can inspect before publishing.

## Updating model pricing

The Reports and Insights tabs show API-equivalent costs using [LiteLLM's canonical pricing data](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json).

- **Scheduled:** `update-pricing.yml` runs weekly on Monday 06:00 UTC and opens a PR with any diff
- **Manual:** `just pricing-update` runs the same `scripts/filter_pricing.py` and writes to `web/src/cost/pricing.json`

Only Anthropic models are kept to keep the bundle small.

## Tests

- **Rust:** 22 unit tests in `wasm/src/lib.rs` — run with `cargo test --manifest-path wasm/Cargo.toml`
- **Web:** 61 tests across 9 files in `web/src/test/` — run with `pnpm --filter web test`
- Both are invoked by `just test` and `just check`

The test job in `deploy.yml` also runs `tsc --noEmit` for strict type checking — note that tests run **after** WASM is built, because several pages do `import('../wasm-pkg/claude_analytics')` and the typechecker needs those types.

## File System Access API — what you can read

We read but never write:

```
~/.claude/stats-cache.json             daily activity rollups
~/.claude/usage-data/facets/*.json     session summaries (outcome, helpfulness)
~/.claude/projects/<id>/*.jsonl        per-session event logs (usage + cwd)
~/.claude/projects/<id>/memory/*.md    project memory files
~/.claude/plugins/installed_plugins.json
~/.claude/settings.json                enabled plugins, allowed tools, effort
~/.claude/history.jsonl                command history
~/.claude/todos/*.json                 todos grouped by session
~/.claude/plans/*.md                   plan files
```

What we don't (yet) parse: `statsig/` (account info), `sessions/` (live processes), `ide/` (connected IDEs), `cache/changelog.md`, `file-history/`. See the open GitHub issues for progress.

## Contributing

1. Branch from `main`
2. Use Conventional Commits for messages (`feat:`, `fix:`, etc.) — release-please uses them
3. `just check` before pushing
4. Open a PR; once merged to `main`, release-please handles the rest

Bug reports and feature requests welcome via GitHub Issues.
