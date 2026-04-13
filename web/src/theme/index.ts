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

export function getStoredThemeId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID
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
