import { useEffect, useState } from 'react'
import { c } from '../theme/colors'
import { getOnlineConfig } from '../online/config'
import { fetchLiveUsage } from '../online/api'
import type { LiveUsageSummary } from '../online/types'

/** Bumped when Settings flips the online-mode toggle so we refetch. */
interface Props {
  /** Integer that increments whenever the settings change — triggers refetch. */
  refetchKey: number
  /** Navigate to Config → Settings (used when prompting the user to fix auth). */
  onOpenSettings: () => void
}

const fmtCost = (cents: number) => `$${(cents / 100).toFixed(2)}`
const fmtNum = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

/**
 * Appears on Overview only when online mode is enabled in Config → Settings.
 * Fetches live org-wide usage from Anthropic's Claude Code Analytics Admin API
 * and renders a compact summary card. Errors are actionable — links back to
 * settings + explains the likely cause (admin-only API, CORS, bad key).
 */
export function LiveUsageCard({ refetchKey, onOpenSettings }: Props) {
  const [config, setConfig] = useState(() => getOnlineConfig())
  const [summary, setSummary] = useState<LiveUsageSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const next = getOnlineConfig()
    setConfig(next)
    if (!next.enabled || !next.apiKey) {
      setSummary(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    fetchLiveUsage(next.apiKey, next.daysToFetch)
      .then(s => {
        if (!cancelled) setSummary(s)
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [refetchKey])

  // Hidden entirely when online mode is off
  if (!config.enabled) return null

  const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  }
  const titleStyle: React.CSSProperties = {
    color: c.warning, fontSize: 12, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 0.5,
    display: 'flex', alignItems: 'center', gap: 8,
  }

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>
            <span>● LIVE</span>
            Fetching from api.anthropic.com…
          </div>
        </div>
        <div style={{ color: c.textGhost, fontSize: 12 }}>
          Pulling {config.daysToFetch} day{config.daysToFetch === 1 ? '' : 's'} of org usage…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...cardStyle, borderLeft: `3px solid ${c.error}` }}>
        <div style={headerStyle}>
          <div style={{ ...titleStyle, color: c.error }}>
            <span>● LIVE</span>
            Online mode failed
          </div>
          <button onClick={onOpenSettings} style={linkBtnStyle}>Settings →</button>
        </div>
        <div style={{ color: c.textMuted, fontSize: 11, lineHeight: 1.6, fontFamily: 'monospace' }}>
          {error}
        </div>
      </div>
    )
  }

  if (!summary) return null

  if (summary.totalSessions === 0 && summary.totalCostCents === 0) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>
            <span>● LIVE</span>
            Organization Usage
          </div>
          <button onClick={onOpenSettings} style={linkBtnStyle}>Settings →</button>
        </div>
        <div style={{ color: c.textGhost, fontSize: 12 }}>
          No activity in the last {summary.days} day{summary.days === 1 ? '' : 's'} — or your admin key has access to an org with no Claude Code users yet.
        </div>
        {summary.errors.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 10, color: c.warning }}>
            {summary.errors.length} day{summary.errors.length === 1 ? '' : 's'} failed to fetch — check DevTools.
          </div>
        )}
      </div>
    )
  }

  const avgDailyCostCents = summary.totalCostCents / Math.max(summary.days, 1)
  const avgCostPerUser = summary.uniqueUsers > 0
    ? summary.totalCostCents / summary.uniqueUsers
    : 0

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>
          <span>● LIVE</span>
          Organization Usage · last {summary.days}d
        </div>
        <button onClick={onOpenSettings} style={linkBtnStyle}>Settings →</button>
      </div>

      {/* Stat row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
        marginBottom: 12,
      }}>
        <Stat label="Org cost" value={fmtCost(summary.totalCostCents)} sub={`${fmtCost(avgDailyCostCents)}/day`} highlight />
        <Stat label="Sessions" value={fmtNum(summary.totalSessions)} sub={`${summary.uniqueUsers} user${summary.uniqueUsers === 1 ? '' : 's'}`} />
        <Stat label="Lines added" value={fmtNum(summary.totalLinesAdded)} sub={`− ${fmtNum(summary.totalLinesRemoved)}`} />
        <Stat label="Avg / user" value={summary.uniqueUsers > 0 ? fmtCost(avgCostPerUser) : '—'} sub={`${summary.totalCommits} commits · ${summary.totalPullRequests} PRs`} />
      </div>

      {/* Model list */}
      {summary.uniqueModels.length > 0 && (
        <div style={{ marginBottom: 10, fontSize: 11, color: c.textFaint }}>
          Models: {summary.uniqueModels.map(m => (
            <span key={m} style={{
              fontFamily: 'monospace', color: c.accent,
              background: c.surfaceHover, padding: '1px 6px', borderRadius: 3,
              marginRight: 4,
            }}>
              {m.replace(/^claude-/, '')}
            </span>
          ))}
        </div>
      )}

      {summary.errors.length > 0 && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: `1px solid ${c.borderSoft}`,
          fontSize: 10, color: c.warning, lineHeight: 1.5,
        }}>
          ⚠ {summary.errors.length} day{summary.errors.length === 1 ? '' : 's'} failed to fetch. Most recent: {summary.errors[summary.errors.length - 1].message.slice(0, 140)}
        </div>
      )}

      <div style={{
        marginTop: 10, fontSize: 10, color: c.textGhost,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{summary.rangeStart} → {summary.rangeEnd}</span>
        <span>fetched {new Date(summary.fetchedAt).toLocaleTimeString()}</span>
      </div>
    </div>
  )
}

// ─── Styles / helpers ────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: c.surface,
  border: `1px solid ${c.border}`,
  borderLeft: `3px solid ${c.warning}`,
  borderRadius: 6,
  padding: 16,
  marginBottom: 20,
}

const linkBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: c.textFaint,
  fontSize: 11,
  cursor: 'pointer',
  padding: 0,
}

function Stat({ label, value, sub, highlight }: {
  label: string
  value: string
  sub: string
  highlight?: boolean
}) {
  return (
    <div>
      <div style={{ color: c.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ color: highlight ? c.warning : c.text, fontSize: 18, fontWeight: 700, margin: '2px 0' }}>
        {value}
      </div>
      <div style={{ color: c.textGhost, fontSize: 10 }}>{sub}</div>
    </div>
  )
}
