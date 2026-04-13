import { c } from '../theme/colors'

interface Props {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  count?: number | undefined // optional "X results" display on the right
}

export function SearchInput({ value, onChange, placeholder = 'Search…', count }: Props) {
  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          color: c.textFaint,
          fontSize: 13,
          pointerEvents: 'none',
        }}
      >
        ⌕
      </span>
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: 4,
          padding: '8px 80px 8px 30px',
          color: c.text,
          fontSize: 13,
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      {value && (
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          {count !== undefined && (
            <span style={{ color: c.textFaint, fontSize: 11 }}>
              {count} result{count === 1 ? '' : 's'}
            </span>
          )}
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            style={{
              background: 'transparent',
              border: 'none',
              color: c.textFaint,
              cursor: 'pointer',
              padding: 0,
              fontSize: 14,
              lineHeight: 1,
              pointerEvents: 'auto',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

/** Case-insensitive substring check used by every list page. */
export function matchesQuery(text: string | undefined, query: string): boolean {
  if (!query) return true
  if (!text) return false
  return text.toLowerCase().includes(query.toLowerCase())
}
