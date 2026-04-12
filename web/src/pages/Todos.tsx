import type { TodosData, TodoItem } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'

function statusIcon(status: string) {
  if (status === 'in_progress') return { icon: '▶', color: '#ff9800' }
  if (status === 'pending') return { icon: '○', color: '#aaa' }
  return { icon: '✓', color: '#4caf50' }
}

function TodoRow({ item }: { item: TodoItem }) {
  const { icon, color } = statusIcon(item.status)
  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 16px', borderTop: '1px solid #1e1e1e', alignItems: 'flex-start' }}>
      <span style={{ color, fontSize: 13, marginTop: 1 }}>{icon}</span>
      <span style={{ color: item.status === 'completed' ? '#555' : '#e8e8e8', fontSize: 13 }}>{item.content}</span>
    </div>
  )
}

export function Todos({ data }: { data: TodosData }) {
  const activeSessions = data.sessions.filter(s =>
    s.items.some(i => i.status === 'in_progress' || i.status === 'pending')
  )

  return (
    <div>
      <SectionHeader title="Todos & Plans" sub="Active task lists and implementation plans" />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="Active Sessions" value={activeSessions.length} highlight />
        <StatCard label="In Progress" value={data.in_progress_count} sub="tasks" />
        <StatCard label="Pending" value={data.pending_count} sub="tasks queued" />
        <StatCard label="Plans" value={data.plans.length} />
      </div>

      {activeSessions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: '#7c6af7', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Active Todo Sessions</div>
          {activeSessions.map(session => (
            <div key={session.id} style={{ background: '#111', border: '1px solid #333', borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 16px', background: '#1a1a1a', color: '#555', fontSize: 11, fontFamily: 'monospace' }}>
                {session.id.slice(0, 36)}
              </div>
              {session.items
                .filter(i => i.status !== 'completed')
                .map((item, idx) => <TodoRow key={idx} item={item} />)}
            </div>
          ))}
        </div>
      )}

      {data.plans.length > 0 && (
        <div>
          <div style={{ color: '#7c6af7', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Plans</div>
          {data.plans.map(plan => (
            <div key={plan.name} style={{ background: '#111', border: '1px solid #333', borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: '#1a1a1a', color: '#e8e8e8', fontWeight: 600 }}>
                📋 {plan.name}
              </div>
              <pre style={{ margin: 0, padding: '12px 16px', color: '#aaa', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflow: 'auto' }}>
                {plan.content}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
