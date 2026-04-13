import { useEffect, useId, useState } from 'react'
import { getStorageEstimate } from '../opfs'

/**
 * Counts "external" resource loads since page navigation.
 * A request is external iff its URL doesn't start with our origin, blob:, or data:.
 * The PerformanceObserver receives buffered entries (pre-mount loads included).
 *
 * With the production CSP (`connect-src 'self'`) this count is guaranteed to
 * stay at 0 for the lifetime of the session — the browser refuses to even try.
 */
function useExternalRequestCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const origin = window.location.origin
    const isExternal = (url: string) =>
      !url.startsWith(origin) &&
      !url.startsWith('blob:') &&
      !url.startsWith('data:') &&
      !url.startsWith('chrome-extension:') &&
      !url.startsWith('moz-extension:')

    const observer = new PerformanceObserver(list => {
      const externals = list.getEntries().filter(e => isExternal(e.name))
      if (externals.length > 0) setCount(c => c + externals.length)
    })
    observer.observe({ type: 'resource', buffered: true })
    return () => observer.disconnect()
  }, [])

  return count
}

interface Props {
  variant?: 'compact' | 'full'
}

export function PrivacyBadge({ variant = 'compact' }: Props) {
  const popoverId = useId()
  const externalCount = useExternalRequestCount()
  const [storage, setStorage] = useState<{ usageKb: number; quotaMb: number } | null>(null)
  const safe = externalCount === 0

  useEffect(() => {
    void getStorageEstimate().then(setStorage)
  }, [externalCount])

  const color = safe ? '#4caf50' : '#f44336'
  const bg = safe ? 'rgba(76, 175, 80, 0.08)' : 'rgba(244, 67, 54, 0.08)'
  const border = safe ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'

  return (
    <>
      <button
        type="button"
        popoverTarget={popoverId}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: bg,
          border: `1px solid ${border}`,
          color,
          padding: variant === 'full' ? '10px 14px' : '6px 10px',
          borderRadius: 4,
          fontSize: variant === 'full' ? 12 : 11,
          cursor: 'pointer',
          width: '100%',
          fontWeight: 500,
        }}
        aria-label="Privacy information"
      >
        <ShieldIcon size={variant === 'full' ? 14 : 12} />
        <span style={{ flex: 1, textAlign: 'left' }}>
          {safe ? '100% local' : `${externalCount} external requests`}
        </span>
        <span style={{ color, opacity: 0.6, fontSize: variant === 'full' ? 11 : 10 }}>
          {externalCount} req
        </span>
      </button>

      <div
        id={popoverId}
        popover="auto"
        style={popoverStyle}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8e8', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldIcon size={16} />
          Your data never leaves this tab
        </div>

        <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.7, marginBottom: 14 }}>
          <ProofLine
            label="CSP enforced"
            detail="The browser physically blocks every external connection — not a promise, a platform guarantee"
          />
          <ProofLine
            label="Works offline"
            detail="Disconnect your internet — the dashboard keeps running (it's a PWA)"
          />
          <ProofLine
            label="Open source"
            detail="Audit every line yourself — this is ~1000 lines of plain React + Rust"
          />
          <ProofLine
            label="No telemetry, no analytics"
            detail="Zero third-party scripts, zero tracking pixels, zero backend"
          />
        </div>

        <div style={{
          fontSize: 11,
          color: safe ? '#4caf50' : '#f44336',
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 4,
          padding: '8px 10px',
          marginBottom: 10,
          fontFamily: 'monospace',
        }}>
          Live count: <strong>{externalCount}</strong> external requests this session
        </div>

        <div style={{ fontSize: 11, color: '#666', lineHeight: 1.6, marginBottom: 10 }}>
          <strong style={{ color: '#888' }}>Verify it yourself:</strong> open DevTools → Network tab,
          filter to "Fetch/XHR", refresh the page. The only requests you'll see are to this same origin.
        </div>

        {storage && (
          <div style={{ fontSize: 10, color: '#555', paddingTop: 10, borderTop: '1px solid #222' }}>
            Local storage: <strong style={{ color: '#888' }}>{storage.usageKb} KB</strong>
            {storage.quotaMb > 0 && <> of {storage.quotaMb} MB available</>}
            <span style={{ marginLeft: 6, color: '#444' }}>(OPFS, never sent anywhere)</span>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Inline pieces ────────────────────────────────────────────────────────────

function ShieldIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1L2 3v5c0 3.5 2.5 6.5 6 7 3.5-.5 6-3.5 6-7V3L8 1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M5.5 8l2 2L11 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ProofLine({ label, detail }: { label: string; detail: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: '#4caf50', fontWeight: 600, fontSize: 12 }}>✓ {label}</div>
      <div style={{ color: '#777', fontSize: 11, marginLeft: 16, marginTop: 1 }}>{detail}</div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

// Popover API positions the element at center of viewport by default.
// We style it as a floating panel.
const popoverStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 'unset',
  margin: 0,
  padding: 20,
  background: '#0d0d0d',
  border: '1px solid #333',
  borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
  maxWidth: 420,
  width: '90vw',
  color: '#e8e8e8',
  fontFamily: 'system-ui, sans-serif',
}
