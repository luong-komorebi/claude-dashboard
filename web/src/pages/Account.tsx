import { useMemo, useState } from 'react'
import type { AccountInfo, UsageEvent } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { StatCard } from '../components/StatCard'
import { c } from '../theme/colors'
import pricingJson from '../cost/pricing.json'
import type { PricingTable } from '../cost/types'

interface Props {
  account: AccountInfo | null
  events: UsageEvent[]
  projectPaths: Record<string, string>
}

const fmtCost = (v: number) => (v === 0 ? '$0' : `$${v.toFixed(v < 0.01 ? 4 : 2)}`)

export function Account({ account, events, projectPaths }: Props) {
  const [revealEmail, setRevealEmail] = useState(false)
  const pricing = useMemo(() => pricingJson as PricingTable, [])

  if (!account) {
    return (
      <div>
        <SectionHeader
          title="Account"
          sub="Account info from ~/.claude.json — requires picking your home folder"
        />
        <div style={{
          background: c.surface, border: `1px solid ${c.border}`,
          borderLeft: `3px solid ${c.warning}`,
          borderRadius: 4, padding: 16, fontSize: 13, color: c.textMuted, lineHeight: 1.6,
        }}>
          <div style={{ color: c.text, fontWeight: 600, marginBottom: 8 }}>
            Account info unavailable
          </div>
          <div style={{ marginBottom: 10 }}>
            Claude Code stores account info (email, org, numStartups, per-project costs)
            in <code style={code}>~/.claude.json</code> — a <em>sibling</em> of the
            <code style={code}>.claude/</code> folder, not inside it. To access it, pick
            your <strong style={{ color: c.text }}>home folder</strong> instead of
            <code style={code}>.claude</code> directly.
          </div>
          <div style={{ fontSize: 12, color: c.textFaint }}>
            Click <strong>"Change folder"</strong> in the sidebar → pick your home folder
            (not <code style={code}>.claude</code>) → the dashboard will auto-find
            <code style={code}>.claude</code> inside and unlock this tab.
          </div>
        </div>
      </div>
    )
  }

  // Cross-reference: cost Claude Code itself recorded (account.projectCosts) vs
  // our LiteLLM-derived cost per project (computed from events).
  const computedByPath = computeCostByPath(events, pricing, projectPaths)
  const reconciliation = buildReconciliation(account.projectCosts, computedByPath)

  const totalCodeCost = account.projectCosts.reduce((s, p) => s + p.lastCost, 0)
  const totalComputed = reconciliation.reduce((s, r) => s + r.computed, 0)

  return (
    <div>
      <SectionHeader
        title="Account"
        sub={`From ${account.source} · redacted in-worker before reaching the main thread`}
      />

      {/* Hero cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard
          label="CLI Startups"
          value={account.numStartups.toLocaleString()}
          sub="total Claude Code launches"
          highlight
          color={c.accent}
        />
        <StatCard
          label="Install Method"
          value={account.installMethod ?? '—'}
          sub={account.autoUpdates === true ? 'auto-updates on' : account.autoUpdates === false ? 'auto-updates off' : ''}
        />
        <StatCard
          label="MCP Servers"
          value={account.mcpServers.length}
          sub={account.mcpServers.length > 0 ? account.mcpServers.slice(0, 2).join(', ') : 'none configured'}
        />
        <StatCard
          label="Claude Code's Cost"
          value={fmtCost(totalCodeCost)}
          sub={`last-session across ${account.projectCosts.length} projects`}
          color={c.success}
        />
      </div>

      {/* Identity card */}
      <div style={{
        background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6,
        padding: 16, marginBottom: 20,
      }}>
        <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Identity
        </div>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <tbody>
            <IdRow label="Email">
              {account.email ? (
                revealEmail ? (
                  <code style={{ ...code, color: c.text }}>{account.email}</code>
                ) : (
                  <button
                    onClick={() => setRevealEmail(true)}
                    style={{
                      background: c.surfaceHover, border: `1px solid ${c.border}`,
                      color: c.textMuted, borderRadius: 3, padding: '3px 10px',
                      fontSize: 11, cursor: 'pointer',
                    }}
                  >
                    Click to reveal
                  </button>
                )
              ) : '—'}
            </IdRow>
            <IdRow label="Account UUID">
              <code style={{ ...code, color: c.textMuted }}>
                {account.accountUuid ? truncate(account.accountUuid) : '—'}
              </code>
            </IdRow>
            <IdRow label="Organization UUID">
              <code style={{ ...code, color: c.textMuted }}>
                {account.organizationUuid ? truncate(account.organizationUuid) : '—'}
              </code>
            </IdRow>
            <IdRow label="User ID">
              <code style={{ ...code, color: c.textMuted }}>{account.userId ?? '—'}</code>
            </IdRow>
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: c.textGhost, marginTop: 10, lineHeight: 1.5 }}>
          OAuth access/refresh tokens are stripped inside the Web Worker before the
          main thread can see them. They're never persisted to OPFS or exported.
        </div>
      </div>

      {/* Cost reconciliation */}
      {reconciliation.length > 0 && (
        <div style={{
          background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6,
          overflow: 'hidden', marginBottom: 20,
        }}>
          <div style={{
            color: c.accent, fontSize: 12, fontWeight: 600,
            padding: '12px 16px', textTransform: 'uppercase', letterSpacing: 0.5,
            borderBottom: `1px solid ${c.border}`,
          }}>
            Cost Reconciliation — Claude Code vs LiteLLM
          </div>
          <div style={{ padding: '10px 16px', fontSize: 11, color: c.textFaint, borderBottom: `1px solid ${c.borderSoft}` }}>
            Claude Code's own <code style={{ ...code, fontSize: 10 }}>lastCost</code> per project (left)
            vs our WASM computation using bundled LiteLLM pricing (right).
            A big delta usually means a model we don't have pricing for —
            run <code style={{ ...code, fontSize: 10 }}>just pricing-update</code>.
          </div>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Project</th>
                <th style={{ ...th, textAlign: 'right' }}>Claude Code</th>
                <th style={{ ...th, textAlign: 'right' }}>Computed</th>
                <th style={{ ...th, textAlign: 'right' }}>Delta</th>
              </tr>
            </thead>
            <tbody>
              {reconciliation.map(row => {
                const delta = row.computed - row.claudeCode
                const deltaPct = row.claudeCode > 0 ? (delta / row.claudeCode * 100) : 0
                const deltaColor = Math.abs(deltaPct) < 10 ? c.success : Math.abs(deltaPct) < 30 ? c.warning : c.error
                return (
                  <tr key={row.path}>
                    <td style={{ ...td, fontFamily: 'monospace', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.path}>
                      {row.path.split('/').slice(-2).join('/')}
                    </td>
                    <td style={tdNum}>{fmtCost(row.claudeCode)}</td>
                    <td style={tdNum}>{fmtCost(row.computed)}</td>
                    <td style={{ ...tdNum, color: deltaColor }}>
                      {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${deltaPct.toFixed(0)}%`}
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: c.surfaceAlt, fontWeight: 600 }}>
                <td style={td}>Total</td>
                <td style={tdNum}>{fmtCost(totalCodeCost)}</td>
                <td style={tdNum}>{fmtCost(totalComputed)}</td>
                <td style={{ ...tdNum, color: c.textFaint }}>
                  {totalCodeCost > 0
                    ? `${totalComputed >= totalCodeCost ? '+' : ''}${((totalComputed - totalCodeCost) / totalCodeCost * 100).toFixed(0)}%`
                    : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* MCP servers */}
      {account.mcpServers.length > 0 && (
        <div style={{
          background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6,
          padding: 16, marginBottom: 20,
        }}>
          <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            MCP Servers ({account.mcpServers.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {account.mcpServers.map(name => (
              <span key={name} style={{
                fontFamily: 'monospace', fontSize: 11,
                color: c.accent, background: c.surfaceHover,
                padding: '4px 10px', borderRadius: 3,
              }}>
                {name}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: c.textGhost, marginTop: 10 }}>
            Server names only — env vars, API keys, and headers are stripped in-worker.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IdRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <td style={{ padding: '6px 0', color: c.textFaint, width: 160, verticalAlign: 'top' }}>{label}</td>
      <td style={{ padding: '6px 0' }}>{children}</td>
    </tr>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(uuid: string): string {
  if (uuid.length < 13) return uuid
  return `${uuid.slice(0, 8)}…${uuid.slice(-4)}`
}

function computeCostByPath(
  events: UsageEvent[],
  pricing: PricingTable,
  projectPaths: Record<string, string>,
): Map<string, number> {
  const byPath = new Map<string, number>()
  for (const ev of events) {
    const path = projectPaths[ev.project_id] ?? ev.project_id
    const p = pricing[ev.model] ?? pricing[stripDateSuffix(ev.model)] ?? {}
    const cost =
      ev.input_tokens * (p.input_cost_per_token ?? 0) +
      ev.output_tokens * (p.output_cost_per_token ?? 0) +
      ev.cache_creation_input_tokens * (p.cache_creation_input_token_cost ?? 0) +
      ev.cache_read_input_tokens * (p.cache_read_input_token_cost ?? 0)
    byPath.set(path, (byPath.get(path) ?? 0) + cost)
  }
  return byPath
}

function buildReconciliation(
  projectCosts: AccountInfo['projectCosts'],
  computedByPath: Map<string, number>,
): { path: string; claudeCode: number; computed: number }[] {
  return projectCosts
    .map(p => ({
      path: p.path,
      claudeCode: p.lastCost,
      computed: computedByPath.get(p.path) ?? 0,
    }))
    .sort((a, b) => b.claudeCode - a.claudeCode)
    .slice(0, 10)
}

function stripDateSuffix(model: string): string {
  const idx = model.lastIndexOf('-')
  if (idx === -1) return model
  const suffix = model.slice(idx + 1)
  return suffix.length === 8 && /^\d+$/.test(suffix) ? model.slice(0, idx) : model
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  color: c.textFaint,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  background: c.surfaceAlt,
}
const td: React.CSSProperties = {
  padding: '8px 16px',
  color: c.text,
  fontSize: 12,
  borderTop: `1px solid ${c.borderSoft}`,
}
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

const code: React.CSSProperties = {
  background: c.surfaceHover,
  padding: '1px 6px',
  borderRadius: 3,
  fontSize: 11,
  fontFamily: 'monospace',
}
