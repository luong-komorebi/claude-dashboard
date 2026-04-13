import { useEffect, useMemo, useState } from 'react'
import type { StatsData, UsageEvent } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { StatCard } from '../components/StatCard'
import { c } from '../theme/colors'
import pricingJson from '../cost/pricing.json'
import type { Reports, PricingTable, BlockRow, SessionRow } from '../cost/types'
import {
  Bar, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart,
} from 'recharts'

// ─── WASM lazy-loader ─────────────────────────────────────────────────────────

type WasmModule = typeof import('../wasm-pkg/claude_analytics')
let wasmPromise: Promise<WasmModule> | null = null
const getWasm = () => (wasmPromise ??= import('../wasm-pkg/claude_analytics'))

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtCost = (usd: number) => (usd === 0 ? '$0' : `$${usd.toFixed(usd < 10 ? 2 : 0)}`)
const fmtTokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
const fmtPct = (pct: number) => `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(0)}%`
const shortDate = (iso: string) => iso.slice(5)

// ─── Trends output (mirrors wasm/src/lib.rs TrendMetrics) ─────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  stats: StatsData
  events: UsageEvent[]
  onDrillDown: (target: 'Reports') => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Overview({ stats, events, onDrillDown }: Props) {
  const [reports, setReports] = useState<Reports | null>(null)
  const [trends, setTrends] = useState<TrendMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const pricing = useMemo(() => pricingJson as PricingTable, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    getWasm()
      .then(wasm => {
        const reportsInput = JSON.stringify({
          events, pricing, now_epoch_secs: Math.floor(Date.now() / 1000),
        })
        const reportsRaw = wasm.compute_reports(reportsInput)
        if (reportsRaw.startsWith('error:')) throw new Error(reportsRaw.slice(6))

        const trendsRaw = wasm.compute_trends(JSON.stringify(stats.daily_activity))
        if (trendsRaw.startsWith('error:')) throw new Error(trendsRaw.slice(6))

        setReports(JSON.parse(reportsRaw) as Reports)
        setTrends(JSON.parse(trendsRaw) as TrendMetrics)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [stats, events, pricing])

  if (loading) return <Loading />
  if (error || !reports || !trends) return <ErrorView message={error ?? 'No data'} />

  // ── Derived values

  const activeBlock = reports.blocks.find(b => b.is_active)
  const thisMonthLabel = new Date().toISOString().slice(0, 7)
  const lastMonthLabel = prevMonthLabel(thisMonthLabel)
  const thisMonth = reports.monthly.find(m => m.label === thisMonthLabel)
  const lastMonth = reports.monthly.find(m => m.label === lastMonthLabel)
  const monthCost = thisMonth?.cost_usd ?? 0
  const monthTokens = thisMonth?.total ?? 0
  const monthChangePct = costChange(lastMonth?.cost_usd ?? 0, monthCost)

  // Combined chart data: last 30 days of cost + message count
  const chartData = buildChartData(stats, reports, trends)

  // Model breakdown (by total tokens)
  const modelBreakdown = buildModelBreakdown(events, pricing)

  // Recent sessions (top 5)
  const recentSessions = reports.sessions.slice(0, 5)

  return (
    <div>
      <SectionHeader
        title="Overview"
        sub={`Snapshot of your Claude Code activity · ${stats.date_range ? `${stats.date_range[0]} – ${stats.date_range[1]}` : 'no data yet'}`}
      />

      {/* ── Hero metrics ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard
          label={`Cost · ${thisMonthLabel}`}
          value={fmtCost(monthCost)}
          sub={lastMonth ? `${fmtPct(monthChangePct)} vs last month` : 'no prior month'}
          highlight
          color={monthChangePct > 0 ? c.error : monthChangePct < 0 ? c.success : undefined}
        />
        <StatCard
          label="Tokens · month"
          value={fmtTokens(monthTokens)}
          sub={`${thisMonth?.event_count ?? 0} messages`}
        />
        <StatCard
          label="Current Streak"
          value={`${trends.current_streak} day${trends.current_streak === 1 ? '' : 's'}`}
          sub={`best: ${trends.longest_streak}`}
          color={c.success}
        />
        <BlockCard block={activeBlock ?? null} />
      </div>

      {/* ── Primary chart: cost line + message bars ─────────────────────── */}
      <ChartCard title="Last 30 Days">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.surfaceHover} />
            <XAxis dataKey="date" tick={{ fill: c.textGhost, fontSize: 11 }} tickLine={false} />
            <YAxis
              yAxisId="messages"
              tick={{ fill: c.textGhost, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <YAxis
              yAxisId="cost"
              orientation="right"
              tick={{ fill: c.textGhost, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, borderRadius: 4, fontSize: 12 }}
              labelStyle={{ color: c.textMuted }}
              formatter={(value, name) => {
                if (name === 'Cost' && typeof value === 'number') return [`$${value.toFixed(2)}`, name]
                return [String(value), String(name)]
              }}
            />
            <Bar yAxisId="messages" dataKey="messages" fill={c.accent} radius={[2, 2, 0, 0]} name="Messages" opacity={0.7} />
            <Line yAxisId="cost" type="monotone" dataKey="cost" stroke={c.success} dot={false} strokeWidth={2} name="Cost" />
          </ComposedChart>
        </ResponsiveContainer>
        <Legend items={[
          { color: c.accent, label: 'Messages (left)' },
          { color: c.success, label: 'Cost USD (right)' },
        ]} />
      </ChartCard>

      {/* ── Two-column: Model usage + Recent sessions ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <ModelUsage breakdown={modelBreakdown} />
        <RecentSessions rows={recentSessions} onMore={() => onDrillDown('Reports')} />
      </div>

      {/* ── Drill-down cards ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <DrillCard
          label="Detailed Reports"
          description="Daily, Weekly, Monthly, Sessions, and 5-hour Blocks"
          onClick={() => onDrillDown('Reports')}
        />
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Loading() {
  return (
    <div>
      <SectionHeader title="Overview" sub="Computing your dashboard…" />
      <div style={{ color: c.textGhost, fontSize: 13 }}>Loading WASM analytics…</div>
    </div>
  )
}

function ErrorView({ message }: { message: string }) {
  return (
    <div>
      <SectionHeader title="Overview" sub="Something went wrong" />
      <div style={{ color: c.error, fontSize: 13 }}>{message}</div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6,
      padding: 16, marginBottom: 20,
    }}>
      <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
      {items.map(({ color, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 14, height: 2, background: color }} />
          <span style={{ color: c.textGhost, fontSize: 11 }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

function BlockCard({ block }: { block: BlockRow | null }) {
  if (!block) {
    return (
      <StatCard
        label="5h Block"
        value="—"
        sub="no active block"
      />
    )
  }
  const hours = Math.floor(block.minutes_remaining / 60)
  const mins = block.minutes_remaining % 60
  return (
    <StatCard
      label="Active 5h Block"
      value={`${hours}h ${mins}m left`}
      sub={`${fmtTokens(block.burn_rate_per_min)}/min · proj ${fmtTokens(block.projected_total)}`}
      color={c.success}
    />
  )
}

function ModelUsage({ breakdown }: { breakdown: { model: string; tokens: number; cost: number; pct: number }[] }) {
  if (breakdown.length === 0) {
    return (
      <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: 16 }}>
        <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Model Usage
        </div>
        <div style={{ color: c.textGhost, fontSize: 12 }}>No usage events yet</div>
      </div>
    )
  }
  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: 16 }}>
      <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Model Usage
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {breakdown.map(row => (
          <div key={row.model}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
              <span style={{ color: c.text, fontFamily: 'monospace' }}>{row.model.replace(/^claude-/, '')}</span>
              <span style={{ color: c.textFaint, fontVariantNumeric: 'tabular-nums' }}>
                {fmtTokens(row.tokens)} · {fmtCost(row.cost)}
              </span>
            </div>
            <div style={{ background: c.surfaceHover, borderRadius: 2, height: 6 }}>
              <div style={{ background: c.accent, borderRadius: 2, height: 6, width: `${row.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentSessions({ rows, onMore }: { rows: SessionRow[]; onMore: () => void }) {
  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Recent Sessions
        </div>
        <button
          onClick={onMore}
          style={{
            background: 'transparent', border: 'none', color: c.textFaint,
            fontSize: 11, cursor: 'pointer', padding: 0,
          }}
        >
          View all →
        </button>
      </div>
      {rows.length === 0 ? (
        <div style={{ color: c.textGhost, fontSize: 12 }}>No sessions yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(s => (
            <div key={s.session_id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 12, borderTop: `1px solid ${c.borderSoft}`, paddingTop: 8,
            }}>
              <div>
                <div style={{ color: c.text, fontFamily: 'monospace' }}>{s.session_id.slice(0, 8)}</div>
                <div style={{ color: c.textFaint, fontSize: 10 }}>
                  {s.start.slice(5, 16).replace('T', ' ')} · {s.duration_minutes}m
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: c.accent, fontWeight: 600 }}>{fmtCost(s.cost_usd)}</div>
                <div style={{ color: c.textFaint, fontSize: 10 }}>{fmtTokens(s.total)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DrillCard({ label, description, onClick }: { label: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 200,
        background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6,
        padding: 16, cursor: 'pointer', textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: c.text, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</div>
          <div style={{ color: c.textFaint, fontSize: 11 }}>{description}</div>
        </div>
        <span style={{ color: c.accent, fontSize: 18 }}>→</span>
      </div>
    </button>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function prevMonthLabel(label: string): string {
  // "2026-04" → "2026-03"
  const [y, m] = label.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  d.setUTCMonth(d.getUTCMonth() - 1)
  return d.toISOString().slice(0, 7)
}

function costChange(prev: number, curr: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0
  return ((curr - prev) / prev) * 100
}

function buildChartData(stats: StatsData, reports: Reports, _trends: TrendMetrics) {
  const last30Days = stats.daily_activity.slice(-30)
  const costByDate = new Map(reports.daily.map(d => [d.label, d.cost_usd]))
  return last30Days.map(d => ({
    date: shortDate(d.date),
    messages: d.message_count,
    cost: costByDate.get(d.date) ?? 0,
  }))
}

function buildModelBreakdown(events: UsageEvent[], pricing: PricingTable) {
  const agg = new Map<string, { tokens: number; cost: number }>()
  for (const ev of events) {
    const cur = agg.get(ev.model) ?? { tokens: 0, cost: 0 }
    const total = ev.input_tokens + ev.output_tokens + ev.cache_creation_input_tokens + ev.cache_read_input_tokens
    cur.tokens += total

    const p = pricing[ev.model] ?? pricing[stripDateSuffix(ev.model)]
    if (p) {
      cur.cost +=
        ev.input_tokens * (p.input_cost_per_token ?? 0) +
        ev.output_tokens * (p.output_cost_per_token ?? 0) +
        ev.cache_creation_input_tokens * (p.cache_creation_input_token_cost ?? 0) +
        ev.cache_read_input_tokens * (p.cache_read_input_token_cost ?? 0)
    }
    agg.set(ev.model, cur)
  }
  const total = [...agg.values()].reduce((s, v) => s + v.tokens, 0)
  return [...agg.entries()]
    .map(([model, v]) => ({ model, tokens: v.tokens, cost: v.cost, pct: total > 0 ? (v.tokens / total) * 100 : 0 }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5)
}

function stripDateSuffix(model: string): string {
  const idx = model.lastIndexOf('-')
  if (idx === -1) return model
  const suffix = model.slice(idx + 1)
  if (suffix.length === 8 && /^\d+$/.test(suffix)) return model.slice(0, idx)
  return model
}

