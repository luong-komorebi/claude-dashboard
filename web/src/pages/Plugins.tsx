import type { Plugin } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'
import { c } from '../theme/colors'

function splitId(id: string): [string, string] {
  const pos = id.lastIndexOf('@')
  return pos >= 0 ? [id.slice(0, pos), id.slice(pos + 1)] : [id, '']
}

export function Plugins({ data }: { data: Plugin[] }) {
  const enabled = data.filter(p => p.enabled)
  const disabled = data.filter(p => !p.enabled)

  return (
    <div>
      <SectionHeader title="Plugins" sub="Installed Claude Code plugins and their enabled status" />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="Total Installed" value={data.length} highlight />
        <StatCard label="Enabled" value={enabled.length} sub="active" />
        <StatCard label="Disabled" value={disabled.length} sub="inactive" />
      </div>

      {enabled.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: c.success, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Enabled</div>
          <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, overflow: 'hidden' }}>
            {enabled.map(p => {
              const [name, registry] = splitId(p.id)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: `1px solid ${c.surfaceHover}` }}>
                  <span style={{ color: c.success, fontSize: 14 }}>✓</span>
                  <span style={{ color: c.text, fontWeight: 500 }}>{name}</span>
                  <span style={{ color: c.textGhost, fontSize: 12 }}>@{registry}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {disabled.length > 0 && (
        <div>
          <div style={{ color: c.textGhost, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Disabled</div>
          <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, overflow: 'hidden' }}>
            {disabled.map(p => {
              const [name, registry] = splitId(p.id)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: `1px solid ${c.surfaceHover}`, opacity: 0.5 }}>
                  <span style={{ color: c.textGhost, fontSize: 14 }}>✗</span>
                  <span style={{ color: c.textMuted }}>{name}</span>
                  <span style={{ color: c.textDisabled, fontSize: 12 }}>@{registry}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
