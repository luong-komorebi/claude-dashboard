import { useEffect, useMemo, useState } from 'react'
import type { StatsData, UsageEvent } from '../../api'
import { StatCard } from '../../components/StatCard'
import { c } from '../../theme/colors'
import pricingJson from '../../cost/pricing.json'
import type { ForecastOutput, Insight, PricingTable } from '../../cost/types'
import { getBudget, setBudget, clearBudget, projectMonth } from '../../cost/budget'
import {
  Area, ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceDot, Legend,
} from 'recharts'

// ─── WASM lazy-loader ─────────────────────────────────────────────────────────

type WasmModule = typeof import('../../wasm-pkg/claude_analytics')
let wasmPromise: Promise<WasmModule> | null = null
const getWasm = () => (wasmPromise ??= import('../../wasm-pkg/claude_analytics'))

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtCost = (v: number) => `$${v.toFixed(v < 10 ? 2 : 0)}`
const fmtNum = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return v.toFixed(0)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  stats: StatsData
  events: UsageEvent[]
}

export function Forecast({ stats, events }: Props) {
  const pricing = useMemo(() => pricingJson as PricingTable, [])

  const [forecast, setForecast] = useState<ForecastOutput | null>(null)
  const [costForecast, setCostForecast] = useState<ForecastOutput | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Budget state (persisted)
  const [budgetAmount, setBudgetAmount] = useState<number>(() => getBudget()?.amount ?? 0)
  const [budgetInput, setBudgetInput] = useState<string>(() =>
    getBudget()?.amount ? String(getBudget()!.amount) : '',
  )

  // Daily cost series derived from events
  const dailyCost = useMemo(() => buildDailyCost(events, pricing), [events, pricing])

  useEffect(() => {
    setLoading(true)
    setError(null)
    getWasm()
      .then(wasm => {
        // Forecast daily messages (30 days ahead, weekly seasonality)
        const msgSeries = stats.daily_activity.map(d => d.message_count)
        const fRaw = wasm.compute_forecast(JSON.stringify({
          daily: msgSeries, horizon: 30, season_length: 7,
        }))
        if (fRaw.startsWith('error:')) throw new Error(fRaw.slice(6))

        // Forecast daily cost too
        const costSeries = dailyCost.map(d => d.cost)
        const cfRaw = wasm.compute_forecast(JSON.stringify({
          daily: costSeries, horizon: 30, season_length: 7,
        }))
        if (cfRaw.startsWith('error:')) throw new Error(cfRaw.slice(6))

        // Insights
        const iRaw = wasm.compute_insights(JSON.stringify({ events, pricing }))
        if (iRaw.startsWith('error:')) throw new Error(iRaw.slice(6))

        setForecast(JSON.parse(fRaw) as ForecastOutput)
        setCostForecast(JSON.parse(cfRaw) as ForecastOutput)
        setInsights(JSON.parse(iRaw) as Insight[])
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [stats, events, pricing, dailyCost])

  if (loading) return <div style={{ color: c.textGhost, fontSize: 13 }}>Running WASM forecasting…</div>
  if (error) return <div style={{ color: c.error, fontSize: 13 }}>{error}</div>
  if (!forecast || !costForecast) return null

  // ── Chart data: actuals + fitted + forecast
  const chartData = buildChartData(stats, forecast)

  // ── Budget math
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = now.getDate()
  const thisMonth = now.toISOString().slice(0, 7)
  const mtdCost = dailyCost
    .filter(d => d.date.startsWith(thisMonth))
    .reduce((s, d) => s + d.cost, 0)
  const projected = projectMonth(mtdCost, daysElapsed, daysInMonth)
  const budgetOverage = budgetAmount > 0 ? projected > budgetAmount : false
  const daysUntilBudget = budgetAmount > 0 && mtdCost > 0
    ? Math.ceil((budgetAmount - mtdCost) / (mtdCost / daysElapsed))
    : null

  const saveBudget = () => {
    const v = Number(budgetInput)
    if (Number.isFinite(v) && v > 0) {
      setBudget(v)
      setBudgetAmount(v)
    }
  }
  const wipeBudget = () => {
    clearBudget()
    setBudgetAmount(0)
    setBudgetInput('')
  }

  return (
    <div>
      {/* ── Headline cards ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard
          label="Next 30d · Messages"
          value={fmtNum(forecast.forecast.reduce((s, p) => s + p.value, 0))}
          sub={`RMSE ${forecast.rmse.toFixed(1)}`}
          highlight
        />
        <StatCard
          label="Next 30d · Cost"
          value={fmtCost(costForecast.forecast.reduce((s, p) => s + p.value, 0))}
          sub="API equivalent"
          color={c.accent}
        />
        <StatCard
          label="This Month · MTD"
          value={fmtCost(mtdCost)}
          sub={`Projected: ${fmtCost(projected)}`}
          color={budgetOverage ? c.error : undefined}
        />
        <StatCard
          label="Anomalies Detected"
          value={forecast.anomalies.length}
          sub={forecast.anomalies.length > 0 ? 'click chart dots' : 'none in range'}
          color={forecast.anomalies.length > 0 ? c.warning : c.textMuted}
        />
      </div>

      {/* ── Forecast chart ─────────────────────────────────────────────── */}
      <div style={{
        background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6,
        padding: 16, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Daily Messages · Actual + Forecast
          </div>
          <div style={{ color: c.textFaint, fontSize: 10, fontFamily: 'monospace' }}>
            α={forecast.alpha.toFixed(2)} β={forecast.beta.toFixed(2)} γ={forecast.gamma.toFixed(2)}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.surfaceHover} />
            <XAxis dataKey="date" tick={{ fill: c.textGhost, fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: c.textGhost, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
            <Tooltip
              contentStyle={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, borderRadius: 4, fontSize: 12 }}
              labelStyle={{ color: c.textMuted }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: c.textGhost }} />

            {/* Confidence band (stacked area trick: lower + range) */}
            <Area
              type="monotone"
              dataKey="lower"
              stackId="ci"
              stroke="transparent"
              fill="transparent"
              legendType="none"
              name=""
            />
            <Area
              type="monotone"
              dataKey="range"
              stackId="ci"
              stroke="transparent"
              fill={c.accent}
              fillOpacity={0.12}
              name="80% CI"
            />

            {/* Actual series */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke={c.text}
              dot={false}
              strokeWidth={1.5}
              name="Actual"
              connectNulls={false}
            />
            {/* Fitted (historical fit) */}
            <Line
              type="monotone"
              dataKey="fitted"
              stroke={c.textFaint}
              dot={false}
              strokeWidth={1}
              strokeDasharray="3 3"
              name="Fitted"
              connectNulls={false}
            />
            {/* Forecast line */}
            <Line
              type="monotone"
              dataKey="forecast"
              stroke={c.accent}
              dot={false}
              strokeWidth={2}
              name="Forecast"
              connectNulls={false}
            />

            {/* Anomaly markers */}
            {forecast.anomalies.map(a => {
              const point = chartData[a.index]
              if (!point) return null
              return (
                <ReferenceDot
                  key={`anom-${a.index}`}
                  x={point.date}
                  y={a.value}
                  r={5}
                  fill={a.kind === 'spike' ? c.error : c.warning}
                  stroke={c.bg}
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                />
              )
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Two-column: Budget tracker + Insights stack ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Budget card */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: 16 }}>
          <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Monthly Budget
          </div>
          {budgetAmount > 0 ? (
            <>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: c.textMuted }}>{fmtCost(mtdCost)} spent</span>
                  <span style={{ color: c.textFaint }}>of {fmtCost(budgetAmount)}</span>
                </div>
                <div style={{ background: c.surfaceHover, borderRadius: 2, height: 8, overflow: 'hidden' }}>
                  <div
                    style={{
                      background: budgetOverage ? c.error : c.success,
                      height: 8,
                      width: `${Math.min((mtdCost / budgetAmount) * 100, 100)}%`,
                      transition: 'width 200ms',
                    }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 11, color: c.textFaint, lineHeight: 1.6, marginBottom: 12 }}>
                Projected month total: <strong style={{ color: budgetOverage ? c.error : c.success }}>{fmtCost(projected)}</strong>
                {daysUntilBudget !== null && daysUntilBudget < 100 && (
                  <> · hit budget in {daysUntilBudget > 0 ? `${daysUntilBudget} days` : 'already over'}</>
                )}
              </div>
              <button
                onClick={wipeBudget}
                style={{
                  background: 'transparent', border: `1px solid ${c.borderSoft}`,
                  color: c.textFaint, padding: '4px 10px', borderRadius: 3,
                  fontSize: 11, cursor: 'pointer',
                }}
              >
                Clear budget
              </button>
            </>
          ) : (
            <>
              <div style={{ color: c.textFaint, fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
                Set a monthly budget to track projected spend vs target. Stored in this browser only.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 50"
                  value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  style={{
                    flex: 1, background: c.bg, border: `1px solid ${c.border}`,
                    borderRadius: 3, color: c.text, padding: '5px 8px', fontSize: 12,
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button
                  onClick={saveBudget}
                  style={{
                    background: c.accent, color: c.accentFg, border: 'none',
                    borderRadius: 3, padding: '5px 14px', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Set $
                </button>
              </div>
            </>
          )}
        </div>

        {/* Insights card */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: 16 }}>
          <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Insights
          </div>
          {insights.length === 0 ? (
            <div style={{ color: c.textGhost, fontSize: 12 }}>Not enough data yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
              {insights.slice(0, 8).map((ins, i) => (
                <InsightRow key={i} insight={ins} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InsightRow({ insight }: { insight: Insight }) {
  const color =
    insight.severity === 'alert' ? c.error :
    insight.severity === 'warning' ? c.warning :
    c.accent
  return (
    <div style={{
      display: 'flex',
      gap: 10,
      padding: '8px 10px',
      background: c.bg,
      border: `1px solid ${c.borderSoft}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 3,
    }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{insight.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: c.text, fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
          {insight.title}
        </div>
        <div style={{ color: c.textFaint, fontSize: 11, lineHeight: 1.5 }}>
          {insight.description}
        </div>
      </div>
    </div>
  )
}

// ─── Data builders ───────────────────────────────────────────────────────────

function buildDailyCost(events: UsageEvent[], pricing: PricingTable): { date: string; cost: number }[] {
  const map = new Map<string, number>()
  for (const ev of events) {
    const date = ev.timestamp.slice(0, 10)
    const p = pricing[ev.model] ?? pricing[stripDateSuffix(ev.model)] ?? {}
    const cost =
      ev.input_tokens * (p.input_cost_per_token ?? 0) +
      ev.output_tokens * (p.output_cost_per_token ?? 0) +
      ev.cache_creation_input_tokens * (p.cache_creation_input_token_cost ?? 0) +
      ev.cache_read_input_tokens * (p.cache_read_input_token_cost ?? 0)
    map.set(date, (map.get(date) ?? 0) + cost)
  }
  return [...map.entries()]
    .map(([date, cost]) => ({ date, cost }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function stripDateSuffix(model: string): string {
  const idx = model.lastIndexOf('-')
  if (idx === -1) return model
  const suffix = model.slice(idx + 1)
  return suffix.length === 8 && /^\d+$/.test(suffix) ? model.slice(0, idx) : model
}

interface ChartPoint {
  date: string
  actual?: number
  fitted?: number
  forecast?: number
  lower?: number
  range?: number
}

function buildChartData(stats: StatsData, forecast: ForecastOutput): ChartPoint[] {
  const points: ChartPoint[] = []

  // Actuals with fitted overlay
  for (let i = 0; i < stats.daily_activity.length; i++) {
    const d = stats.daily_activity[i]
    points.push({
      date: d.date.slice(5),
      actual: d.message_count,
      fitted: forecast.fitted[i],
    })
  }

  // Forecast (future) — advance dates by 1 day from the last actual
  if (stats.daily_activity.length > 0) {
    const lastDate = stats.daily_activity[stats.daily_activity.length - 1].date
    for (let h = 0; h < forecast.forecast.length; h++) {
      const date = addDays(lastDate, h + 1).slice(5)
      const p = forecast.forecast[h]
      points.push({
        date,
        forecast: p.value,
        lower: p.lower,
        range: p.upper - p.lower,
      })
    }
  }

  return points
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
