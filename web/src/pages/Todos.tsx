import { useMemo, useState } from 'react'
import type { TodosData, TodoItem } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'
import { SearchInput, matchesQuery } from '../components/SearchInput'
import { c } from '../theme/colors'

function statusIcon(status: string) {
  if (status === 'in_progress') return { icon: '▶', color: c.warning }
  if (status === 'pending') return { icon: '○', color: c.textMuted }
  return { icon: '✓', color: c.success }
}

function TodoRow({ item }: { item: TodoItem }) {
  const { icon, color } = statusIcon(item.status)
  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 16px', borderTop: `1px solid ${c.surfaceHover}`, alignItems: 'flex-start' }}>
      <span style={{ color, fontSize: 13, marginTop: 1 }}>{icon}</span>
      <span style={{ color: item.status === 'completed' ? c.textGhost : c.text, fontSize: 13 }}>{item.content}</span>
    </div>
  )
}

export function Todos({ data }: { data: TodosData }) {
  const [query, setQuery] = useState('')

  const activeSessions = useMemo(
    () =>
      data.sessions.filter(s =>
        s.items.some(i => i.status === 'in_progress' || i.status === 'pending')
      ),
    [data.sessions]
  )

  const filteredSessions = useMemo(() => {
    if (!query) return activeSessions
    return activeSessions
      .map(session => ({
        ...session,
        items: session.items.filter(i => matchesQuery(i.content, query)),
      }))
      .filter(session => session.items.some(i => i.status !== 'completed'))
  }, [activeSessions, query])

  const filteredPlans = useMemo(() => {
    if (!query) return data.plans
    return data.plans.filter(
      p => matchesQuery(p.name, query) || matchesQuery(p.content, query)
    )
  }, [data.plans, query])

  const matchCount = useMemo(() => {
    if (!query) return 0
    const todoMatches = filteredSessions.reduce(
      (sum, s) => sum + s.items.filter(i => i.status !== 'completed').length,
      0
    )
    return todoMatches + filteredPlans.length
  }, [filteredSessions, filteredPlans, query])

  const hasResults = filteredSessions.length > 0 || filteredPlans.length > 0

  return (
    <div>
      <SectionHeader title="Todos & Plans" sub="Active task lists and implementation plans" />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="Active Sessions" value={activeSessions.length} highlight />
        <StatCard label="In Progress" value={data.in_progress_count} sub="tasks" />
        <StatCard label="Pending" value={data.pending_count} sub="tasks queued" />
        <StatCard label="Plans" value={data.plans.length} />
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search todos and plans…"
        count={query ? matchCount : undefined}
      />

      {query && !hasResults ? (
        <div style={{ color: c.textGhost, fontSize: 12, padding: '16px 8px' }}>No results for "{query}"</div>
      ) : (
        <>
          {filteredSessions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ color: c.accent, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Active Todo Sessions</div>
              {filteredSessions.map(session => (
                <div key={session.id} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 16px', background: c.surfaceAlt, color: c.textGhost, fontSize: 11, fontFamily: 'monospace' }}>
                    {session.id.slice(0, 36)}
                  </div>
                  {session.items
                    .filter(i => i.status !== 'completed')
                    .map((item, idx) => <TodoRow key={idx} item={item} />)}
                </div>
              ))}
            </div>
          )}

          {filteredPlans.length > 0 && (
            <div>
              <div style={{ color: c.accent, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Plans</div>
              {filteredPlans.map(plan => (
                <div key={plan.name} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', background: c.surfaceAlt, color: c.text, fontWeight: 600 }}>
                    📋 {plan.name}
                  </div>
                  <pre style={{ margin: 0, padding: '12px 16px', color: c.textMuted, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflow: 'auto' }}>
                    {plan.content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
