import type { StatsData, UsageEvent } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { SubTabBar } from '../components/SubTabBar'
import { Forecast } from './insights/Forecast'
import { Heatmap } from './insights/Heatmap'
import { WhatIf } from './insights/WhatIf'
import { ReportsPage } from './Reports'

const SUB_TABS = ['Reports', 'Forecast', 'Heatmap', 'What-If'] as const
type SubTab = typeof SUB_TABS[number]
const DEFAULT_SUB: SubTab = 'Reports'

interface Props {
  stats: StatsData
  events: UsageEvent[]
  /** Controlled sub-tab name (from the hash route). Invalid/missing → default. */
  sub?: string
  /** Called when the user clicks a sub-tab button. */
  onSubChange: (next: string) => void
}

export function Analytics({ stats, events, sub, onSubChange }: Props) {
  const active: SubTab = SUB_TABS.includes(sub as SubTab) ? (sub as SubTab) : DEFAULT_SUB

  return (
    <div>
      <SectionHeader
        title="Analytics"
        sub="Tabular reports, forecasts, year-calendar heatmap, and what-if cost simulations — all computed locally in WASM"
      />
      <SubTabBar
        tabs={SUB_TABS}
        active={active}
        onChange={s => onSubChange(s)}
        iconFor={iconFor}
      />

      {active === 'Reports'  && <ReportsPage events={events} />}
      {active === 'Forecast' && <Forecast stats={stats} events={events} />}
      {active === 'Heatmap'  && <Heatmap stats={stats} events={events} />}
      {active === 'What-If'  && <WhatIf events={events} />}
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
