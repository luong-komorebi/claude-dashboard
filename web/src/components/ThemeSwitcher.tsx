import { useId, useState } from 'react'
import { c } from '../theme/colors'
import { THEMES, applyTheme, getCurrentTheme } from '../theme'
import type { ThemeMeta } from '../theme'

/**
 * Sidebar button that opens a Popover of theme cards. Uses the native
 * Popover API (`popover="auto"` + `popoverTarget={id}`) for open/close —
 * no React state needed for visibility, and Escape + click-outside both
 * close it automatically.
 */
export function ThemeSwitcher() {
  const popoverId = useId()
  const [current, setCurrent] = useState<ThemeMeta>(() => getCurrentTheme())

  const selectTheme = (theme: ThemeMeta) => {
    applyTheme(theme.id)
    setCurrent(theme)
    // Close the popover
    const el = document.getElementById(popoverId) as HTMLElement & { hidePopover?: () => void } | null
    el?.hidePopover?.()
  }

  return (
    <>
      <button
        type="button"
        popoverTarget={popoverId}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: `1px solid ${c.borderSoft}`,
          color: c.textFaint,
          padding: '5px 10px',
          borderRadius: 4,
          fontSize: 11,
          cursor: 'pointer',
          width: '100%',
          fontWeight: 500,
        }}
        aria-label="Switch theme"
      >
        <PaletteIcon size={12} />
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current.name}
        </span>
        <SwatchStrip colors={current.swatch} size={8} />
      </button>

      <div id={popoverId} popover="auto" style={popoverStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 4 }}>
          Theme
        </div>
        <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 14 }}>
          Persists across sessions via localStorage. Applied before paint to avoid flash.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {THEMES.map(theme => {
            const active = theme.id === current.id
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => selectTheme(theme)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 8,
                  background: active ? c.surfaceHover : c.surface,
                  border: `1px solid ${active ? c.accent : c.border}`,
                  borderRadius: 6,
                  padding: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 120ms',
                }}
              >
                <SwatchStrip colors={theme.swatch} size={14} />
                <div style={{ fontSize: 12, color: c.text, fontWeight: 600 }}>
                  {theme.name}
                </div>
                <div style={{ fontSize: 10, color: c.textFaint }}>
                  {theme.isDark ? 'Dark' : 'Light'}
                  {active && ' · active'}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

function SwatchStrip({ colors, size }: { colors: readonly string[]; size: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {colors.map((color, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            background: color,
            borderRadius: 2,
            border: `1px solid ${c.borderSoft}`,
          }}
        />
      ))}
    </div>
  )
}

function PaletteIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5a6.5 6.5 0 100 13c.9 0 1.5-.6 1.5-1.3 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.7.6-1.2 1.3-1.2h1.5a3.5 3.5 0 003.5-3.5C15 3.5 11.9 1.5 8 1.5z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="5" cy="6" r="0.8" fill="currentColor" />
      <circle cx="7.5" cy="4" r="0.8" fill="currentColor" />
      <circle cx="11" cy="6" r="0.8" fill="currentColor" />
    </svg>
  )
}

const popoverStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 'unset',
  margin: 0,
  padding: 20,
  background: c.bg,
  border: `1px solid ${c.border}`,
  borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
  maxWidth: 420,
  width: '90vw',
  color: c.text,
  fontFamily: 'system-ui, sans-serif',
}
