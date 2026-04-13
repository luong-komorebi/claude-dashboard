import { useState } from 'react'
import type { DashboardData } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { SubTabBar } from '../components/SubTabBar'
import { Sessions } from './Sessions'
import { Usage } from './Usage'
import { Todos } from './Todos'

const SUB_TABS = ['Sessions', 'Usage', 'Todos'] as const
type SubTab = typeof SUB_TABS[number]

interface Props {
  data: DashboardData
}

export function Activity({ data }: Props) {
  const [sub, setSub] = useState<SubTab>('Sessions')

  return (
    <div>
      <SectionHeader
        title="Activity"
        sub="Things you and Claude have worked on — sessions, usage facets, todos and plans"
      />
      <SubTabBar tabs={SUB_TABS} active={sub} onChange={setSub} iconFor={iconFor} />

      {sub === 'Sessions' && <Sessions data={data.sessions} />}
      {sub === 'Usage'    && <Usage    data={data.usage} />}
      {sub === 'Todos'    && <Todos    data={data.todos} />}
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
