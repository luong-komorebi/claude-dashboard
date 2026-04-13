import { useMemo, useState } from 'react'
import type { SettingsData } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'
import { SearchInput, matchesQuery } from '../components/SearchInput'
import { c } from '../theme/colors'

export function Settings({ data }: { data: SettingsData }) {
  const [query, setQuery] = useState('')

  const filteredHistory = useMemo(() => {
    if (!query) return data.recent_history
    return data.recent_history.filter(
      entry => matchesQuery(entry.display, query) || matchesQuery(entry.project, query)
    )
  }, [data.recent_history, query])

  return (
    <div>
      <SectionHeader title="Settings" sub="Permissions, plugins, and recent command history" />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="Allowed Tools" value={data.allowed_tools.length} highlight />
        <StatCard label="Effort Level" value={data.effort_level ?? 'default'} />
        <StatCard label="Always Thinking" value={data.always_thinking ? 'on' : 'off'} />
        <StatCard label="History Entries" value={data.recent_history.length} sub="recent commands" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: 16 }}>
          <div style={{ color: c.accent, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Allowed Tools / Permissions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflow: 'auto' }}>
            {data.allowed_tools.map((tool, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: c.success, fontSize: 12 }}>✓</span>
                <span style={{ color: c.textMuted, fontSize: 12, fontFamily: 'monospace' }}>{tool}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: 16 }}>
          <div style={{ color: c.success, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Enabled Plugins</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflow: 'auto', marginBottom: 16 }}>
            {data.enabled_plugins.map(p => (
              <div key={p} style={{ color: c.textMuted, fontSize: 12, fontFamily: 'monospace' }}>{p}</div>
            ))}
          </div>
          {data.disabled_plugins.length > 0 && (
            <>
              <div style={{ color: c.textGhost, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Disabled Plugins</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflow: 'auto' }}>
                {data.disabled_plugins.map(p => (
                  <div key={p} style={{ color: c.textDisabled, fontSize: 12, fontFamily: 'monospace' }}>{p}</div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', background: c.surfaceAlt, color: c.accent, fontSize: 13, fontWeight: 600 }}>Recent History</div>
        <div style={{ padding: '12px 16px 0' }}>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search command history…"
            count={query ? filteredHistory.length : undefined}
          />
        </div>
        {query && filteredHistory.length === 0 ? (
          <div style={{ color: c.textGhost, fontSize: 12, padding: '16px 8px' }}>No results for "{query}"</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {filteredHistory.map((entry, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${c.surfaceHover}` }}>
                  <td style={{ padding: '7px 16px', color: c.text, fontFamily: 'monospace', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.display}
                  </td>
                  <td style={{ padding: '7px 16px', color: c.textGhost, fontSize: 12 }}>
                    {entry.project?.split('/').pop()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
