import { useMemo, useState } from 'react'
import type { Plugin } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'
import { SearchInput, matchesQuery } from '../components/SearchInput'
import { c } from '../theme/colors'

function splitId(id: string): [string, string] {
  const pos = id.lastIndexOf('@')
  return pos >= 0 ? [id.slice(0, pos), id.slice(pos + 1)] : [id, '']
}

export function Plugins({ data }: { data: Plugin[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query) return data
    return data.filter(p => matchesQuery(p.id, query))
  }, [data, query])

  // Enabled first within the filtered set, alpha within each
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      return a.id.localeCompare(b.id)
    }),
    [filtered],
  )

  const enabledCount = data.filter(p => p.enabled).length

  return (
    <div>
      <SectionHeader title="Plugins" sub="Installed Claude Code plugins and their enabled status" />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard label="Installed" value={data.length} highlight />
        <StatCard label="Enabled" value={enabledCount} sub={`${data.length - enabledCount} disabled`} />
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search plugins…"
        count={query ? filtered.length : undefined}
      />

      {sorted.length === 0 ? (
        <div style={{ color: c.textGhost, fontSize: 12, padding: '16px 8px' }}>
          {query ? `No results for "${query}"` : 'No plugins installed'}
        </div>
      ) : (
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, overflow: 'hidden' }}>
          {sorted.map(p => {
            const [name, registry] = splitId(p.id)
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 14px',
                  borderTop: `1px solid ${c.borderSoft}`,
                  opacity: p.enabled ? 1 : 0.5,
                }}
              >
                <span style={{
                  color: p.enabled ? c.success : c.textGhost,
                  fontSize: 12, width: 14, textAlign: 'center',
                }}>
                  {p.enabled ? '●' : '○'}
                </span>
                <span style={{
                  color: p.enabled ? c.text : c.textMuted,
                  fontSize: 12, fontFamily: 'monospace', fontWeight: 500,
                }}>
                  {name}
                </span>
                {registry && (
                  <span style={{
                    color: c.textFaint, fontSize: 11, fontFamily: 'monospace',
                  }}>
                    @{registry}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
