import { useState } from 'react'
import type { DashboardData } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { SubTabBar } from '../components/SubTabBar'
import { Settings } from './Settings'
import { Plugins } from './Plugins'
import { Account } from './Account'
import { Customizations } from './Customizations'

const SUB_TABS = ['Account', 'Settings', 'Plugins', 'Customizations'] as const
type SubTab = typeof SUB_TABS[number]

interface Props {
  data: DashboardData
  onPickAccountFile: () => void
  onOnlineModeChange: () => void
}

export function Config({ data, onPickAccountFile, onOnlineModeChange }: Props) {
  const [sub, setSub] = useState<SubTab>('Account')

  return (
    <div>
      <SectionHeader
        title="Config"
        sub="Claude Code configuration — account, permissions, plugins, custom commands and skills"
      />
      <SubTabBar tabs={SUB_TABS} active={sub} onChange={setSub} iconFor={iconFor} />

      {sub === 'Account'  && <Account  account={data.account} events={data.usage_events} projectPaths={data.project_paths} onPickAccountFile={onPickAccountFile} />}
      {sub === 'Settings' && <Settings data={data.settings} onOnlineModeChange={onOnlineModeChange} />}
      {sub === 'Plugins'  && <Plugins  data={data.plugins} />}
      {sub === 'Customizations' && <Customizations commands={data.commands} skills={data.skills} connectedIdes={data.connectedIdes} />}
    </div>
  )
}

function iconFor(name: SubTab): string {
  switch (name) {
    case 'Account':        return '👤'
    case 'Settings':       return '⚙'
    case 'Plugins':        return '🧩'
    case 'Customizations': return '✨'
  }
}
