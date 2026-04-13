import { useEffect, useMemo, useState } from 'react'
import type { UsageEvent } from '../../api'
import { StatCard } from '../../components/StatCard'
import { c } from '../../theme/colors'
import pricingJson from '../../cost/pricing.json'
import type { PricingTable, WhatIfResult, ModelSwap } from '../../cost/types'

// ─── WASM lazy-loader ─────────────────────────────────────────────────────────

type WasmModule = typeof import('../../wasm-pkg/claude_analytics')
let wasmPromise: Promise<WasmModule> | null = null
const getWasm = () => (wasmPromise ??= import('../../wasm-pkg/claude_analytics'))

// ─── Preset scenarios ────────────────────────────────────────────────────────

interface Scenario {
  id: string
  name: string
  description: string
  swaps: ModelSwap[]
}

const PRESETS: Scenario[] = [
  {
    id: 'none',
    name: 'Baseline',
    description: 'Your actual model mix (no changes)',
    swaps: [],
  },
  {
    id: 'all-haiku',
    name: 'Everything → Haiku',
    description: 'Route every message to Haiku — maximum savings, lowest quality',
    swaps: [
      { from_contains: 'opus',    to: 'claude-haiku-4-5' },
      { from_contains: 'sonnet',  to: 'claude-haiku-4-5' },
    ],
  },
  {
    id: 'opus-to-sonnet',
    name: 'Opus → Sonnet',
    description: 'Replace every Opus call with Sonnet — keeps coding quality high',
    swaps: [
      { from_contains: 'opus', to: 'claude-sonnet-4-6' },
    ],
  },
  {
    id: 'sonnet-to-haiku',
    name: 'Sonnet → Haiku',
    description: 'Replace Sonnet with Haiku — good for simple edits and refactors',
    swaps: [
      { from_contains: 'sonnet', to: 'claude-haiku-4-5' },
    ],
  },
  {
    id: 'all-opus',
    name: 'Everything → Opus',
    description: 'Ultra-premium — what if every turn went through Opus?',
    swaps: [
      { from_contains: 'haiku',  to: 'claude-opus-4-6' },
      { from_contains: 'sonnet', to: 'claude-opus-4-6' },
    ],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  events: UsageEvent[]
}

export function WhatIf({ events }: Props) {
  const pricing = useMemo(() => pricingJson as PricingTable, [])
  const [scenarioId, setScenarioId] = useState<string>('opus-to-sonnet')
  const [customSwaps, setCustomSwaps] = useState<ModelSwap[] | null>(null)
  const [result, setResult] = useState<WhatIfResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeSwaps = useMemo(() => {
    if (customSwaps) return customSwaps
    return PRESETS.find(s => s.id === scenarioId)?.swaps ?? []
  }, [scenarioId, customSwaps])

  useEffect(() => {
    setLoading(true)
    setError(null)
    getWasm()
      .then(wasm => {
        const raw = wasm.compute_what_if(JSON.stringify({
          events, pricing, swaps: activeSwaps,
        }))
        if (raw.startsWith('error:')) throw new Error(raw.slice(6))
        setResult(JSON.parse(raw) as WhatIfResult)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [events, pricing, activeSwaps])

  const availableModels = useMemo(() => {
    const names = new Set<string>(Object.keys(pricing))
    for (const ev of events) names.add(ev.model)
    return [...names].filter(n => !n.startsWith('<')).sort()
  }, [events, pricing])

  if (events.length === 0) {
    return (
      <div style={{ color: c.textGhost, fontSize: 13 }}>
        No usage events to simulate. Come back after Claude Code processes some sessions.
      </div>
    )
  }

  if (loading) return <div style={{ color: c.textGhost, fontSize: 13 }}>Running simulation…</div>
  if (error) return <div style={{ color: c.error, fontSize: 13 }}>{error}</div>
  if (!result) return null

  const savingsColor = result.savings > 0 ? c.success : result.savings < 0 ? c.error : c.textMuted

  return (
    <div>
      {/* Scenario picker */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: c.textFaint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Scenario
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRESETS.map(p => {
            const active = !customSwaps && p.id === scenarioId
            return (
              <button
                key={p.id}
                onClick={() => { setScenarioId(p.id); setCustomSwaps(null) }}
                title={p.description}
                style={{
                  background: active ? c.surfaceHover : c.surface,
                  border: `1px solid ${active ? c.accent : c.border}`,
                  color: active ? c.text : c.textMuted,
                  borderRadius: 4,
                  padding: '6px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {p.name}
              </button>
            )
          })}
          <button
            onClick={() => setCustomSwaps(activeSwaps.length ? activeSwaps : [{ from_contains: 'sonnet', to: 'claude-haiku-4-5' }])}
            style={{
              background: customSwaps ? c.surfaceHover : c.surface,
              border: `1px solid ${customSwaps ? c.accent : c.border}`,
              color: customSwaps ? c.text : c.textMuted,
              borderRadius: 4,
              padding: '6px 12px',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: customSwaps ? 600 : 400,
            }}
          >
            ⚙ Custom
          </button>
        </div>
        {!customSwaps && (
          <div style={{ color: c.textGhost, fontSize: 11, marginTop: 6 }}>
            {PRESETS.find(p => p.id === scenarioId)?.description}
          </div>
        )}
      </div>

      {/* Custom swap editor */}
      {customSwaps && (
        <CustomSwapEditor
          swaps={customSwaps}
          onChange={setCustomSwaps}
          availableModels={availableModels}
        />
      )}

      {/* Headline cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard
          label="Your Actual Cost"
          value={`$${result.original_cost.toFixed(2)}`}
          sub={`${events.length} messages`}
        />
        <StatCard
          label="Simulated Cost"
          value={`$${result.simulated_cost.toFixed(2)}`}
          sub={`${result.affected_events} swapped`}
          color={c.accent}
        />
        <StatCard
          label={result.savings >= 0 ? 'Savings' : 'Extra Cost'}
          value={`$${Math.abs(result.savings).toFixed(2)}`}
          sub={`${result.savings_pct >= 0 ? '−' : '+'}${Math.abs(result.savings_pct).toFixed(1)}%`}
          color={savingsColor}
          highlight
        />
      </div>

      {/* Breakdown table */}
      <div style={{
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 6, overflow: 'hidden',
      }}>
        <div style={{
          color: c.accent, fontSize: 12, fontWeight: 600,
          padding: '12px 16px', textTransform: 'uppercase', letterSpacing: 0.5,
          borderBottom: `1px solid ${c.border}`,
        }}>
          Breakdown by Original Model
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Model</th>
              <th style={{ ...th, textAlign: 'right' }}>Events</th>
              <th style={{ ...th, textAlign: 'right' }}>Original</th>
              <th style={{ ...th, textAlign: 'right' }}>Simulated</th>
              <th style={{ ...th, textAlign: 'right' }}>Delta</th>
            </tr>
          </thead>
          <tbody>
            {result.by_original_model.map(row => {
              const delta = row.simulated - row.original
              return (
                <tr key={row.model}>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{row.model.replace(/^claude-/, '')}</td>
                  <td style={tdNum}>{row.events}</td>
                  <td style={tdNum}>${row.original.toFixed(4)}</td>
                  <td style={tdNum}>${row.simulated.toFixed(4)}</td>
                  <td style={{
                    ...tdNum,
                    color: delta < 0 ? c.success : delta > 0 ? c.error : c.textMuted,
                    fontWeight: 600,
                  }}>
                    {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}$${delta.toFixed(4)}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Custom swap editor ──────────────────────────────────────────────────────

function CustomSwapEditor({
  swaps, onChange, availableModels,
}: {
  swaps: ModelSwap[]
  onChange: (next: ModelSwap[]) => void
  availableModels: string[]
}) {
  const addSwap = () =>
    onChange([...swaps, { from_contains: '', to: availableModels[0] ?? 'claude-haiku-4-5' }])
  const removeSwap = (idx: number) => onChange(swaps.filter((_, i) => i !== idx))
  const updateSwap = (idx: number, patch: Partial<ModelSwap>) =>
    onChange(swaps.map((s, i) => (i === idx ? { ...s, ...patch } : s)))

  return (
    <div style={{
      background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6,
      padding: 16, marginBottom: 20,
    }}>
      <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Custom Swaps
      </div>
      <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 12, lineHeight: 1.5 }}>
        Each rule routes any event whose model name <em>contains</em> the pattern to the target.
        First matching rule wins.
      </div>

      {swaps.length === 0 && (
        <div style={{ color: c.textGhost, fontSize: 12, marginBottom: 12 }}>
          No rules — baseline cost will be shown.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {swaps.map((sw, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={sw.from_contains}
              onChange={e => updateSwap(i, { from_contains: e.target.value })}
              placeholder="e.g. opus"
              style={{
                flex: 1, background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: 3, color: c.text, padding: '5px 8px', fontSize: 12,
                fontFamily: 'monospace', outline: 'none',
              }}
            />
            <span style={{ color: c.textFaint, fontSize: 14 }}>→</span>
            <select
              value={sw.to}
              onChange={e => updateSwap(i, { to: e.target.value })}
              style={{
                flex: 2, background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: 3, color: c.text, padding: '5px 8px', fontSize: 12,
                fontFamily: 'monospace', outline: 'none',
              }}
            >
              {availableModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              onClick={() => removeSwap(i)}
              aria-label="Remove rule"
              style={{
                background: 'transparent', border: `1px solid ${c.borderSoft}`,
                color: c.textFaint, borderRadius: 3, padding: '3px 8px',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addSwap}
        style={{
          marginTop: 10,
          background: 'transparent', border: `1px dashed ${c.border}`,
          color: c.textMuted, borderRadius: 3, padding: '5px 12px',
          fontSize: 11, cursor: 'pointer', width: '100%',
        }}
      >
        + Add swap rule
      </button>
    </div>
  )
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
const tdNum: React.CSSProperties = {
  ...td,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}
