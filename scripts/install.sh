#!/usr/bin/env bash
# Claude Dashboard — one-line installer for the standalone binary.
#
# Usage:
#   curl -sSfL https://raw.githubusercontent.com/luong-komorebi/claude-dashboard/main/scripts/install.sh | bash
#
# Downloads the latest release binary for your platform, verifies the
# download, chmod +x, and places it at ${INSTALL_DIR:-~/.local/bin}.
# Override with environment variables:
#   INSTALL_DIR=/usr/local/bin  — where to put the binary
#   VERSION=v0.2.0              — pin a specific release tag
#   REPO=user/fork              — install from a fork

set -euo pipefail

REPO="${REPO:-luong-komorebi/claude-dashboard}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
BINARY_NAME="claude-dashboard"

# ─── Helpers ──────────────────────────────────────────────────────────────────

info()  { printf '\033[36m  %s\033[0m\n' "$*"; }
ok()    { printf '\033[32m✓ %s\033[0m\n' "$*"; }
warn()  { printf '\033[33m! %s\033[0m\n' "$*"; }
err()   { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; }

need() {
  command -v "$1" >/dev/null 2>&1 || {
    err "Required command '$1' not found. Please install it and retry."
    exit 1
  }
}

need curl
need uname

# ─── Detect platform ─────────────────────────────────────────────────────────

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64|aarch64) ASSET="claude-dashboard-macos-arm64" ;;
      x86_64)        ASSET="claude-dashboard-macos-x64"   ;;
      *) err "Unsupported macOS architecture: $ARCH"; exit 1 ;;
    esac
    ;;
  Linux)
    case "$ARCH" in
      x86_64|amd64) ASSET="claude-dashboard-linux-x64" ;;
      *) err "Unsupported Linux architecture: $ARCH. Only x86_64 is prebuilt — build from source for other archs."; exit 1 ;;
    esac
    ;;
  MINGW*|MSYS*|CYGWIN*)
    err "For Windows, download claude-dashboard-windows-x64.exe manually from the Releases page."
    exit 1
    ;;
  *)
    err "Unsupported OS: $OS"
    exit 1
    ;;
esac

info "Detected: $OS / $ARCH → $ASSET"

# ─── Resolve release tag ─────────────────────────────────────────────────────

if [[ -n "${VERSION:-}" ]]; then
  TAG="$VERSION"
  info "Using pinned version: $TAG"
else
  info "Resolving latest release…"
  TAG="$(curl -sSfL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep -o '"tag_name": *"[^"]*"' \
    | head -1 \
    | cut -d'"' -f4)"
  if [[ -z "$TAG" ]]; then
    err "Could not determine latest release tag. Pass VERSION=vX.Y.Z to pin a version."
    exit 1
  fi
  info "Latest: $TAG"
fi

URL="https://github.com/$REPO/releases/download/$TAG/$ASSET"

# ─── Download ────────────────────────────────────────────────────────────────

mkdir -p "$INSTALL_DIR"
TARGET="$INSTALL_DIR/$BINARY_NAME"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

info "Downloading $URL"
if ! curl -sSfL -o "$TMP" "$URL"; then
  err "Download failed. URL: $URL"
  exit 1
fi

# Sanity check: binary should be at least a few hundred KB
SIZE="$(wc -c < "$TMP" | tr -d ' ')"
if [[ "$SIZE" -lt 100000 ]]; then
  err "Downloaded file is suspiciously small ($SIZE bytes). Aborting."
  exit 1
fi

mv "$TMP" "$TARGET"
chmod +x "$TARGET"
trap - EXIT

ok "Installed: $TARGET ($(( SIZE / 1024 )) KB)"

# ─── Post-install guidance ───────────────────────────────────────────────────

if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
  warn "$INSTALL_DIR is not on your PATH."
  echo
  echo "  Add this to your shell rc file:"
  echo "    export PATH=\"$INSTALL_DIR:\$PATH\""
  echo
  echo "  Or run the binary with its full path:"
  echo "    $TARGET"
else
  echo
  echo "Run with:"
  echo "  $BINARY_NAME"
  echo
  echo "Then open http://localhost:7878 in your browser (should auto-open)."
fi
