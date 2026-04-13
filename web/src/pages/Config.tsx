import { useState } from 'react'
import type { DashboardData } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { SubTabBar } from '../components/SubTabBar'
import { Settings } from './Settings'
import { Plugins } from './Plugins'
import { Account } from './Account'

const SUB_TABS = ['Account', 'Settings', 'Plugins'] as const
type SubTab = typeof SUB_TABS[number]

interface Props {
  data: DashboardData
  onPickAccountFile: () => void
}

export function Config({ data, onPickAccountFile }: Props) {
  const [sub, setSub] = useState<SubTab>('Account')

  return (
    <div>
      <SectionHeader
        title="Config"
        sub="Claude Code configuration — account, allowed tools, effort level, plugins, and recent command history"
      />
      <SubTabBar tabs={SUB_TABS} active={sub} onChange={setSub} iconFor={iconFor} />

      {sub === 'Account'  && <Account  account={data.account} events={data.usage_events} projectPaths={data.project_paths} onPickAccountFile={onPickAccountFile} />}
      {sub === 'Settings' && <Settings data={data.settings} />}
      {sub === 'Plugins'  && <Plugins  data={data.plugins} />}
    </div>
  )
}

function iconFor(name: SubTab): string {
  switch (name) {
    case 'Account':  return '👤'
    case 'Settings': return '⚙'
    case 'Plugins':  return '🧩'
  }
}
