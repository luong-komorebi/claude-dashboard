/**
 * Theme registry — metadata only. The actual CSS variables for each theme
 * live in index.css under `[data-theme="..."]` selectors.
 *
 * Each entry carries a swatch of 4 colors that the ThemeSwitcher uses to
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
  {
    id: 'default',
    name: 'Default Dark',
    isDark: true,
    swatch: ['#0d0d0d', '#1e1e1e', '#7c6af7', '#e8e8e8'],
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    isDark: true,
    swatch: ['#1e1e2e', '#313244', '#cba6f7', '#cdd6f4'],
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    isDark: false,
    swatch: ['#eff1f5', '#ccd0da', '#8839ef', '#4c4f69'],
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    isDark: true,
    swatch: ['#282828', '#3c3836', '#fabd2f', '#ebdbb2'],
  },
  {
    id: 'gruvbox-light',
    name: 'Gruvbox Light',
    isDark: false,
    swatch: ['#fbf1c7', '#ebdbb2', '#b57614', '#3c3836'],
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    isDark: true,
    swatch: ['#1a1b26', '#24283b', '#bb9af7', '#c0caf5'],
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    isDark: true,
    swatch: ['#191724', '#26233a', '#c4a7e7', '#e0def4'],
  },
]

export const DEFAULT_THEME_ID = 'default'
