import { c } from '../theme/colors'

interface Props<T extends string> {
  tabs: readonly T[]
  active: T
  onChange: (next: T) => void
  iconFor?: (tab: T) => string
}

/**
 * Shared sub-tab bar used inside wrapper pages (Analytics / Activity / Config).
 * Matches the style of the top-level sidebar nav so the hierarchy reads clearly.
 */
export function SubTabBar<T extends string>({ tabs, active, onChange, iconFor }: Props<T>) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      marginBottom: 20,
      borderBottom: `1px solid ${c.border}`,
    }}>
      {tabs.map(name => (
        <button
          key={name}
          onClick={() => onChange(name)}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: `2px solid ${active === name ? c.accent : 'transparent'}`,
            color: active === name ? c.text : c.textFaint,
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: active === name ? 600 : 400,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {iconFor ? `${iconFor(name)} ${name}` : name}
        </button>
      ))}
    </div>
  )
}
