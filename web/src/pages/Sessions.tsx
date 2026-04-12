import type { SessionFacet } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'

function outcomeColor(outcome?: string): string {
  if (!outcome) return '#555'
  if (outcome.includes('achieved')) return '#4caf50'
  if (outcome.includes('partial')) return '#ff9800'
  return '#555'
}

export function Sessions({ data }: { data: SessionFacet[] }) {
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

      <div style={{ background: '#111', border: '1px solid #333', borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1a1a1a' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#555' }}>Summary</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#555' }}>Type</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#555' }}>Outcome</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#555' }}>Helpfulness</th>
            </tr>
          </thead>
          <tbody>
            {data.map(s => (
              <tr key={s.session_id} style={{ borderTop: '1px solid #1e1e1e' }}>
                <td style={{ padding: '8px 16px', color: '#e8e8e8', maxWidth: 320 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.brief_summary ?? s.underlying_goal ?? '—'}
                  </div>
                </td>
                <td style={{ padding: '8px 16px', color: '#7c6af7', fontSize: 12, whiteSpace: 'nowrap' }}>{s.session_type ?? '—'}</td>
                <td style={{ padding: '8px 16px', color: outcomeColor(s.outcome), fontSize: 12, whiteSpace: 'nowrap' }}>{s.outcome ?? '—'}</td>
                <td style={{ padding: '8px 16px', color: '#aaa', fontSize: 12, whiteSpace: 'nowrap' }}>{s.claude_helpfulness ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
