import type { StatsData } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'
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

      <div style={{ background: '#111', border: '1px solid #333', borderRadius: 6, padding: '16px 8px', marginBottom: 24 }}>
        <div style={{ color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingLeft: 8 }}>Daily Messages</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#555', fontSize: 10 }} width={40} />
            <Tooltip
              contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4 }}
              labelStyle={{ color: '#aaa' }}
              itemStyle={{ color: '#7c6af7' }}
            />
            <Bar dataKey="messages" fill="#7c6af7" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: '#111', border: '1px solid #333', borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1a1a1a' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#555', fontWeight: 600 }}>Date</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', color: '#555', fontWeight: 600 }}>Messages</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', color: '#555', fontWeight: 600 }}>Sessions</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', color: '#555', fontWeight: 600 }}>Tool Calls</th>
            </tr>
          </thead>
          <tbody>
            {[...data.daily_activity].reverse().map(d => (
              <tr key={d.date} style={{ borderTop: '1px solid #1e1e1e' }}>
                <td style={{ padding: '8px 16px', color: '#aaa' }}>{d.date}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', color: '#7c6af7', fontWeight: 600 }}>{fmtNum(d.message_count)}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', color: '#e8e8e8' }}>{d.session_count}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', color: '#e8e8e8' }}>{fmtNum(d.tool_call_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
