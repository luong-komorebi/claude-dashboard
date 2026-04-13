import { useState } from 'react'
import type { DashboardData } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { SubTabBar } from '../components/SubTabBar'
import { Settings } from './Settings'
import { Plugins } from './Plugins'

const SUB_TABS = ['Settings', 'Plugins'] as const
type SubTab = typeof SUB_TABS[number]

interface Props {
  data: DashboardData
}

export function Config({ data }: Props) {
  const [sub, setSub] = useState<SubTab>('Settings')

  return (
    <div>
      <SectionHeader
        title="Config"
        sub="Claude Code configuration — allowed tools, effort level, plugins, and recent command history"
      />
      <SubTabBar tabs={SUB_TABS} active={sub} onChange={setSub} iconFor={iconFor} />

      {sub === 'Settings' && <Settings data={data.settings} />}
      {sub === 'Plugins'  && <Plugins  data={data.plugins} />}
    </div>
  )
}

function iconFor(name: SubTab): string {
  switch (name) {
    case 'Settings': return '⚙'
    case 'Plugins':  return '🧩'
  }
}
