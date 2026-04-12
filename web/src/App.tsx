import { useState, useEffect } from 'react'
import { api } from './api'
import type { DashboardData } from './api'
import { Stats } from './pages/Stats'
import { Usage } from './pages/Usage'
import { Projects } from './pages/Projects'
import { Plugins } from './pages/Plugins'
import { Todos } from './pages/Todos'
import { Sessions } from './pages/Sessions'
import { Settings } from './pages/Settings'

const TABS = ['Stats', 'Usage', 'Projects', 'Plugins', 'Todos', 'Sessions', 'Settings'] as const
type Tab = typeof TABS[number]

export default function App() {
  const [tab, setTab] = useState<Tab>('Stats')
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      const d = await api.all()
      setData(d)
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => { load() }, [])

  const refresh = async () => {
    setRefreshing(true)
    await api.refresh()
    await load()
    setRefreshing(false)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0d0d', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: 180, background: '#111', borderRight: '1px solid #222', padding: '16px 0', flexShrink: 0, position: 'relative' }}>
        <div style={{ padding: '0 16px 20px', color: '#7c6af7', fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>
          Claude Dashboard
        </div>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '9px 16px',
              background: tab === t ? '#1e1e1e' : 'transparent',
              color: tab === t ? '#e8e8e8' : '#666',
              border: 'none',
              borderLeft: tab === t ? '2px solid #7c6af7' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t}
          </button>
        ))}

        <div style={{ padding: '0 12px', position: 'absolute', bottom: 16, width: '100%', boxSizing: 'border-box' }}>
          <button
            onClick={refresh}
            disabled={refreshing}
            style={{
              background: '#1e1e1e',
              border: '1px solid #333',
              color: refreshing ? '#555' : '#aaa',
              borderRadius: 4,
              padding: '6px 12px',
              cursor: refreshing ? 'default' : 'pointer',
              fontSize: 12,
              width: '100%',
            }}
          >
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {error && (
          <div style={{ background: '#2a1010', border: '1px solid #5a1a1a', borderRadius: 6, padding: 16, marginBottom: 20, color: '#f44336' }}>
            <strong>Error loading data:</strong> {error}
            <div style={{ marginTop: 8, color: '#aaa', fontSize: 12 }}>
              Make sure the Rust backend is running:{' '}
              <code style={{ background: '#1e1e1e', padding: '1px 6px', borderRadius: 3 }}>cargo run -- serve</code>
            </div>
          </div>
        )}

        {data ? (
          <>
            {tab === 'Stats' && <Stats data={data.stats} />}
            {tab === 'Usage' && <Usage data={data.usage} />}
            {tab === 'Projects' && <Projects data={data.projects} />}
            {tab === 'Plugins' && <Plugins data={data.plugins} />}
            {tab === 'Todos' && <Todos data={data.todos} />}
            {tab === 'Sessions' && <Sessions data={data.sessions} />}
            {tab === 'Settings' && <Settings data={data.settings} />}
          </>
        ) : !error ? (
          <div style={{ color: '#555', padding: 40 }}>Loading…</div>
        ) : null}
      </div>
    </div>
  )
}
