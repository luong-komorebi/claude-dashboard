/**
 * Typed CSS-variable references.
 *
 * Every color in the app funnels through this module. Each value is a
 * `var(--x)` string — actual hex values live in index.css under
 * `[data-theme="..."]` selectors, so changing the theme is just a matter
 * of swapping an attribute on `<html>`.
 */

export const c = {
  // Backgrounds
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surfaceAlt: 'var(--surface-alt)',
  surfaceHover: 'var(--surface-hover)',

  // Borders
  borderSoft: 'var(--border-soft)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',

  // Text
  text: 'var(--text)',
  textMuted: 'var(--text-muted)',
  textDim: 'var(--text-dim)',
  textFaint: 'var(--text-faint)',
  textGhost: 'var(--text-ghost)',
  textDisabled: 'var(--text-disabled)',

  // Accent (primary brand color)
  accent: 'var(--accent)',
  accentFg: 'var(--accent-fg)',

  // Semantic
  success: 'var(--success)',
  successBg: 'var(--success-bg)',
  successBorder: 'var(--success-border)',
  warning: 'var(--warning)',
  error: 'var(--error)',
  errorBg: 'var(--error-bg)',
  errorBorder: 'var(--error-border)',
} as const

export type ColorKey = keyof typeof c
