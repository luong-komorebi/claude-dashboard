import { useMemo, useState } from 'react'
import type { SettingsData } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'
import { SearchInput, matchesQuery } from '../components/SearchInput'
import { c } from '../theme/colors'
import { OnlineModeSettings } from './OnlineModeSettings'

interface Props {
  data: SettingsData
  onOnlineModeChange?: () => void
}

export function Settings({ data, onOnlineModeChange }: Props) {
  const [query, setQuery] = useState('')

  const filteredHistory = useMemo(() => {
    if (!query) return data.recent_history
    return data.recent_history.filter(
      e => matchesQuery(e.display, query) || matchesQuery(e.project, query),
    )
  }, [data.recent_history, query])

  return (
    <div>
      <SectionHeader title="Settings" sub="Permissions, effort level, online mode, and recent command history" />

      <OnlineModeSettings onChange={() => onOnlineModeChange?.()} />

      {/* Compact stat row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard label="Effort Level" value={data.effort_level ?? 'default'} highlight />
        <StatCard label="Always Thinking" value={data.always_thinking ? 'on' : 'off'} />
        <StatCard label="Allowed Tools" value={data.allowed_tools.length} />
        <StatCard label="History" value={data.recent_history.length} sub="commands logged" />
      </div>

      {/* Allowed tools as compact pills */}
      {data.allowed_tools.length > 0 && (
        <div style={{
          background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6,
          padding: 14, marginBottom: 16,
        }}>
          <div style={{
            color: c.accent, fontSize: 11, fontWeight: 600, marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            Allowed tools
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {data.allowed_tools.map(tool => (
              <span key={tool} style={{
                fontFamily: 'monospace', fontSize: 11,
                color: c.textMuted, background: c.surfaceHover,
                padding: '3px 8px', borderRadius: 3,
                border: `1px solid ${c.borderSoft}`,
              }}>
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent history table */}
      <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{
          padding: '10px 14px', background: c.surfaceAlt,
          color: c.accent, fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: 0.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Recent commands</span>
          <span style={{ color: c.textFaint, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {data.recent_history.length} total
          </span>
        </div>
        <div style={{ padding: '10px 14px 0' }}>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search command history…"
            count={query ? filteredHistory.length : undefined}
          />
        </div>
        {query && filteredHistory.length === 0 ? (
          <div style={{ color: c.textGhost, fontSize: 12, padding: '0 14px 14px' }}>
            No results for "{query}"
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {filteredHistory.map((entry, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${c.borderSoft}` }}>
                  <td style={{
                    padding: '6px 14px', color: c.text, fontFamily: 'monospace',
                    maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.display}
                  </td>
                  <td style={{
                    padding: '6px 14px', color: c.textGhost, fontSize: 11,
                    textAlign: 'right', whiteSpace: 'nowrap',
                  }}>
                    {entry.project?.split('/').pop() ?? ''}
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
