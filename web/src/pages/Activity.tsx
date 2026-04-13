import type { DashboardData } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { SubTabBar } from '../components/SubTabBar'
import { Sessions } from './Sessions'
import { Usage } from './Usage'
import { Todos } from './Todos'

const SUB_TABS = ['Sessions', 'Usage', 'Todos'] as const
type SubTab = typeof SUB_TABS[number]
const DEFAULT_SUB: SubTab = 'Sessions'

interface Props {
  data: DashboardData
  sub?: string
  onSubChange: (next: string) => void
}

export function Activity({ data, sub, onSubChange }: Props) {
  const active: SubTab = SUB_TABS.includes(sub as SubTab) ? (sub as SubTab) : DEFAULT_SUB

  return (
    <div>
      <SectionHeader
        title="Activity"
        sub="Things you and Claude have worked on — sessions, usage facets, todos and plans"
      />
      <SubTabBar tabs={SUB_TABS} active={active} onChange={onSubChange} iconFor={iconFor} />

      {active === 'Sessions' && <Sessions data={data.sessions} />}
      {active === 'Usage'    && <Usage    data={data.usage} />}
      {active === 'Todos'    && <Todos    data={data.todos} />}
    </div>
  )
}

function iconFor(name: SubTab): string {
  switch (name) {
    case 'Sessions': return '💬'
    case 'Usage':    return '📈'
    case 'Todos':    return '✓'
  }
}
