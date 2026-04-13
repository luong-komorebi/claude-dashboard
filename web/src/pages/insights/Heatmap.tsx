import { useMemo, useState } from 'react'
import type { StatsData, UsageEvent } from '../../api'
import { c } from '../../theme/colors'
import pricingJson from '../../cost/pricing.json'
import type { PricingTable } from '../../cost/types'

// ─── Types ───────────────────────────────────────────────────────────────────

type Metric = 'messages' | 'cost' | 'tokens'

interface DayCell {
  date: string           // YYYY-MM-DD
  value: number
  messages: number
  cost: number
  tokens: number
  dayOfWeek: number      // 0 = Sunday
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  stats: StatsData
  events: UsageEvent[]
}

export function Heatmap({ stats, events }: Props) {
  const [metric, setMetric] = useState<Metric>('messages')
  const [year, setYear] = useState<number>(() => new Date().getFullYear())

  const pricing = useMemo(() => pricingJson as PricingTable, [])

  // Merge stats + events into day cells for the selected year
  const cells = useMemo(() => buildYearCells(year, stats, events, pricing), [year, stats, events, pricing])

  // Available years from the data
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    for (const d of stats.daily_activity) years.add(parseInt(d.date.slice(0, 4), 10))
    for (const ev of events) years.add(parseInt(ev.timestamp.slice(0, 4), 10))
    years.add(new Date().getFullYear())
    return [...years].filter(y => !Number.isNaN(y)).sort((a, b) => b - a)
  }, [stats, events])

  // Max value for color scaling
  const max = useMemo(
    () => Math.max(1, ...cells.map(c => metricValue(c, metric))),
    [cells, metric],
  )

  // Totals for summary
  const totals = useMemo(() => {
    let messages = 0, cost = 0, tokens = 0, activeDays = 0
    for (const cell of cells) {
      messages += cell.messages
      cost += cell.cost
      tokens += cell.tokens
      if (cell.messages > 0) activeDays++
    }
    return { messages, cost, tokens, activeDays }
  }, [cells])

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['messages', 'cost', 'tokens'] as Metric[]).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              style={{
                background: metric === m ? c.surfaceHover : 'transparent',
                border: `1px solid ${metric === m ? c.accent : c.border}`,
                color: metric === m ? c.text : c.textFaint,
                borderRadius: 3,
                padding: '5px 12px',
                fontSize: 11,
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontWeight: metric === m ? 600 : 400,
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              style={{
                background: year === y ? c.surfaceHover : 'transparent',
                border: `1px solid ${year === y ? c.accent : c.border}`,
                color: year === y ? c.text : c.textFaint,
                borderRadius: 3,
                padding: '5px 12px',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontWeight: year === y ? 600 : 400,
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Totals strip */}
      <div style={{
        display: 'flex', gap: 24, padding: '10px 16px',
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 6, marginBottom: 16, fontSize: 12,
      }}>
        <TotalItem label="Active days" value={totals.activeDays.toString()} />
        <TotalItem label="Messages" value={fmtNum(totals.messages)} />
        <TotalItem label="Tokens" value={fmtNum(totals.tokens)} />
        <TotalItem label="Cost" value={`$${totals.cost.toFixed(2)}`} highlight />
      </div>

      {/* Heatmap grid */}
      <div style={{
        background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6,
        padding: '20px 16px', overflow: 'auto',
      }}>
        <YearGrid year={year} cells={cells} metric={metric} max={max} />

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 11, color: c.textFaint }}>
          <span>Less</span>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map(f => (
            <div
              key={f}
              style={{
                width: 12, height: 12, borderRadius: 2,
                background: colorScale(f),
                border: `1px solid ${c.borderSoft}`,
              }}
            />
          ))}
          <span>More</span>
          <span style={{ marginLeft: 24, color: c.textGhost }}>Hover a square for details</span>
        </div>
      </div>
    </div>
  )
}

// ─── Year grid renderer (pure SVG) ───────────────────────────────────────────

function YearGrid({
  year, cells, metric, max,
}: { year: number; cells: DayCell[]; metric: Metric; max: number }) {
  const [hovered, setHovered] = useState<DayCell | null>(null)

  const jan1 = new Date(Date.UTC(year, 0, 1))
  const jan1Dow = jan1.getUTCDay() // 0=Sun..6=Sat

  // Compute the total columns (weeks + partial)
  const dec31 = new Date(Date.UTC(year, 11, 31))
  const msPerDay = 86_400_000
  const totalDays = Math.floor((dec31.getTime() - jan1.getTime()) / msPerDay) + 1
  const totalWeeks = Math.ceil((jan1Dow + totalDays) / 7)

  const cellSize = 12
  const gap = 3
  const step = cellSize + gap
  const labelW = 28
  const monthH = 18
  const width = labelW + totalWeeks * step + 8
  const height = monthH + 7 * step + 16

  // Map date string → cell for fast lookup
  const cellMap = new Map(cells.map(c => [c.date, c]))

  // Month boundaries for labels
  const monthLabels: { month: string; weekIndex: number }[] = []
  for (let m = 0; m < 12; m++) {
    const first = new Date(Date.UTC(year, m, 1))
    const daysSinceJan1 = Math.floor((first.getTime() - jan1.getTime()) / msPerDay)
    const weekIdx = Math.floor((daysSinceJan1 + jan1Dow) / 7)
    monthLabels.push({ month: MONTHS[m], weekIndex: weekIdx })
  }

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Month labels */}
        {monthLabels.map((ml, i) => (
          <text
            key={i}
            x={labelW + ml.weekIndex * step}
            y={12}
            fontSize={10}
            fill={c.textFaint}
            fontFamily="system-ui, sans-serif"
          >
            {ml.month}
          </text>
        ))}

        {/* Day-of-week labels */}
        {dayLabels.map((l, i) => l && (
          <text
            key={l}
            x={0}
            y={monthH + i * step + 10}
            fontSize={9}
            fill={c.textFaint}
            fontFamily="system-ui, sans-serif"
          >
            {l}
          </text>
        ))}

        {/* Day cells */}
        {Array.from({ length: totalDays }).map((_, i) => {
          const date = new Date(jan1.getTime() + i * msPerDay)
          const iso = date.toISOString().slice(0, 10)
          const cell = cellMap.get(iso)
          const value = cell ? metricValue(cell, metric) : 0
          const intensity = max > 0 ? Math.min(value / max, 1) : 0
          const fill = value === 0 ? c.surfaceHover : colorScale(intensity)

          const col = Math.floor((i + jan1Dow) / 7)
          const row = (i + jan1Dow) % 7

          return (
            <rect
              key={iso}
              x={labelW + col * step}
              y={monthH + row * step}
              width={cellSize}
              height={cellSize}
              rx={2}
              ry={2}
              fill={fill}
              stroke={c.borderSoft}
              strokeWidth={0.5}
              onMouseEnter={() => setHovered(cell ?? { date: iso, value: 0, messages: 0, cost: 0, tokens: 0, dayOfWeek: row })}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            />
          )
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          background: c.surfaceAlt, border: `1px solid ${c.border}`,
          borderRadius: 4, padding: '8px 12px', fontSize: 11,
          color: c.text, pointerEvents: 'none', minWidth: 180,
        }}>
          <div style={{ color: c.accent, fontWeight: 600, marginBottom: 4 }}>
            {hovered.date}
          </div>
          <div style={{ color: c.textMuted }}>Messages: {fmtNum(hovered.messages)}</div>
          <div style={{ color: c.textMuted }}>Tokens: {fmtNum(hovered.tokens)}</div>
          <div style={{ color: c.textMuted }}>Cost: ${hovered.cost.toFixed(4)}</div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function metricValue(cell: DayCell, metric: Metric): number {
  switch (metric) {
    case 'messages': return cell.messages
    case 'cost':     return cell.cost
    case 'tokens':   return cell.tokens
  }
}

/**
 * Color scale 0..1 — blends from a very faint surface tint to the theme accent.
 * Uses 6 discrete steps so it reads like a GitHub contribution graph.
 */
function colorScale(intensity: number): string {
  if (intensity === 0) return c.surfaceHover
  // Discrete 5-level scale
  const levels = [0.18, 0.35, 0.55, 0.8, 1.0]
  const idx = Math.min(levels.findIndex(l => intensity <= l), levels.length - 1)
  // We express each level as a mix of the accent with varying opacity
  const opacity = [0.2, 0.4, 0.6, 0.8, 1.0][Math.max(idx, 0)]
  // Use CSS color-mix via rgba overlay — we inline the accent as a CSS var reference
  // which won't work inside SVG fill; so build rgba from a solid overlay
  return `rgba(88, 166, 255, ${opacity})` // fallback blue (GitHub Dark accent)
}

function buildYearCells(
  year: number,
  stats: StatsData,
  events: UsageEvent[],
  pricing: PricingTable,
): DayCell[] {
  const byDate = new Map<string, DayCell>()

  // Seed with stats.daily_activity (messages)
  for (const d of stats.daily_activity) {
    if (!d.date.startsWith(`${year}-`)) continue
    byDate.set(d.date, {
      date: d.date,
      value: 0,
      messages: d.message_count,
      cost: 0,
      tokens: 0,
      dayOfWeek: new Date(d.date).getUTCDay(),
    })
  }

  // Overlay events (cost + tokens)
  for (const ev of events) {
    if (!ev.timestamp.startsWith(`${year}-`)) continue
    const date = ev.timestamp.slice(0, 10)
    const existing = byDate.get(date) ?? {
      date, value: 0, messages: 0, cost: 0, tokens: 0,
      dayOfWeek: new Date(date).getUTCDay(),
    }
    const tokens = ev.input_tokens + ev.output_tokens + ev.cache_creation_input_tokens + ev.cache_read_input_tokens
    const p = pricing[ev.model] ?? pricing[stripDateSuffix(ev.model)] ?? {}
    const cost =
      ev.input_tokens * (p.input_cost_per_token ?? 0) +
      ev.output_tokens * (p.output_cost_per_token ?? 0) +
      ev.cache_creation_input_tokens * (p.cache_creation_input_token_cost ?? 0) +
      ev.cache_read_input_tokens * (p.cache_read_input_token_cost ?? 0)

    existing.tokens += tokens
    existing.cost += cost
    byDate.set(date, existing)
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function stripDateSuffix(model: string): string {
  const idx = model.lastIndexOf('-')
  if (idx === -1) return model
  const suffix = model.slice(idx + 1)
  return suffix.length === 8 && /^\d+$/.test(suffix) ? model.slice(0, idx) : model
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toFixed(0)
}

function TotalItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ color: c.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ color: highlight ? c.accent : c.text, fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  )
}
