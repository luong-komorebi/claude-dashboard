import { useEffect, useMemo, useState } from 'react'
import type { StatsData, UsageEvent, AccountInfo, ChangelogEntry, LiveSession } from '../api'
import { LiveUsageCard } from './LiveUsageCard'
import { SectionHeader } from '../components/SectionHeader'
import { StatCard } from '../components/StatCard'
import { c } from '../theme/colors'
import pricingJson from '../cost/pricing.json'
import type { Reports, PricingTable, BlockRow, SessionRow, Insight, ForecastOutput } from '../cost/types'
import { getBudget, projectMonth } from '../cost/budget'
import {
  Area, Bar, BarChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart,
} from 'recharts'

// ─── WASM lazy-loader ─────────────────────────────────────────────────────────

type WasmModule = typeof import('../wasm-pkg/claude_analytics')
let wasmPromise: Promise<WasmModule> | null = null
const getWasm = () => (wasmPromise ??= import('../wasm-pkg/claude_analytics'))

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtCost = (usd: number) => (usd === 0 ? '$0' : `$${usd.toFixed(usd < 10 ? 2 : 0)}`)
const fmtCostPrecise = (usd: number) =>
  usd === 0 ? '$0' : usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`
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
  /** Map from Claude Code's encoded project id → real filesystem path. */
  projectPaths: Record<string, string>
  /** Parsed from ~/.claude.json if available, null if not loaded yet. */
  account: AccountInfo | null
  changelog: ChangelogEntry[]
  liveSessions: LiveSession[]
  /** Bumped whenever online-mode settings change — triggers LiveUsageCard refetch. */
  onlineRefetchKey: number
  onDrillDown: (target: 'Analytics' | 'Projects' | 'Activity' | 'Config', sub?: string) => void
  /** Callback to trigger the file picker for the account JSON. */
  onPickAccountFile: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

// ─── Time window ──────────────────────────────────────────────────────────────

const WINDOWS = ['7d', '30d', '90d', 'all'] as const
type Window = typeof WINDOWS[number]

function windowDays(w: Window): number | null {
  switch (w) {
    case '7d':  return 7
    case '30d': return 30
    case '90d': return 90
    case 'all': return null
  }
}

function filterByWindow<T extends { timestamp: string } | { date: string }>(
  items: T[],
  w: Window,
): T[] {
  const days = windowDays(w)
  if (days === null) return items
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - days + 1)
  const cutoffIso = cutoff.toISOString().slice(0, 10)
  return items.filter(item => {
    const iso = 'timestamp' in item ? item.timestamp.slice(0, 10) : item.date
    return iso >= cutoffIso
  })
}

export function Overview({ stats, events, projectPaths, account, changelog, liveSessions, onlineRefetchKey, onDrillDown, onPickAccountFile }: Props) {
  const [window, setWindow] = useState<Window>('all')
  const [reports, setReports] = useState<Reports | null>(null)
  const [trends, setTrends] = useState<TrendMetrics | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [forecast, setForecast] = useState<ForecastOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const pricing = useMemo(() => pricingJson as PricingTable, [])

  // Filtered inputs for all downstream computations
  const windowedEvents = useMemo(() => filterByWindow(events, window), [events, window])
  const windowedDaily = useMemo(
    () => filterByWindow(stats.daily_activity, window),
    [stats.daily_activity, window],
  )
  const windowedStats: StatsData = useMemo(() => ({
    ...stats,
    daily_activity: windowedDaily,
    total_messages: windowedDaily.reduce((s, d) => s + d.message_count, 0),
    total_sessions: windowedDaily.reduce((s, d) => s + d.session_count, 0),
    total_tool_calls: windowedDaily.reduce((s, d) => s + d.tool_call_count, 0),
    active_days: windowedDaily.filter(d => d.message_count > 0).length,
    date_range: windowedDaily.length > 0
      ? [windowedDaily[0].date, windowedDaily[windowedDaily.length - 1].date]
      : null,
  }), [stats, windowedDaily])

  useEffect(() => {
    setLoading(true)
    setError(null)
    getWasm()
      .then(wasm => {
        // Reports — windowed aggregation
        const reportsRaw = wasm.compute_reports(JSON.stringify({
          events: windowedEvents, pricing, now_epoch_secs: Math.floor(Date.now() / 1000),
        }))
        if (reportsRaw.startsWith('error:')) throw new Error(reportsRaw.slice(6))

        // Trends — streak + moving averages over the windowed series
        const trendsRaw = wasm.compute_trends(JSON.stringify(windowedDaily))
        if (trendsRaw.startsWith('error:')) throw new Error(trendsRaw.slice(6))

        // Insights — rule-based observations on windowed events
        const insightsRaw = wasm.compute_insights(JSON.stringify({ events: windowedEvents, pricing }))
        if (insightsRaw.startsWith('error:')) throw new Error(insightsRaw.slice(6))

        // Forecast — always uses the full series since Holt-Winters needs >= 2 seasons
        // of history to be meaningful; window only affects what we display.
        const forecastRaw = wasm.compute_forecast(JSON.stringify({
          daily: stats.daily_activity.map(d => d.message_count),
          horizon: 14,
          season_length: 7,
        }))
        if (forecastRaw.startsWith('error:')) throw new Error(forecastRaw.slice(6))

        setReports(JSON.parse(reportsRaw) as Reports)
        setTrends(JSON.parse(trendsRaw) as TrendMetrics)
        setInsights(JSON.parse(insightsRaw) as Insight[])
        setForecast(JSON.parse(forecastRaw) as ForecastOutput)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [stats, windowedEvents, windowedDaily, pricing])

  if (loading) return <Loading />
  if (error || !reports || !trends) return <ErrorView message={error ?? 'No data'} />

  // ── Derived values ────────────────────────────────────────────────────────

  const activeBlock = reports.blocks.find(b => b.is_active)
  const thisMonthLabel = new Date().toISOString().slice(0, 7)
  const lastMonthLabel = prevMonthLabel(thisMonthLabel)
  const thisMonth = reports.monthly.find(m => m.label === thisMonthLabel)
  const lastMonth = reports.monthly.find(m => m.label === lastMonthLabel)
  const monthCost = thisMonth?.cost_usd ?? 0
  const monthTokens = thisMonth?.total ?? 0
  const monthChangePct = costChange(lastMonth?.cost_usd ?? 0, monthCost)

  // Budget math (optional)
  const budget = getBudget()
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = now.getDate()
  const projectedMonth = projectMonth(monthCost, daysElapsed, daysInMonth)
  const budgetOver = budget ? projectedMonth > budget.amount : false

  // Charts + breakdowns — all use the windowed inputs so the period toggle
  // cascades through every visualization on the page.
  const chartData = buildChartData(windowedStats, reports)
  const modelBreakdown = buildModelBreakdown(windowedEvents, pricing)
  const projectBreakdown = buildProjectBreakdown(windowedEvents, pricing, projectPaths)
  const hourActivity = buildHourActivity(windowedEvents)
  const recentSessions = reports.sessions.slice(0, 5)

  // Top 3 insights (alert + warning first)
  const topInsights = insights.slice(0, 3)

  return (
    <div>
      <SectionHeader
        title="Overview"
        sub={`Snapshot of your Claude Code activity${windowedStats.date_range ? ` · ${windowedStats.date_range[0]} – ${windowedStats.date_range[1]}` : ''}`}
      />

      {/* ── Time period toggle ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {WINDOWS.map(w => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            style={{
              background: window === w ? c.surfaceHover : c.surface,
              border: `1px solid ${window === w ? c.accent : c.border}`,
              color: window === w ? c.text : c.textFaint,
              borderRadius: 4,
              padding: '5px 14px',
              fontSize: 11,
              cursor: 'pointer',
              fontWeight: window === w ? 600 : 400,
              fontFamily: 'inherit',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {w === 'all' ? 'All time' : `Last ${w}`}
          </button>
        ))}
      </div>

      {/* ── Hero metrics ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatCard
          label={`Cost · ${thisMonthLabel}`}
          value={fmtCost(monthCost)}
          sub={lastMonth ? `${fmtPct(monthChangePct)} · API-equivalent` : 'API-equivalent'}
          highlight
          color={monthChangePct > 0 ? c.error : monthChangePct < 0 ? c.success : undefined}
        />
        <StatCard
          label="Tokens · month"
          value={fmtTokens(monthTokens)}
          sub={`${thisMonth?.event_count ?? 0} messages`}
        />
        {budget ? (
          <BudgetCard budget={budget.amount} mtd={monthCost} projected={projectedMonth} over={budgetOver} />
        ) : (
          <StatCard
            label="Current Streak"
            value={`${trends.current_streak} day${trends.current_streak === 1 ? '' : 's'}`}
            sub={`best: ${trends.longest_streak}`}
            color={c.success}
          />
        )}
        <BlockCard block={activeBlock ?? null} />
      </div>

      {/* ── Insights banner ─────────────────────────────────────────────── */}
      {topInsights.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${topInsights.length}, 1fr)`,
          gap: 10,
          marginBottom: 20,
        }}>
          {topInsights.map((ins, i) => (
            <InsightCard key={i} insight={ins} onClick={() => onDrillDown('Analytics')} />
          ))}
        </div>
      )}

      {/* ── Account card ────────────────────────────────────────────────── */}
      <AccountCard
        account={account}
        events={windowedEvents}
        projectPaths={projectPaths}
        onPickAccountFile={onPickAccountFile}
        onDrillDown={() => onDrillDown('Config', 'Account')}
      />

      {/* ── Live org usage (only when online mode is enabled) ──────────── */}
      <LiveUsageCard
        refetchKey={onlineRefetchKey}
        onOpenSettings={() => onDrillDown('Config', 'Settings')}
      />

      {/* ── Live sessions + What's new (conditional) ──────────────────────── */}
      {(liveSessions.length > 0 || changelog.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <LiveSessionsCard sessions={liveSessions} />
          <WhatsNewCard entries={changelog} />
        </div>
      )}

      {/* ── Primary chart ────────────────────────────────────────────────── */}
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

      {/* ── Forecast preview + Mini heatmap ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ForecastPreview
          stats={stats}
          forecast={forecast}
          onMore={() => onDrillDown('Analytics', 'Forecast')}
        />
        <MiniHeatmap events={events} onMore={() => onDrillDown('Analytics', 'Heatmap')} />
      </div>

      {/* ── Spend breakdowns ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ModelUsage breakdown={modelBreakdown} />
        <TopProjects rows={projectBreakdown} onMore={() => onDrillDown('Projects')} />
      </div>

      {/* ── Activity details ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <RecentSessions rows={recentSessions} onMore={() => onDrillDown('Activity', 'Sessions')} />
        <HourActivity buckets={hourActivity} />
      </div>

      {/* ── Drill-down cards — deep-link into specific sub-views ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <DrillCard
          label="🔮 Forecast"
          description="Holt-Winters forecast + anomaly detection with budget tracker"
          onClick={() => onDrillDown('Analytics', 'Forecast')}
        />
        <DrillCard
          label="📊 Detailed Reports"
          description="Daily / Weekly / Monthly / Sessions / 5-hour Blocks"
          onClick={() => onDrillDown('Analytics', 'Reports')}
        />
        <DrillCard
          label="📅 Heatmap"
          description="Year-calendar activity with cost/tokens/messages toggle"
          onClick={() => onDrillDown('Analytics', 'Heatmap')}
        />
        <DrillCard
          label="🧪 What-If"
          description="Simulate cost under different model mixes"
          onClick={() => onDrillDown('Analytics', 'What-If')}
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
      padding: 16, marginBottom: 16,
    }}>
      <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function SectionCard({ title, onMore, moreLabel = 'View all →', children }: {
  title: string
  onMore?: () => void
  moreLabel?: string
  children: React.ReactNode
}) {
  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {title}
        </div>
        {onMore && (
          <button
            onClick={onMore}
            style={{
              background: 'transparent', border: 'none', color: c.textFaint,
              fontSize: 11, cursor: 'pointer', padding: 0,
            }}
          >
            {moreLabel}
          </button>
        )}
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
    return <StatCard label="5h Block" value="—" sub="no active block" />
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

function BudgetCard({ budget, mtd, projected, over }: {
  budget: number; mtd: number; projected: number; over: boolean
}) {
  const pct = Math.min((mtd / budget) * 100, 100)
  return (
    <div style={{
      border: `1px solid ${over ? c.error : c.accent}`,
      borderRadius: 6,
      padding: '12px 16px',
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ color: c.textFaint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
        Budget MTD
      </div>
      <div style={{ color: over ? c.error : c.text, fontSize: 18, fontWeight: 700, margin: '4px 0 2px' }}>
        {fmtCost(mtd)} <span style={{ color: c.textFaint, fontSize: 12, fontWeight: 400 }}>/ {fmtCost(budget)}</span>
      </div>
      <div style={{ background: c.surfaceHover, borderRadius: 2, height: 4, marginBottom: 4 }}>
        <div style={{ background: over ? c.error : c.success, height: 4, borderRadius: 2, width: `${pct}%` }} />
      </div>
      <div style={{ color: c.textGhost, fontSize: 10 }}>
        projected: {fmtCost(projected)}
      </div>
    </div>
  )
}

/**
 * Compact account analytics card for the Overview page. Shows account UUID,
 * numStartups, and a reconciliation of Claude Code's own `lastCost` vs our
 * LiteLLM-derived computation — or a "pick .claude.json" CTA when no file
 * has been loaded yet.
 */
function AccountCard({
  account, events, projectPaths, onPickAccountFile, onDrillDown,
}: {
  account: AccountInfo | null
  events: UsageEvent[]
  projectPaths: Record<string, string>
  onPickAccountFile: () => void
  onDrillDown: () => void
}) {
  // ── Empty state: CTA to pick the file
  if (!account) {
    return (
      <div style={{
        background: c.surface, border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${c.warning}`,
        borderRadius: 6, padding: '14px 18px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: c.text, fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
            Unlock account analytics
          </div>
          <div style={{ color: c.textFaint, fontSize: 12, lineHeight: 1.5 }}>
            Pick <code style={{
              background: c.surfaceHover, padding: '1px 6px', borderRadius: 3,
              fontSize: 11, fontFamily: 'monospace',
            }}>~/.claude.json</code> to see Claude Code's own per-project cost tracking,
            org/account UUIDs, lifetime CLI startups, and MCP server list.
            Tokens + credentials are stripped in-worker before reaching the UI.
          </div>
        </div>
        <button
          onClick={onPickAccountFile}
          style={{
            background: c.accent, color: c.accentFg, border: 'none',
            borderRadius: 4, padding: '8px 16px', fontSize: 12,
            fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Pick .claude.json
        </button>
      </div>
    )
  }

  // ── Loaded state: compact stats + top 3 cost reconciliation
  const paths = projectPaths ?? {}
  const computedByPath = new Map<string, number>()
  for (const ev of events) {
    const path = paths[ev.project_id] ?? ev.project_id
    const p = pricingJson[ev.model as keyof typeof pricingJson] as
      | Record<string, number> | undefined
    if (!p) continue
    const cost =
      ev.input_tokens * (p.input_cost_per_token ?? 0) +
      ev.output_tokens * (p.output_cost_per_token ?? 0) +
      ev.cache_creation_input_tokens * (p.cache_creation_input_token_cost ?? 0) +
      ev.cache_read_input_tokens * (p.cache_read_input_token_cost ?? 0)
    computedByPath.set(path, (computedByPath.get(path) ?? 0) + cost)
  }

  const topCosts = account.projectCosts.slice(0, 3)
  const totalClaudeCode = account.projectCosts.reduce((s, p) => s + p.lastCost, 0)

  return (
    <div style={{
      background: c.surface, border: `1px solid ${c.border}`,
      borderRadius: 6, padding: 16, marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Account Analytics
        </div>
        <button
          onClick={onDrillDown}
          style={{
            background: 'transparent', border: 'none', color: c.textFaint,
            fontSize: 11, cursor: 'pointer', padding: 0,
          }}
        >
          Full details →
        </button>
      </div>

      {/* Stat row */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 14, flexWrap: 'wrap', fontSize: 12 }}>
        <div>
          <div style={{ color: c.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Lifetime startups</div>
          <div style={{ color: c.text, fontWeight: 600, fontSize: 14 }}>{account.numStartups.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ color: c.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Install</div>
          <div style={{ color: c.text, fontWeight: 600, fontSize: 14 }}>{account.installMethod ?? '—'}</div>
        </div>
        <div>
          <div style={{ color: c.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>MCP servers</div>
          <div style={{ color: c.text, fontWeight: 600, fontSize: 14 }}>
            {account.mcpServers.length}
            {account.mcpServers.length > 0 && (
              <span style={{ color: c.textFaint, fontWeight: 400, fontSize: 11, marginLeft: 6 }}>
                ({account.mcpServers.slice(0, 2).join(', ')}{account.mcpServers.length > 2 && '…'})
              </span>
            )}
          </div>
        </div>
        <div>
          <div style={{ color: c.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Claude Code's $</div>
          <div style={{ color: c.success, fontWeight: 600, fontSize: 14 }}>{fmtCost(totalClaudeCode)}</div>
        </div>
      </div>

      {/* Top cost reconciliation */}
      {topCosts.length > 0 && (
        <div>
          <div style={{ color: c.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Top 3 projects · Claude Code vs computed
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {topCosts.map(row => {
              const computed = computedByPath.get(row.path) ?? 0
              const delta = computed - row.lastCost
              const deltaPct = row.lastCost > 0 ? (delta / row.lastCost) * 100 : 0
              const deltaColor =
                Math.abs(deltaPct) < 10 ? c.success :
                Math.abs(deltaPct) < 30 ? c.warning : c.error
              return (
                <div key={row.path} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 11, padding: '4px 0',
                  borderTop: `1px solid ${c.borderSoft}`,
                }}>
                  <span style={{
                    flex: 1, color: c.textMuted, fontFamily: 'monospace',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={row.path}>
                    {row.path.split('/').slice(-2).join('/')}
                  </span>
                  <span style={{ color: c.text, fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right' }}>
                    {fmtCost(row.lastCost)}
                  </span>
                  <span style={{ color: c.textFaint, fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right' }}>
                    {fmtCost(computed)}
                  </span>
                  <span style={{
                    color: deltaColor, fontVariantNumeric: 'tabular-nums',
                    minWidth: 50, textAlign: 'right', fontWeight: 600,
                  }}>
                    {row.lastCost === 0 ? '—' : `${delta >= 0 ? '+' : ''}${deltaPct.toFixed(0)}%`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function LiveSessionsCard({ sessions }: { sessions: LiveSession[] }) {
  if (sessions.length === 0) {
    return (
      <SectionCard title="Live Claude Sessions">
        <div style={{ color: c.textGhost, fontSize: 12 }}>
          No active sessions
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard title={`Live Claude Sessions (${sessions.length})`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sessions.slice(0, 4).map(s => {
          const minutes = s.startedAt > 0 ? Math.floor((Date.now() - s.startedAt) / 60000) : 0
          const folder = s.cwd ? s.cwd.split('/').filter(Boolean).slice(-2).join('/') : '(no cwd)'
          return (
            <div key={s.pid} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 12, borderTop: `1px solid ${c.borderSoft}`, paddingTop: 8,
            }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: c.success, flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: c.text, fontFamily: 'monospace',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={s.cwd}>
                  {folder}
                </div>
                <div style={{ color: c.textFaint, fontSize: 10 }}>
                  {s.entrypoint} · pid {s.pid}
                  {minutes > 0 && <> · running {minutes}m</>}
                </div>
              </div>
            </div>
          )
        })}
        {sessions.length > 4 && (
          <div style={{ color: c.textFaint, fontSize: 10, paddingTop: 4 }}>
            + {sessions.length - 4} more
          </div>
        )}
      </div>
    </SectionCard>
  )
}

function WhatsNewCard({ entries }: { entries: ChangelogEntry[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(entries.slice(0, 1).map(e => e.version)))

  if (entries.length === 0) {
    return (
      <SectionCard title="What's New in Claude Code">
        <div style={{ color: c.textGhost, fontSize: 12 }}>
          No changelog available
        </div>
      </SectionCard>
    )
  }

  const toggle = (v: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(v)) next.delete(v); else next.add(v)
    return next
  })

  return (
    <SectionCard title="What's New in Claude Code">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
        {entries.slice(0, 5).map(e => {
          const isOpen = expanded.has(e.version)
          return (
            <div key={e.version}>
              <button
                onClick={() => toggle(e.version)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'transparent', border: 'none', padding: '2px 0',
                  color: c.accent, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left',
                }}
              >
                <span style={{ color: c.textFaint, fontSize: 9 }}>{isOpen ? '▼' : '▶'}</span>
                v{e.version}
                <span style={{ color: c.textFaint, fontWeight: 400, fontSize: 10 }}>
                  · {e.items.length} change{e.items.length === 1 ? '' : 's'}
                </span>
              </button>
              {isOpen && (
                <ul style={{
                  margin: '2px 0 6px 14px', padding: 0, listStyle: 'none',
                  display: 'flex', flexDirection: 'column', gap: 3,
                }}>
                  {e.items.slice(0, 6).map((item, i) => (
                    <li key={i} style={{
                      color: c.textMuted, fontSize: 11, lineHeight: 1.4,
                      paddingLeft: 10, position: 'relative',
                    }}>
                      <span style={{
                        position: 'absolute', left: 0, top: 6,
                        width: 3, height: 3, borderRadius: '50%', background: c.textFaint,
                      }} />
                      {item.length > 120 ? item.slice(0, 117) + '…' : item}
                    </li>
                  ))}
                  {e.items.length > 6 && (
                    <li style={{ color: c.textFaint, fontSize: 10, paddingLeft: 10 }}>
                      + {e.items.length - 6} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

function InsightCard({ insight, onClick }: { insight: Insight; onClick: () => void }) {
  const color =
    insight.severity === 'alert' ? c.error :
    insight.severity === 'warning' ? c.warning :
    c.accent
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
      title="Click to open Insights tab"
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{insight.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: c.text, fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
          {insight.title}
        </div>
        <div style={{
          color: c.textFaint,
          fontSize: 11,
          lineHeight: 1.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {insight.description}
        </div>
      </div>
    </button>
  )
}

function ModelUsage({ breakdown }: {
  breakdown: { model: string; tokens: number; cost: number; pct: number }[]
}) {
  return (
    <SectionCard title="Model Usage">
      {breakdown.length === 0 ? (
        <div style={{ color: c.textGhost, fontSize: 12 }}>No usage events yet</div>
      ) : (
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
      )}
    </SectionCard>
  )
}

function TopProjects({ rows, onMore }: {
  rows: { label: string; fullPath: string; cost: number; events: number; pct: number }[]
  onMore: () => void
}) {
  return (
    <SectionCard title="Top Projects by Cost" onMore={onMore}>
      {rows.length === 0 ? (
        <div style={{ color: c.textGhost, fontSize: 12 }}>No usage events yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(row => (
            <div key={row.fullPath} title={row.fullPath}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                <span style={{
                  color: c.text,
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '60%',
                }}>
                  {row.label}
                </span>
                <span style={{ color: c.textFaint, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCostPrecise(row.cost)} · {row.events} msgs
                </span>
              </div>
              <div style={{ background: c.surfaceHover, borderRadius: 2, height: 6 }}>
                <div style={{ background: c.success, borderRadius: 2, height: 6, width: `${row.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

function RecentSessions({ rows, onMore }: { rows: SessionRow[]; onMore: () => void }) {
  return (
    <SectionCard title="Recent Sessions" onMore={onMore}>
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
    </SectionCard>
  )
}

function HourActivity({ buckets }: { buckets: { hour: number; events: number }[] }) {
  const peak = buckets.reduce((p, b) => (b.events > p.events ? b : p), buckets[0])
  const total = buckets.reduce((s, b) => s + b.events, 0)

  return (
    <SectionCard title="Activity by Hour (local)">
      {total === 0 ? (
        <div style={{ color: c.textGhost, fontSize: 12 }}>No usage events yet</div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 8 }}>
            Peak hour: <strong style={{ color: c.text }}>{peak.hour.toString().padStart(2, '0')}:00</strong>
            {' · '}
            {total} events total
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={buckets} margin={{ top: 4, right: 4, bottom: 4, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.surfaceHover} vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fill: c.textGhost, fontSize: 10 }}
                tickLine={false}
                interval={3}
                tickFormatter={(h: number) => `${h}`}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, borderRadius: 4, fontSize: 12 }}
                labelStyle={{ color: c.textMuted }}
                labelFormatter={(h) => `${typeof h === 'number' ? h.toString().padStart(2, '0') : h}:00`}
                formatter={(v: unknown) => [String(v), 'events']}
              />
              <Bar dataKey="events" fill={c.accent} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </SectionCard>
  )
}

function ForecastPreview({
  stats, forecast, onMore,
}: { stats: StatsData; forecast: ForecastOutput | null; onMore: () => void }) {
  if (!forecast || forecast.forecast.length === 0) {
    return (
      <SectionCard title="14-day Forecast" onMore={onMore} moreLabel="Details →">
        <div style={{ color: c.textGhost, fontSize: 12, padding: '8px 0' }}>
          Not enough data — need at least 2 weeks of activity for a reliable forecast.
        </div>
      </SectionCard>
    )
  }

  // Last 14 actuals + 14 forecast days, with CI band stacked as (lower + range)
  const lastN = 14
  const actuals = stats.daily_activity.slice(-lastN)
  type Pt = { date: string; actual?: number; forecast?: number; lower?: number; range?: number }
  const points: Pt[] = actuals.map(d => ({ date: shortDate(d.date), actual: d.message_count }))

  if (actuals.length > 0) {
    const lastDate = actuals[actuals.length - 1].date
    for (let h = 0; h < forecast.forecast.length; h++) {
      const p = forecast.forecast[h]
      points.push({
        date: shortDate(addDays(lastDate, h + 1)),
        forecast: p.value,
        lower: p.lower,
        range: Math.max(0, p.upper - p.lower),
      })
    }
  }

  // Summary: total forecast messages over the 14-day window
  const forecastTotal = forecast.forecast.reduce((s, p) => s + p.value, 0)
  const anomalyCount = forecast.anomalies.length

  return (
    <SectionCard title="14-day Forecast" onMore={onMore} moreLabel="Details →">
      <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 8 }}>
        Next 14 days: <strong style={{ color: c.text }}>{fmtTokens(forecastTotal)}</strong> messages projected
        {anomalyCount > 0 && <> · {anomalyCount} anomal{anomalyCount === 1 ? 'y' : 'ies'} flagged</>}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart data={points} margin={{ top: 4, right: 8, bottom: 4, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.surfaceHover} />
          <XAxis dataKey="date" tick={{ fill: c.textGhost, fontSize: 9 }} tickLine={false} interval={3} />
          <YAxis tick={{ fill: c.textGhost, fontSize: 9 }} tickLine={false} axisLine={false} width={30} />
          <Tooltip
            contentStyle={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, borderRadius: 4, fontSize: 11 }}
            labelStyle={{ color: c.textMuted }}
          />
          {/* Stacked area trick — transparent `lower` + colored `range` = CI band */}
          <Area type="monotone" dataKey="lower" stackId="ci" stroke="transparent" fill="transparent" legendType="none" name="" />
          <Area type="monotone" dataKey="range" stackId="ci" stroke="transparent" fill={c.accent} fillOpacity={0.12} name="80% CI" />
          <Line type="monotone" dataKey="actual" stroke={c.text} dot={false} strokeWidth={1.5} name="Actual" connectNulls={false} />
          <Line type="monotone" dataKey="forecast" stroke={c.accent} dot={false} strokeWidth={2} name="Forecast" connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </SectionCard>
  )
}

/**
 * Compact 12-week heatmap (84 days). Mirrors the full-year Heatmap but
 * scaled down for the Overview. Click "Details →" to jump to the full view
 * in Analytics → Heatmap.
 */
function MiniHeatmap({ events, onMore }: { events: UsageEvent[]; onMore: () => void }) {
  const WEEKS = 12
  const cells = useMemo(() => buildMiniHeatmapCells(events, WEEKS), [events])
  const max = useMemo(() => Math.max(1, ...cells.map(c => c.events)), [cells])

  const active = cells.filter(c => c.events > 0).length
  const total = cells.reduce((s, c) => s + c.events, 0)

  if (total === 0) {
    return (
      <SectionCard title={`Last ${WEEKS} Weeks`} onMore={onMore} moreLabel="Full year →">
        <div style={{ color: c.textGhost, fontSize: 12, padding: '8px 0' }}>No events yet</div>
      </SectionCard>
    )
  }

  const cellSize = 12
  const gap = 3
  const step = cellSize + gap
  const width = WEEKS * step + 20
  const height = 7 * step + 4

  return (
    <SectionCard title={`Last ${WEEKS} Weeks`} onMore={onMore} moreLabel="Full year →">
      <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 10 }}>
        {active} active of {WEEKS * 7} days · {total} events
      </div>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {cells.map((cell, i) => {
          const col = Math.floor(i / 7)
          const row = i % 7
          const intensity = max > 0 ? cell.events / max : 0
          const opacity = cell.events === 0 ? 0 : 0.2 + intensity * 0.8
          return (
            <rect
              key={i}
              x={col * step}
              y={row * step}
              width={cellSize}
              height={cellSize}
              rx={2}
              ry={2}
              fill={cell.events === 0 ? c.surfaceHover : `rgba(88, 166, 255, ${opacity})`}
              stroke={c.borderSoft}
              strokeWidth={0.5}
            >
              <title>{cell.date}: {cell.events} events</title>
            </rect>
          )
        })}
      </svg>
    </SectionCard>
  )
}

function buildMiniHeatmapCells(events: UsageEvent[], weeks: number) {
  const days = weeks * 7
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Align the right edge to today; days go oldest → newest, column by column.
  // Each "column" is a week (Sun..Sat or similar — we just bucket by index).
  const cells: { date: string; events: number }[] = []
  const start = new Date(today)
  start.setDate(start.getDate() - (days - 1))

  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    cells.push({ date: iso, events: 0 })
  }

  const idxByDate = new Map(cells.map((c, i) => [c.date, i]))
  for (const ev of events) {
    const iso = ev.timestamp.slice(0, 10)
    const idx = idxByDate.get(iso)
    if (idx !== undefined) cells[idx].events += 1
  }

  return cells
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
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
  const [y, m] = label.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  d.setUTCMonth(d.getUTCMonth() - 1)
  return d.toISOString().slice(0, 7)
}

function costChange(prev: number, curr: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0
  return ((curr - prev) / prev) * 100
}

interface ChartPoint { date: string; messages: number; cost: number }

function buildChartData(stats: StatsData, reports: Reports): ChartPoint[] {
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
    cur.tokens += ev.input_tokens + ev.output_tokens + ev.cache_creation_input_tokens + ev.cache_read_input_tokens
    cur.cost += computeEventCost(ev, pricing)
    agg.set(ev.model, cur)
  }
  const total = [...agg.values()].reduce((s, v) => s + v.tokens, 0)
  return [...agg.entries()]
    .map(([model, v]) => ({ model, tokens: v.tokens, cost: v.cost, pct: total > 0 ? (v.tokens / total) * 100 : 0 }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5)
}

function buildProjectBreakdown(
  events: UsageEvent[],
  pricing: PricingTable,
  projectPaths: Record<string, string> | undefined,
) {
  // Defensive: old OPFS snapshots may deserialize with projectPaths = undefined.
  // The migration in opfs.ts fills this in, but guard here too so a rogue
  // cache version can't crash Array.map.
  const paths = projectPaths ?? {}

  const agg = new Map<string, { cost: number; events: number }>()
  for (const ev of events) {
    const cur = agg.get(ev.project_id) ?? { cost: 0, events: 0 }
    cur.cost += computeEventCost(ev, pricing)
    cur.events += 1
    agg.set(ev.project_id, cur)
  }
  const maxCost = [...agg.values()].reduce((m, v) => Math.max(m, v.cost), 0)
  return [...agg.entries()]
    .map(([id, v]) => {
      const fullPath = paths[id] ?? decodeProjectIdFallback(id)
      return {
        label: shortenPath(fullPath),
        fullPath,
        cost: v.cost,
        events: v.events,
        pct: maxCost > 0 ? (v.cost / maxCost) * 100 : 0,
      }
    })
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5)
}

/**
 * Fallback decoder for projects that have no JSONL events (rare).
 * Lossy — cannot distinguish path segments from literal dashes in directory
 * names like `oxy-hq`. Only used when the `cwd` ground truth is missing.
 */
function decodeProjectIdFallback(id: string): string {
  return '/' + id.replace(/^-/, '').split('-').join('/')
}

/** Display label for a project breakdown row: last 2 real path segments. */
function shortenPath(fullPath: string): string {
  const parts = fullPath.split('/').filter(Boolean)
  if (parts.length === 0) return fullPath
  if (parts.length === 1) return parts[0]
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
}

function buildHourActivity(events: UsageEvent[]): { hour: number; events: number }[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, events: 0 }))
  for (const ev of events) {
    const ts = new Date(ev.timestamp)
    const hour = ts.getHours() // local time
    if (hour >= 0 && hour < 24) {
      buckets[hour].events += 1
    }
  }
  return buckets
}

function computeEventCost(ev: UsageEvent, pricing: PricingTable): number {
  const p = pricing[ev.model] ?? pricing[stripDateSuffix(ev.model)] ?? {}
  return (
    ev.input_tokens * (p.input_cost_per_token ?? 0) +
    ev.output_tokens * (p.output_cost_per_token ?? 0) +
    ev.cache_creation_input_tokens * (p.cache_creation_input_token_cost ?? 0) +
    ev.cache_read_input_tokens * (p.cache_read_input_token_cost ?? 0)
  )
}

function stripDateSuffix(model: string): string {
  const idx = model.lastIndexOf('-')
  if (idx === -1) return model
  const suffix = model.slice(idx + 1)
  return suffix.length === 8 && /^\d+$/.test(suffix) ? model.slice(0, idx) : model
}
