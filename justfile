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
