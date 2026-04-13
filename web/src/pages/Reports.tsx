import { useEffect, useMemo, useState } from 'react'
import type { UsageEvent } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { StatCard } from '../components/StatCard'
import { SearchInput, matchesQuery } from '../components/SearchInput'
import { InfoHint } from '../components/InfoHint'
import { c } from '../theme/colors'
import pricingJson from '../cost/pricing.json'
import type { Reports, PeriodRow, SessionRow, BlockRow, PricingTable } from '../cost/types'

// ─── WASM lazy-loader ─────────────────────────────────────────────────────────

type WasmModule = typeof import('../wasm-pkg/claude_analytics')
let wasmPromise: Promise<WasmModule> | null = null

function getWasm(): Promise<WasmModule> {
  if (!wasmPromise) wasmPromise = import('../wasm-pkg/claude_analytics')
  return wasmPromise
}

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

const SUB_TABS = ['Daily', 'Weekly', 'Monthly', 'Sessions', 'Blocks'] as const
type SubTab = typeof SUB_TABS[number]

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtNum = new Intl.NumberFormat('en-US').format
const fmtCost = (usd: number) =>
  usd === 0 ? '—' : `$${usd.toFixed(usd < 0.01 ? 4 : 2)}`
const fmtTokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return fmtNum(n)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReportsPage({ events }: { events: UsageEvent[] }) {
  const [sub, setSub] = useState<SubTab>('Daily')
  const [query, setQuery] = useState('')
  const [reports, setReports] = useState<Reports | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const pricing = useMemo(() => pricingJson as PricingTable, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    getWasm()
      .then(wasm => {
        const input = JSON.stringify({
          events,
          pricing,
          now_epoch_secs: Math.floor(Date.now() / 1000),
        })
        const raw = wasm.compute_reports(input)
        if (raw.startsWith('error:')) throw new Error(raw.slice(6))
        setReports(JSON.parse(raw) as Reports)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [events, pricing])

  if (loading) {
    return (
      <div>
        <SectionHeader title="Reports" sub="Token usage and estimated cost, computed in WASM" />
        <div style={{ color: c.textGhost, fontSize: 13 }}>Computing reports…</div>
      </div>
    )
  }

  if (error || !reports) {
    return (
      <div>
        <SectionHeader title="Reports" sub="Token usage and estimated cost, computed in WASM" />
        <div style={{ color: c.error, fontSize: 13 }}>{error ?? 'No data'}</div>
      </div>
    )
  }

  const t = reports.grand_total
  const hasData = t.event_count > 0

  const filterPeriod = (rows: PeriodRow[]): PeriodRow[] => {
    if (!query) return rows
    return rows.filter(
      r => matchesQuery(r.label, query) || matchesQuery(r.models.join(' '), query)
    )
  }
  const filterSessions = (rows: SessionRow[]): SessionRow[] => {
    if (!query) return rows
    return rows.filter(
      r =>
        matchesQuery(r.session_id, query) ||
        matchesQuery(r.project_id, query) ||
        matchesQuery(r.models.join(' '), query)
    )
  }
  const filterBlocks = (rows: BlockRow[]): BlockRow[] => {
    if (!query) return rows
    return rows.filter(
      r => matchesQuery(r.start, query) || matchesQuery(r.models.join(' '), query)
    )
  }

  const dailyFiltered = filterPeriod(reports.daily)
  const weeklyFiltered = filterPeriod(reports.weekly)
  const monthlyFiltered = filterPeriod(reports.monthly)
  const sessionsFiltered = filterSessions(reports.sessions)
  const blocksFiltered = filterBlocks(reports.blocks)

  const currentCount =
    sub === 'Daily' ? dailyFiltered.length :
    sub === 'Weekly' ? weeklyFiltered.length :
    sub === 'Monthly' ? monthlyFiltered.length :
    sub === 'Sessions' ? sessionsFiltered.length :
    blocksFiltered.length

  const currentEmpty = query !== '' && currentCount === 0

  return (
    <div>
      <SectionHeader
        title="Reports"
        sub="Token usage and estimated cost, computed in WASM from ~/.claude/projects/**/*.jsonl"
      />

      <SubscriptionNotice />

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard
          label="Total Cost"
          value={fmtCost(t.cost_usd)}
          sub={`${fmtNum(t.event_count)} assistant messages`}
          highlight
          color={c.accent}
        />
        <StatCard label="Input" value={fmtTokens(t.input)} sub="tokens sent" />
        <StatCard label="Output" value={fmtTokens(t.output)} sub="tokens received" />
        <StatCard label="Cache Create" value={fmtTokens(t.cache_create)} sub="written" />
        <StatCard label="Cache Read" value={fmtTokens(t.cache_read)} sub="cheap reads" />
      </div>

      {reports.unpriced_models.length > 0 && (
        <div style={{
          background: c.errorBg, border: `1px solid ${c.errorBorder}`,
          borderRadius: 4, padding: '8px 12px', marginBottom: 16, fontSize: 11, color: c.error,
        }}>
          ⚠ No pricing for: {reports.unpriced_models.join(', ')}.
          Costs for these models show as $0. Run <code>just pricing-update</code> to refresh.
        </div>
      )}

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${c.border}` }}>
        {SUB_TABS.map(name => (
          <button
            key={name}
            onClick={() => setSub(name)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${sub === name ? c.accent : 'transparent'}`,
              color: sub === name ? c.text : c.textFaint,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: sub === name ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {hasData && (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Filter current report…"
          count={query ? currentCount : undefined}
        />
      )}

      {!hasData && (
        <div style={{ color: c.textGhost, fontSize: 13 }}>
          No usage events found in <code>~/.claude/projects/</code>. Session logs appear after Claude Code processes assistant messages.
        </div>
      )}

      {hasData && currentEmpty ? (
        <div style={{ color: c.textGhost, fontSize: 12, padding: '16px 8px' }}>No results for "{query}"</div>
      ) : (
        <>
          {hasData && sub === 'Daily'    && <PeriodTable rows={dailyFiltered}    labelCol="Date" />}
          {hasData && sub === 'Weekly'   && <PeriodTable rows={weeklyFiltered}   labelCol="Week start" />}
          {hasData && sub === 'Monthly'  && <PeriodTable rows={monthlyFiltered}  labelCol="Month" />}
          {hasData && sub === 'Sessions' && <SessionsTable rows={sessionsFiltered} />}
          {hasData && sub === 'Blocks'   && <BlocksTable rows={blocksFiltered} />}
        </>
      )}
    </div>
  )
}

// ─── Tables ───────────────────────────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  color: c.textFaint,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  borderBottom: `1px solid ${c.border}`,
}
const td: React.CSSProperties = {
  padding: '8px 12px',
  color: c.text,
  fontSize: 12,
  borderTop: `1px solid ${c.borderSoft}`,
}
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const tdMuted: React.CSSProperties = { ...td, color: c.textFaint }

function ModelBadges({ models }: { models: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {models.map(m => (
        <span key={m} style={{
          background: c.surfaceHover, color: c.accent,
          fontSize: 10, padding: '1px 6px', borderRadius: 3, fontFamily: 'monospace',
        }}>
          {m.replace(/^claude-/, '')}
        </span>
      ))}
    </div>
  )
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        {children}
      </table>
    </div>
  )
}

function PeriodTable({ rows, labelCol }: { rows: PeriodRow[]; labelCol: string }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <th style={th}>{labelCol}</th>
          <th style={th}>Models</th>
          <th style={{ ...th, textAlign: 'right' }}>Input</th>
          <th style={{ ...th, textAlign: 'right' }}>Output</th>
          <th style={{ ...th, textAlign: 'right' }}>Cache Cr.</th>
          <th style={{ ...th, textAlign: 'right' }}>Cache Rd.</th>
          <th style={{ ...th, textAlign: 'right' }}>Total</th>
          <th style={{ ...th, textAlign: 'right' }}>Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.label}>
            <td style={{ ...td, fontFamily: 'monospace' }}>{r.label}</td>
            <td style={td}><ModelBadges models={r.models} /></td>
            <td style={tdNum}>{fmtTokens(r.input)}</td>
            <td style={tdNum}>{fmtTokens(r.output)}</td>
            <td style={tdNum}>{fmtTokens(r.cache_create)}</td>
            <td style={tdNum}>{fmtTokens(r.cache_read)}</td>
            <td style={{ ...tdNum, color: c.text, fontWeight: 600 }}>{fmtTokens(r.total)}</td>
            <td style={{ ...tdNum, color: c.accent, fontWeight: 600 }}>{fmtCost(r.cost_usd)}</td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  )
}

function SessionsTable({ rows }: { rows: SessionRow[] }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <th style={th}>Session</th>
          <th style={th}>Started</th>
          <th style={{ ...th, textAlign: 'right' }}>Duration</th>
          <th style={th}>Models</th>
          <th style={{ ...th, textAlign: 'right' }}>Total</th>
          <th style={{ ...th, textAlign: 'right' }}>Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.session_id}>
            <td style={{ ...tdMuted, fontFamily: 'monospace', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.session_id.slice(0, 8)}
            </td>
            <td style={{ ...td, fontFamily: 'monospace' }}>{r.start.slice(0, 16).replace('T', ' ')}</td>
            <td style={tdNum}>{r.duration_minutes}m</td>
            <td style={td}><ModelBadges models={r.models} /></td>
            <td style={{ ...tdNum, fontWeight: 600 }}>{fmtTokens(r.total)}</td>
            <td style={{ ...tdNum, color: c.accent, fontWeight: 600 }}>{fmtCost(r.cost_usd)}</td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  )
}

function BlocksTable({ rows }: { rows: BlockRow[] }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <th style={th}>Block Start</th>
          <th style={th}>Status</th>
          <th style={th}>Models</th>
          <th style={{ ...th, textAlign: 'right' }}>Total</th>
          <th style={{ ...th, textAlign: 'right' }}>Burn/min</th>
          <th style={{ ...th, textAlign: 'right' }}>Projected</th>
          <th style={{ ...th, textAlign: 'right' }}>Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.start}>
            <td style={{ ...td, fontFamily: 'monospace' }}>{r.start.slice(0, 16).replace('T', ' ')}</td>
            <td style={td}>
              {r.is_active ? (
                <span style={{ color: c.success, fontSize: 11, fontWeight: 600 }}>
                  ⏰ Active · {r.minutes_remaining}m left
                </span>
              ) : (
                <span style={{ color: c.textGhost, fontSize: 11 }}>✓ Done</span>
              )}
            </td>
            <td style={td}><ModelBadges models={r.models} /></td>
            <td style={{ ...tdNum, fontWeight: 600 }}>{fmtTokens(r.total)}</td>
            <td style={tdNum}>{r.is_active ? fmtTokens(r.burn_rate_per_min) : '—'}</td>
            <td style={tdNum}>{r.is_active ? fmtTokens(r.projected_total) : '—'}</td>
            <td style={{ ...tdNum, color: c.accent, fontWeight: 600 }}>{fmtCost(r.cost_usd)}</td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  )
}
