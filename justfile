set shell := ["bash", "-cu"]

# Default: show available recipes
default:
    @just --list

# ─── Setup ────────────────────────────────────────────────────────────────────

# Install all dependencies (node + rust toolchain)
install:
    pnpm install
    rustup target add wasm32-unknown-unknown
    @command -v wasm-pack >/dev/null || curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# ─── Development ──────────────────────────────────────────────────────────────

# Start the Vite dev server (expects WASM to be built already)
dev:
    pnpm --filter web dev

# Build only the WASM crate → web/src/wasm-pkg
wasm:
    pnpm --filter web build:wasm

# Full production build (WASM + web app)
build: wasm
    pnpm --filter web build

# Preview the production build locally
preview: build
    pnpm --filter web preview

# ─── Quality gates ────────────────────────────────────────────────────────────

# Run all tests (Rust + web)
test:
    cargo test --manifest-path wasm/Cargo.toml
    pnpm --filter web test

# Strict TypeScript check, no emit
typecheck:
    pnpm --filter web exec tsc --noEmit

# Everything CI runs: typecheck + tests + build
check: typecheck test build

# ─── Housekeeping ─────────────────────────────────────────────────────────────

# Remove all build artifacts
clean:
    rm -rf target/ web/dist/ web/src/wasm-pkg/ web/node_modules/.tmp/

# Refresh bundled Anthropic model pricing from LiteLLM's canonical JSON
pricing-update:
    curl -sL https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json -o /tmp/litellm_prices.json
    python3 scripts/filter_pricing.py /tmp/litellm_prices.json web/src/cost/pricing.json
    @echo "pricing.json updated — commit the change"

# ─── Standalone binary (offline distribution) ────────────────────────────────

# Build the single-file standalone server binary. Compiles the web app first
# so rust-embed can snapshot the built dist into the binary.
server-build: build
    cargo build --release --manifest-path server/Cargo.toml
    @echo ""
    @echo "  Binary:  target/release/claude-dashboard"
    @ls -lh target/release/claude-dashboard

# Run the standalone server locally (rebuilds the web bundle first)
server-run: server-build
    target/release/claude-dashboard
