import type { DashboardData } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { SubTabBar } from '../components/SubTabBar'
import { Settings } from './Settings'
import { Plugins } from './Plugins'
import { Account } from './Account'
import { Customizations } from './Customizations'

const SUB_TABS = ['Account', 'Settings', 'Plugins', 'Customizations'] as const
type SubTab = typeof SUB_TABS[number]
const DEFAULT_SUB: SubTab = 'Account'

interface Props {
  data: DashboardData
  sub?: string
  onSubChange: (next: string) => void
  onPickAccountFile: () => void
  onOnlineModeChange: () => void
}

export function Config({ data, sub, onSubChange, onPickAccountFile, onOnlineModeChange }: Props) {
  const active: SubTab = SUB_TABS.includes(sub as SubTab) ? (sub as SubTab) : DEFAULT_SUB

  return (
    <div>
      <SectionHeader
        title="Config"
        sub="Claude Code configuration — account, permissions, plugins, custom commands and skills"
      />
      <SubTabBar tabs={SUB_TABS} active={active} onChange={onSubChange} iconFor={iconFor} />

      {active === 'Account'  && <Account  account={data.account} events={data.usage_events} projectPaths={data.project_paths} onPickAccountFile={onPickAccountFile} />}
      {active === 'Settings' && <Settings data={data.settings} onOnlineModeChange={onOnlineModeChange} />}
      {active === 'Plugins'  && <Plugins  data={data.plugins} />}
      {active === 'Customizations' && <Customizations commands={data.commands} skills={data.skills} connectedIdes={data.connectedIdes} />}
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
