import { useMemo, useState } from 'react'
import type { SessionFacet } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'
import { SearchInput, matchesQuery } from '../components/SearchInput'
import { c } from '../theme/colors'

function outcomeColor(outcome?: string): string {
  if (!outcome) return c.textGhost
  if (outcome.includes('achieved')) return c.success
  if (outcome.includes('partial')) return c.warning
  return c.textGhost
}

export function Sessions({ data }: { data: SessionFacet[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query) return data
    return data.filter(s =>
      matchesQuery(s.brief_summary, query) ||
      matchesQuery(s.underlying_goal, query) ||
      matchesQuery(s.session_type, query) ||
      matchesQuery(s.outcome, query) ||
      matchesQuery(s.claude_helpfulness, query) ||
      matchesQuery(s.session_id, query)
    )
  }, [data, query])

  const achieved = data.filter(s => s.outcome?.includes('achieved')).length
  const types = new Set(data.map(s => s.session_type).filter(Boolean))

  return (
    <div>
      <SectionHeader title="Sessions" sub="Claude session history with goals and outcomes" />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="Sessions" value={data.length} sub="with summaries" highlight />
        <StatCard label="Goals Achieved" value={achieved} sub={`${data.length > 0 ? Math.round(achieved / data.length * 100) : 0}%`} />
        <StatCard label="Session Types" value={types.size} sub="distinct" />
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search sessions…"
        count={query ? filtered.length : undefined}
      />

      {query && filtered.length === 0 ? (
        <div style={{ color: c.textGhost, fontSize: 12, padding: '16px 8px' }}>No results for "{query}"</div>
      ) : (
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: c.surfaceAlt }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: c.textGhost }}>Summary</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: c.textGhost }}>Type</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: c.textGhost }}>Outcome</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: c.textGhost }}>Helpfulness</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.session_id} style={{ borderTop: `1px solid ${c.surfaceHover}` }}>
                  <td style={{ padding: '8px 16px', color: c.text, maxWidth: 320 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.brief_summary ?? s.underlying_goal ?? '—'}
                    </div>
                  </td>
                  <td style={{ padding: '8px 16px', color: c.accent, fontSize: 12, whiteSpace: 'nowrap' }}>{s.session_type ?? '—'}</td>
                  <td style={{ padding: '8px 16px', color: outcomeColor(s.outcome), fontSize: 12, whiteSpace: 'nowrap' }}>{s.outcome ?? '—'}</td>
                  <td style={{ padding: '8px 16px', color: c.textMuted, fontSize: 12, whiteSpace: 'nowrap' }}>{s.claude_helpfulness ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
