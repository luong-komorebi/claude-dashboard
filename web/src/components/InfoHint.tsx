import { useId } from 'react'
import { c } from '../theme/colors'

interface Props {
  /** Short label shown inline next to the trigger — e.g. "API equivalent" */
  label?: string
  /** Rich explainer shown in the popover */
  children: React.ReactNode
  /** Popover title */
  title?: string
}

/**
 * Small ⓘ info icon with a click-to-reveal popover explainer. Uses the
 * native Popover API so Escape + click-outside close it for free.
 */
export function InfoHint({ label, title, children }: Props) {
  const popoverId = useId()

  return (
    <>
      <button
        type="button"
        popoverTarget={popoverId}
        aria-label={title ?? 'More information'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'transparent',
          border: 'none',
          color: c.textFaint,
          padding: 0,
          fontSize: 11,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 13,
            height: 13,
            borderRadius: '50%',
            border: `1px solid ${c.border}`,
            fontSize: 9,
            fontWeight: 700,
            color: c.textFaint,
          }}
        >
          i
        </span>
        {label && <span style={{ color: c.textFaint }}>{label}</span>}
      </button>

      <div id={popoverId} popover="auto" style={popoverStyle}>
        {title && (
          <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 10 }}>
            {title}
          </div>
        )}
        <div style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.7 }}>
          {children}
        </div>
      </div>
    </>
  )
}

const popoverStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 'unset',
  margin: 0,
  padding: 18,
  background: c.bg,
  border: `1px solid ${c.border}`,
  borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
  maxWidth: 400,
  width: '90vw',
  color: c.text,
  fontFamily: 'system-ui, sans-serif',
}
