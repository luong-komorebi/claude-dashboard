import { useState } from 'react'
import type { StatsData, UsageEvent } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { c } from '../theme/colors'
import { Forecast } from './insights/Forecast'
import { Heatmap } from './insights/Heatmap'
import { WhatIf } from './insights/WhatIf'

const SUB_TABS = ['Forecast', 'Heatmap', 'What-If'] as const
type SubTab = typeof SUB_TABS[number]

interface Props {
  stats: StatsData
  events: UsageEvent[]
}

export function Insights({ stats, events }: Props) {
  const [sub, setSub] = useState<SubTab>('Forecast')

  return (
    <div>
      <SectionHeader
        title="Insights"
        sub="Forecasts, anomalies, calendar heatmap, and what-if cost simulations — all computed locally in WASM"
      />

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${c.border}` }}>
        {SUB_TABS.map(name => (
          <button
            key={name}
            onClick={() => setSub(name)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${sub === name ? c.accent : 'transparent'}`,
              color: sub === name ? c.text : c.textFaint,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: sub === name ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {iconFor(name)} {name}
          </button>
        ))}
      </div>

      {sub === 'Forecast' && <Forecast stats={stats} events={events} />}
      {sub === 'Heatmap'  && <Heatmap stats={stats} events={events} />}
      {sub === 'What-If'  && <WhatIf events={events} />}
    </div>
  )
}

function iconFor(name: SubTab): string {
  switch (name) {
    case 'Forecast': return '🔮'
    case 'Heatmap':  return '📅'
    case 'What-If':  return '🧪'
  }
}
