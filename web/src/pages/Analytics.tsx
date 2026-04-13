import { useState } from 'react'
import type { StatsData, UsageEvent } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { SubTabBar } from '../components/SubTabBar'
import { Forecast } from './insights/Forecast'
import { Heatmap } from './insights/Heatmap'
import { WhatIf } from './insights/WhatIf'
import { ReportsPage } from './Reports'

const SUB_TABS = ['Reports', 'Forecast', 'Heatmap', 'What-If'] as const
type SubTab = typeof SUB_TABS[number]

interface Props {
  stats: StatsData
  events: UsageEvent[]
}

export function Analytics({ stats, events }: Props) {
  const [sub, setSub] = useState<SubTab>('Reports')

  return (
    <div>
      <SectionHeader
        title="Analytics"
        sub="Tabular reports, forecasts, year-calendar heatmap, and what-if cost simulations — all computed locally in WASM"
      />
      <SubTabBar tabs={SUB_TABS} active={sub} onChange={setSub} iconFor={iconFor} />

      {sub === 'Reports'  && <ReportsPage events={events} />}
      {sub === 'Forecast' && <Forecast stats={stats} events={events} />}
      {sub === 'Heatmap'  && <Heatmap stats={stats} events={events} />}
      {sub === 'What-If'  && <WhatIf events={events} />}
    </div>
  )
}

function iconFor(name: SubTab): string {
  switch (name) {
    case 'Reports':  return '📊'
    case 'Forecast': return '🔮'
    case 'Heatmap':  return '📅'
    case 'What-If':  return '🧪'
  }
}
