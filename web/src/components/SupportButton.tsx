/**
 * Plain anchor tag styled like Ko-fi's floating-chat widget.
 *
 * Intentionally NOT the official Ko-fi script widget — that would require
 * loading https://storage.ko-fi.com, which breaks the app's CSP
 * (`connect-src 'self'`, `script-src 'self'`) and contradicts the
 * "0 external requests" privacy guarantee displayed in PrivacyBadge.
 *
 * Behavior:
 *   - Fixed bottom-right, always visible
 *   - Opens https://ko-fi.com/luongvo in a new tab
 *   - `rel="noopener noreferrer"` prevents Ko-fi from reading the opener or
 *     seeing the Referer header
 *   - Zero network traffic until the user actually clicks
 */

const KOFI_URL = 'https://ko-fi.com/H2H71LA8V'
const KOFI_BLUE = '#00b9fe'

export function SupportButton() {
  return (
    <a
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Support me on Ko-fi"
      title="Support me on Ko-fi — opens in a new tab"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 100,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: KOFI_BLUE,
        color: '#ffffff',
        textDecoration: 'none',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        padding: '10px 16px',
        borderRadius: 24,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)'
      }}
    >
      <KofiCup />
      <span>Support me</span>
    </a>
  )
}

/**
 * Tiny inline SVG cup — matches the Ko-fi brand cup shape without embedding
 * the actual Ko-fi logo (which is trademarked). Close enough visually that
 * users recognize the widget instantly.
 */
function KofiCup() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 8h13a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16 10h1a1 1 0 0 1 0 2h-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 2v3M11 2v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
