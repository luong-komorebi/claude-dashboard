/**
 * Theme application + persistence.
 *
 * Setting `<html data-theme="catppuccin-mocha">` is enough — all the CSS
 * variables cascade from the selector in index.css. We persist the chosen
 * theme id in localStorage so subsequent visits apply it before paint via
 * an inline script in index.html (FOUC prevention).
 */

import { THEMES, DEFAULT_THEME_ID, type ThemeMeta } from './themes'

const STORAGE_KEY = 'claude-dashboard:theme'

/**
 * Legacy theme IDs → current IDs. Users who stored an old ID are
 * transparently remapped so their saved preference doesn't silently
 * revert. Only "default" (the very first app name) is remapped — explicit
 * choices like `github-dark` are preserved even after the default changes.
 */
const LEGACY_ID_ALIASES: Record<string, string> = {
  default: DEFAULT_THEME_ID,
}

export function getStoredThemeId(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_THEME_ID
    const resolved = LEGACY_ID_ALIASES[raw] ?? raw
    // Validate that the ID still exists — fall back if not
    if (THEMES.some(t => t.id === resolved)) return resolved
    return DEFAULT_THEME_ID
  } catch {
    return DEFAULT_THEME_ID
  }
}

export function getCurrentTheme(): ThemeMeta {
  const id = getStoredThemeId()
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}

export function applyTheme(themeId: string): void {
  const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0]
  document.documentElement.setAttribute('data-theme', theme.id)
  try {
    localStorage.setItem(STORAGE_KEY, theme.id)
  } catch { /* private mode — silently skip */ }
}

export { THEMES, DEFAULT_THEME_ID }
export type { ThemeMeta }
