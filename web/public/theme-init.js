/**
 * FOUC prevention: apply the user's stored theme before any CSS parses.
 *
 * This file is intentionally kept OUT of the src/ bundle and served from
 * `public/` verbatim. Why:
 *   - The production CSP is `script-src 'self' 'wasm-unsafe-eval'` with no
 *     `'unsafe-inline'` — inline `<script>` blocks in index.html are blocked.
 *   - External scripts with `src="theme-init.js"` are same-origin → allowed.
 *   - Browser preloader fetches this in parallel with the CSS, so there's
 *     effectively zero extra latency vs the inline version.
 *
 * If you change this file, bump the version in index.html's <script src>
 * query string to bust the service worker cache.
 */
;(function () {
  try {
    var key = 'claude-dashboard:theme'
    var t = localStorage.getItem(key)
    // Remap the legacy "default" id to the current default theme
    if (t === 'default') t = 'tokyo-night'
    if (t) document.documentElement.setAttribute('data-theme', t)
  } catch (_) {
    // localStorage may throw in private-browsing mode — silently fall through.
    // The CSS `:root` defaults in index.css will still render a valid theme.
  }
})()
