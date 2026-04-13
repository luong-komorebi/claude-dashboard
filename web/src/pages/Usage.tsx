import type { UsageData } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'
import { c } from '../theme/colors'

function outcomeColor(outcome?: string): string {
  if (!outcome) return c.textGhost
  if (outcome.includes('achieved')) return c.success
  if (outcome.includes('partial')) return c.warning
  return c.textGhost
}

export function Usage({ data }: { data: UsageData }) {
  const achieved = (data.outcome_counts['mostly_achieved'] ?? 0) + (data.outcome_counts['fully_achieved'] ?? 0)
  const veryHelpful = data.helpfulness_counts['very_helpful'] ?? 0
  const pct = (n: number) => data.total_sessions > 0 ? `${Math.round(n / data.total_sessions * 100)}%` : '0%'

  const outcomes = Object.entries(data.outcome_counts).sort((a, b) => b[1] - a[1])
  const helpfulness = Object.entries(data.helpfulness_counts).sort((a, b) => b[1] - a[1])
  const maxOutcome = Math.max(...outcomes.map(([, v]) => v), 1)
  const maxHelp = Math.max(...helpfulness.map(([, v]) => v), 1)

  return (
    <div>
      <SectionHeader title="Usage" sub="Session outcomes and helpfulness from usage-data/facets" />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="Sessions Tracked" value={data.total_sessions} sub="with outcome data" highlight />
        <StatCard label="Goals Achieved" value={achieved} sub="fully or mostly" />
        <StatCard label="Very Helpful" value={veryHelpful} sub={pct(veryHelpful)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: 16 }}>
          <div style={{ color: c.accent, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Outcomes</div>
          {outcomes.map(([outcome, count]) => (
            <div key={outcome} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: c.textMuted, fontSize: 12 }}>{outcome}</span>
                <span style={{ color: c.textFaint, fontSize: 12 }}>{count}</span>
              </div>
              <div style={{ background: c.surfaceHover, borderRadius: 2, height: 6 }}>
                <div style={{ background: c.accent, borderRadius: 2, height: 6, width: `${count / maxOutcome * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: 16 }}>
          <div style={{ color: c.success, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Helpfulness</div>
          {helpfulness.map(([h, count]) => (
            <div key={h} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: c.textMuted, fontSize: 12 }}>{h}</span>
                <span style={{ color: c.textFaint, fontSize: 12 }}>{count}</span>
              </div>
              <div style={{ background: c.surfaceHover, borderRadius: 2, height: 6 }}>
                <div style={{ background: c.success, borderRadius: 2, height: 6, width: `${count / maxHelp * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

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
            {data.facets.map(f => (
              <tr key={f.session_id} style={{ borderTop: `1px solid ${c.surfaceHover}` }}>
                <td style={{ padding: '8px 16px', color: c.text, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.brief_summary ?? f.underlying_goal ?? '—'}
                </td>
                <td style={{ padding: '8px 16px', color: c.accent, fontSize: 12 }}>{f.session_type ?? '—'}</td>
                <td style={{ padding: '8px 16px', color: outcomeColor(f.outcome), fontSize: 12 }}>{f.outcome ?? '—'}</td>
                <td style={{ padding: '8px 16px', color: c.textMuted, fontSize: 12 }}>{f.claude_helpfulness ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
