/**
 * Theme registry — metadata only. The actual CSS variables for each theme
 * live in index.css under `[data-theme="..."]` selectors.
 *
 * Each entry carries a swatch of 4 colors the ThemeSwitcher uses to
 * preview the theme before the user picks it.
 */

export interface ThemeMeta {
  id: string
  name: string
  isDark: boolean
  /** 4 preview swatches: [bg, surface, accent, text] */
  swatch: [string, string, string, string]
}

export const THEMES: ThemeMeta[] = [
  // ── Defaults (GitHub-inspired) ─────────────────────────────────────────────
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    isDark: true,
    swatch: ['#0d1117', '#161b22', '#58a6ff', '#c9d1d9'],
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    isDark: false,
    swatch: ['#ffffff', '#f6f8fa', '#0969da', '#24292f'],
  },

  // ── Popular dark ───────────────────────────────────────────────────────────
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    isDark: true,
    swatch: ['#1e1e2e', '#313244', '#cba6f7', '#cdd6f4'],
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    isDark: true,
    swatch: ['#1a1b26', '#24283b', '#bb9af7', '#c0caf5'],
  },
  {
    id: 'dracula',
    name: 'Dracula',
    isDark: true,
    swatch: ['#282a36', '#44475a', '#bd93f9', '#f8f8f2'],
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    isDark: true,
    swatch: ['#282c34', '#3e4451', '#61afef', '#abb2bf'],
  },
  {
    id: 'nord',
    name: 'Nord',
    isDark: true,
    swatch: ['#2e3440', '#3b4252', '#88c0d0', '#eceff4'],
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    isDark: true,
    swatch: ['#282828', '#3c3836', '#fabd2f', '#ebdbb2'],
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    isDark: true,
    swatch: ['#191724', '#26233a', '#c4a7e7', '#e0def4'],
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    isDark: true,
    swatch: ['#002b36', '#073642', '#268bd2', '#839496'],
  },
  {
    id: 'monokai',
    name: 'Monokai',
    isDark: true,
    swatch: ['#272822', '#3e3d32', '#a6e22e', '#f8f8f2'],
  },

  // ── Light ─────────────────────────────────────────────────────────────────
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    isDark: false,
    swatch: ['#eff1f5', '#ccd0da', '#8839ef', '#4c4f69'],
  },
  {
    id: 'gruvbox-light',
    name: 'Gruvbox Light',
    isDark: false,
    swatch: ['#fbf1c7', '#ebdbb2', '#b57614', '#3c3836'],
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    isDark: false,
    swatch: ['#fdf6e3', '#eee8d5', '#268bd2', '#657b83'],
  },
]

export const DEFAULT_THEME_ID = 'github-dark'
