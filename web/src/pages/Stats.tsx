import type { StatsData } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'
import { c } from '../theme/colors'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function Stats({ data }: { data: StatsData }) {
  const recent = [...data.daily_activity].slice(-30)
  const chartData = recent.map(d => ({
    date: d.date.slice(5),
    messages: d.message_count,
    sessions: d.session_count,
    tools: d.tool_call_count,
  }))

  const avgPerDay = data.active_days > 0
    ? Math.round(data.total_messages / data.active_days)
    : 0

  return (
    <div>
      <SectionHeader
        title="Stats"
        sub={data.date_range ? `${data.date_range[0]} – ${data.date_range[1]}` : undefined}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="Total Messages" value={fmtNum(data.total_messages)} sub={`${data.active_days} active days`} highlight />
        <StatCard label="Total Sessions" value={fmtNum(data.total_sessions)} />
        <StatCard label="Tool Calls" value={fmtNum(data.total_tool_calls)} sub={`avg ${data.total_sessions > 0 ? Math.round(data.total_tool_calls / data.total_sessions) : 0}/session`} />
        <StatCard label="Avg Msg/Day" value={fmtNum(avgPerDay)} sub="across active days" />
      </div>

      <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: '16px 8px', marginBottom: 24 }}>
        <div style={{ color: c.textFaint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingLeft: 8 }}>Daily Messages</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.borderSoft} />
            <XAxis dataKey="date" tick={{ fill: c.textGhost, fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: c.textGhost, fontSize: 10 }} width={40} />
            <Tooltip
              contentStyle={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, borderRadius: 4 }}
              labelStyle={{ color: c.textMuted }}
              itemStyle={{ color: c.accent }}
            />
            <Bar dataKey="messages" fill={c.accent} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: c.surfaceAlt }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: c.textGhost, fontWeight: 600 }}>Date</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', color: c.textGhost, fontWeight: 600 }}>Messages</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', color: c.textGhost, fontWeight: 600 }}>Sessions</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', color: c.textGhost, fontWeight: 600 }}>Tool Calls</th>
            </tr>
          </thead>
          <tbody>
            {[...data.daily_activity].reverse().map(d => (
              <tr key={d.date} style={{ borderTop: `1px solid ${c.surfaceHover}` }}>
                <td style={{ padding: '8px 16px', color: c.textMuted }}>{d.date}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', color: c.accent, fontWeight: 600 }}>{fmtNum(d.message_count)}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', color: c.text }}>{d.session_count}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', color: c.text }}>{fmtNum(d.tool_call_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
