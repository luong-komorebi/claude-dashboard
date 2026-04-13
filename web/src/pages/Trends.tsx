import { useEffect, useState } from 'react'
import type { StatsData } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { StatCard } from '../components/StatCard'
import { c } from '../theme/colors'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

// ─── WASM lazy-loader ─────────────────────────────────────────────────────────
// We load the WASM module once and cache the promise.

type WasmModule = typeof import('../wasm-pkg/claude_analytics')
let wasmPromise: Promise<WasmModule> | null = null

function getWasm(): Promise<WasmModule> {
  if (!wasmPromise) {
    wasmPromise = import('../wasm-pkg/claude_analytics')
  }
  return wasmPromise
}

// ─── Types mirroring Rust output ─────────────────────────────────────────────

interface TrendMetrics {
  moving_avg_7d: (number | null)[]
  moving_avg_30d: (number | null)[]
  current_streak: number
  longest_streak: number
  best_day: { date: string; message_count: number } | null
  trend_7d: 'up' | 'down' | 'stable'
  weekly_totals: { week_start: string; messages: number; sessions: number; tool_calls: number }[]
  pct_change_7d: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const trendColor = { up: c.success, down: c.error, stable: c.accent } as const
const trendArrow = { up: '↑', down: '↓', stable: '→' } as const

function shortDate(iso: string) {
  return iso.slice(5) // "MM-DD"
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Trends({ data }: { data: StatsData }) {
  const [metrics, setMetrics] = useState<TrendMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getWasm()
      .then(wasm => {
        const raw = wasm.compute_trends(JSON.stringify(data.daily_activity))
        if (raw.startsWith('error:')) throw new Error(raw.slice(6))
        setMetrics(JSON.parse(raw) as TrendMetrics)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [data])

  if (loading) {
    return (
      <div>
        <SectionHeader title="Trends" sub="WASM-powered analytics on daily activity" />
        <div style={{ color: c.textGhost, fontSize: 13 }}>Loading WASM analytics…</div>
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div>
        <SectionHeader title="Trends" sub="WASM-powered analytics on daily activity" />
        <div style={{ color: c.error, fontSize: 13 }}>{error ?? 'No data'}</div>
      </div>
    )
  }

  // Build chart data — zip daily_activity with moving averages
  const chartData = data.daily_activity.map((d, i) => ({
    date: shortDate(d.date),
    messages: d.message_count,
    avg7: metrics.moving_avg_7d[i] ?? undefined,
    avg30: metrics.moving_avg_30d[i] ?? undefined,
  }))

  return (
    <div>
      <SectionHeader title="Trends" sub="WASM-powered analytics on daily activity" />

      {/* Stat cards row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard
          label="Current Streak"
          value={metrics.current_streak}
          sub={`${metrics.longest_streak} day record`}
          highlight
        />
        <StatCard
          label="7-day Trend"
          value={`${trendArrow[metrics.trend_7d]} ${Math.abs(metrics.pct_change_7d)}%`}
          sub="vs previous 7 days"
          color={trendColor[metrics.trend_7d]}
        />
        {metrics.best_day && (
          <StatCard
            label="Best Day"
            value={metrics.best_day.message_count}
            sub={shortDate(metrics.best_day.date)}
          />
        )}
        <StatCard
          label="Active Days"
          value={data.active_days}
          sub={`of ${data.daily_activity.length} total`}
        />
      </div>

      {/* Moving-average line chart */}
      {chartData.length > 0 && (
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: 16, marginBottom: 16 }}>
          <div style={{ color: c.accent, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            Daily Messages + Moving Averages
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.surfaceHover} />
              <XAxis dataKey="date" tick={{ fill: c.textGhost, fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: c.textGhost, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip
                contentStyle={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, borderRadius: 4, fontSize: 12 }}
                labelStyle={{ color: c.textMuted }}
              />
              <Line type="monotone" dataKey="messages" stroke={c.border} dot={false} strokeWidth={1} name="Messages" />
              <Line type="monotone" dataKey="avg7" stroke={c.accent} dot={false} strokeWidth={2} name="7-day avg" connectNulls />
              <Line type="monotone" dataKey="avg30" stroke={c.success} dot={false} strokeWidth={2} name="30-day avg" connectNulls strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            {[
              { color: c.border, label: 'Daily' },
              { color: c.accent, label: '7-day avg' },
              { color: c.success, label: '30-day avg' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 16, height: 2, background: color }} />
                <span style={{ color: c.textGhost, fontSize: 11 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly bar chart */}
      {metrics.weekly_totals.length > 0 && (
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: 16 }}>
          <div style={{ color: c.success, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            Weekly Message Volume
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={metrics.weekly_totals} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.surfaceHover} vertical={false} />
              <XAxis dataKey="week_start" tickFormatter={shortDate} tick={{ fill: c.textGhost, fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: c.textGhost, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip
                contentStyle={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, borderRadius: 4, fontSize: 12 }}
                labelStyle={{ color: c.textMuted }}
                labelFormatter={(label) => typeof label === 'string' ? shortDate(label) : label}
              />
              <Bar dataKey="messages" fill={c.accent} radius={[2, 2, 0, 0]} name="Messages" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.daily_activity.length === 0 && (
        <div style={{ color: c.textGhost, fontSize: 13 }}>No daily activity data found in stats-cache.json.</div>
      )}
    </div>
  )
}
