import { useState, useEffect, useRef } from 'react'
import type { DashboardData } from './api'
import type { WorkerResponse } from './worker/parser.worker'
import { pickClaudeDir, getStoredDir, clearHandle, ensurePermission } from './fs-access'
import { saveToOpfs, loadFromOpfs, clearOpfsCache, cleanupLegacyCache } from './opfs'
import { isStoragePersisted, requestPersistence } from './persistence'
import { useInstallPrompt, useOnlineStatus, useIsStandalone } from './pwa'
import { createSyncChannel, broadcast, withParseLock, type SyncMessage } from './sync'
import { exportDashboard } from './export'
import { Overview } from './pages/Overview'
import { Usage } from './pages/Usage'
import { Projects } from './pages/Projects'
import { Plugins } from './pages/Plugins'
import { Todos } from './pages/Todos'
import { Sessions } from './pages/Sessions'
import { Settings } from './pages/Settings'
import { ReportsPage } from './pages/Reports'
import { Insights } from './pages/Insights'
import { PrivacyBadge } from './components/PrivacyBadge'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { SupportButton } from './components/SupportButton'
import { c } from './theme/colors'

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = ['Overview', 'Insights', 'Reports', 'Usage', 'Sessions', 'Projects', 'Plugins', 'Todos', 'Settings'] as const
type Tab = typeof TABS[number]

// ─── State machine ───────────────────────────────────────────────────────────

type AppState =
  | { phase: 'checking' }
  | { phase: 'pick' }
  | { phase: 'loading' }
  | { phase: 'reconnect'; dir: FileSystemDirectoryHandle; name: string }
  | { phase: 'ready'; data: DashboardData; dir: FileSystemDirectoryHandle; stale: boolean; cachedAt?: number; needsPermission?: boolean }
  | { phase: 'error'; message: string }

// ─── Worker helper ────────────────────────────────────────────────────────────

function parseInWorker(dir: FileSystemDirectoryHandle): Promise<DashboardData> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./worker/parser.worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      worker.terminate()
      if (e.data.ok) resolve(e.data.data)
      else reject(new Error(e.data.error))
    }
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message)) }
    worker.postMessage(dir)
  })
}

// ─── View Transition helper ───────────────────────────────────────────────────

function startTransition(cb: () => void) {
  if ('startViewTransition' in document) {
    document.startViewTransition(cb)
  } else {
    cb()
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, setState] = useState<AppState>({ phase: 'checking' })
  const [tab, setTab] = useState<Tab>('Overview')
  const [refreshing, setRefreshing] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const tabIndexRef = useRef(TABS.indexOf('Overview'))
  const channelRef = useRef<BroadcastChannel | null>(null)

  const { canInstall, install } = useInstallPrompt()
  const online = useOnlineStatus()
  const isStandalone = useIsStandalone()

  // ── Startup: cleanup legacy cache, try persistent storage, open sync channel, load data
  useEffect(() => {
    let cancelled = false
    void cleanupLegacyCache()

    // Opportunistic silent request — Chrome/Edge auto-grant if eligible
    // (installed PWA, high engagement, etc). Firefox shows a prompt, which
    // we skip here because there's no user gesture yet — the explicit button
    // in PrivacyBadge handles that case.
    void isStoragePersisted().then(already => {
      if (!already) void requestPersistence()
    })

    // Multi-tab sync channel — listens for "refreshed" from other tabs
    const channel = createSyncChannel()
    channelRef.current = channel
    channel.onmessage = async (e: MessageEvent<SyncMessage>) => {
      if (e.data.type === 'refreshed') {
        const cached = await loadFromOpfs()
        if (cached && !cancelled) {
          setState(prev => prev.phase === 'ready'
            ? { phase: 'ready', data: cached.data, dir: prev.dir, stale: false }
            : prev)
        }
      } else if (e.data.type === 'cleared' && !cancelled) {
        setState({ phase: 'pick' })
      }
    }

    getStoredDir().then(async stored => {
      if (!stored) {
        if (!cancelled) setState({ phase: 'pick' })
        return
      }

      const { handle: dir, permission } = stored

      // Permission not granted yet — we can't call requestPermission() here
      // because it requires a user gesture. Instead, show cached data (if
      // any) with a "needs reconnect" flag, or jump straight to a reconnect
      // screen if there's no cache.
      if (permission !== 'granted') {
        const cached = await loadFromOpfs()
        if (cancelled) return
        if (cached) {
          setState({
            phase: 'ready',
            data: cached.data,
            dir,
            stale: true,
            cachedAt: cached.cachedAt,
            needsPermission: true,
          })
        } else {
          setState({ phase: 'reconnect', dir, name: dir.name })
        }
        return
      }

      // Permission granted — stale-while-revalidate as usual
      const cached = await loadFromOpfs()
      if (cached && !cancelled) {
        setState({ phase: 'ready', data: cached.data, dir, stale: true, cachedAt: cached.cachedAt })
      } else if (!cancelled) {
        setState({ phase: 'loading' })
      }

      try {
        const data = await withParseLock(() => parseInWorker(dir))
        if (!cancelled) {
          await saveToOpfs(data)
          setState({ phase: 'ready', data, dir, stale: false })
          broadcast(channel, { type: 'refreshed', cachedAt: Date.now() })
        }
      } catch (e) {
        if (!cancelled && !cached) {
          setState({ phase: 'error', message: String(e) })
        }
      }
    })

    return () => {
      cancelled = true
      channel.close()
      channelRef.current = null
    }
  }, [])

  // ── Badging API: reflect in-progress + pending todos on the app icon
  useEffect(() => {
    if (!navigator.setAppBadge) return
    if (state.phase !== 'ready') return
    const count = state.data.todos.in_progress_count + state.data.todos.pending_count
    if (count > 0) {
      void navigator.setAppBadge(count)
    } else {
      void navigator.clearAppBadge?.()
    }
  }, [state])

  // ── Handlers

  const grantAccess = async () => {
    try {
      const dir = await pickClaudeDir()
      setState({ phase: 'loading' })
      const data = await withParseLock(() => parseInWorker(dir))
      await saveToOpfs(data)
      setState({ phase: 'ready', data, dir, stale: false })
      if (channelRef.current) broadcast(channelRef.current, { type: 'refreshed', cachedAt: Date.now() })
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setState({ phase: 'pick' })
      } else {
        setState({ phase: 'error', message: String(e) })
      }
    }
  }

  const refresh = async () => {
    if (state.phase !== 'ready' || refreshing) return
    setRefreshing(true)
    try {
      // Escalate permission if needed — this call is inside a click handler,
      // so the browser allows requestPermission() to prompt the user.
      const ok = await ensurePermission(state.dir)
      if (!ok) {
        setRefreshing(false)
        return
      }
      const data = await withParseLock(() => parseInWorker(state.dir))
      await saveToOpfs(data)
      setState({ phase: 'ready', data, dir: state.dir, stale: false })
      if (channelRef.current) broadcast(channelRef.current, { type: 'refreshed', cachedAt: Date.now() })
    } catch (e) {
      setState({ phase: 'error', message: String(e) })
    } finally {
      setRefreshing(false)
    }
  }

  const reconnect = async () => {
    if (state.phase !== 'reconnect') return
    const ok = await ensurePermission(state.dir)
    if (!ok) return // user denied — stay on reconnect screen
    setState({ phase: 'loading' })
    try {
      const data = await withParseLock(() => parseInWorker(state.dir))
      await saveToOpfs(data)
      setState({ phase: 'ready', data, dir: state.dir, stale: false })
      if (channelRef.current) broadcast(channelRef.current, { type: 'refreshed', cachedAt: Date.now() })
    } catch (e) {
      setState({ phase: 'error', message: String(e) })
    }
  }

  const reset = async () => {
    await clearHandle()
    await clearOpfsCache()
    if (navigator.clearAppBadge) void navigator.clearAppBadge()
    if (channelRef.current) broadcast(channelRef.current, { type: 'cleared' })
    setState({ phase: 'pick' })
  }

  const exportData = async () => {
    if (state.phase !== 'ready') return
    try {
      const result = await exportDashboard(state.data)
      if (result === 'saved') {
        setExportStatus('✓ Exported')
        setTimeout(() => setExportStatus(null), 2000)
      }
    } catch (e) {
      setExportStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`)
      setTimeout(() => setExportStatus(null), 3000)
    }
  }

  const changeTab = (next: Tab) => {
    const nextIdx = TABS.indexOf(next)
    document.documentElement.style.setProperty(
      '--vt-dir',
      String(nextIdx >= tabIndexRef.current ? 1 : -1),
    )
    tabIndexRef.current = nextIdx
    startTransition(() => setTab(next))
  }

  // ── Render: loading / pick / error screens

  if (state.phase === 'checking' || state.phase === 'loading') {
    return (
      <div style={centered}>
        <div style={{ color: c.accent, fontSize: 14 }}>
          {state.phase === 'checking' ? 'Checking permissions…' : 'Loading ~/.claude…'}
        </div>
      </div>
    )
  }

  if (state.phase === 'pick') {
    return (
      <div style={centered}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ color: c.accent, fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Claude Dashboard</div>
          <div style={{ color: c.textGhost, fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>
            Reads your <code style={code}>~/.claude</code> folder directly in the browser.
            Nothing is uploaded or stored remotely. Pick either <code style={code}>.claude</code> or
            any parent folder containing it (like your home folder).
          </div>

          <button onClick={grantAccess} style={primaryBtn}>
            Open ~/.claude folder
          </button>

          <div style={{ marginTop: 20 }}>
            <PrivacyBadge variant="full" />
          </div>

          {canInstall && !isStandalone && (
            <div style={{
              marginTop: 12,
              display: 'flex', alignItems: 'center', gap: 10,
              background: c.surface, border: `1px solid ${c.border}`,
              borderLeft: `3px solid ${c.accent}`,
              borderRadius: 4, padding: '10px 14px',
              fontSize: 12, color: c.textMuted, textAlign: 'left',
            }}>
              <span style={{ flex: 1, lineHeight: 1.5 }}>
                <strong style={{ color: c.text }}>Install for offline use:</strong>{' '}
                adds the dashboard to your dock/launcher and makes it work without internet forever.
              </span>
              <button
                onClick={install}
                style={{
                  background: c.accent, color: c.accentFg, border: 'none',
                  borderRadius: 3, padding: '6px 12px', fontSize: 11,
                  fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Install
              </button>
            </div>
          )}

          <div style={{ marginTop: 20, textAlign: 'left', background: c.surface, border: `1px solid ${c.borderSoft}`, borderRadius: 8, padding: 20 }}>
            <div style={{ color: c.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>How to navigate to the folder</div>
            {[
              { os: 'macOS', steps: [
                <>Click <strong style={{ color: c.text }}>Open ~/.claude folder</strong> above</>,
                <>In the picker, press <kbd style={kbd}>⌘ Shift .</kbd> to reveal hidden folders</>,
                <>Navigate to your <strong style={{ color: c.text }}>home folder</strong> (click your username in the sidebar)</>,
                <>Select the <code style={code}>.claude</code> folder and click <strong style={{ color: c.text }}>Open</strong></>,
              ]},
              { os: 'Windows', steps: [
                <>Click <strong style={{ color: c.text }}>Open ~/.claude folder</strong> above</>,
                <>In the address bar, type <code style={code}>%USERPROFILE%\.claude</code> and press Enter</>,
                <>Click <strong style={{ color: c.text }}>Select Folder</strong></>,
              ]},
            ].map(({ os, steps }) => (
              <div key={os} style={{ marginBottom: 16 }}>
                <div style={{ color: c.accent, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{os}</div>
                <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {steps.map((step, i) => (
                    <li key={i} style={{ color: c.textFaint, fontSize: 13, lineHeight: 1.5 }}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
            <div style={{ marginTop: 8, padding: '10px 12px', background: c.bg, borderRadius: 6, borderLeft: `2px solid ${c.border}` }}>
              <span style={{ color: c.textGhost, fontSize: 12 }}>Typically: </span>
              <code style={{ ...code, fontSize: 12 }}>/Users/&lt;name&gt;/.claude</code>
              <span style={{ color: c.textGhost, fontSize: 12 }}> on macOS, </span>
              <code style={{ ...code, fontSize: 12 }}>C:\Users\&lt;name&gt;\.claude</code>
              <span style={{ color: c.textGhost, fontSize: 12 }}> on Windows</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (state.phase === 'reconnect') {
    return (
      <div style={centered}>
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          <div style={{ color: c.accent, fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
            Reconnect your folder
          </div>
          <div style={{ color: c.textGhost, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
            Browser security resets folder permissions between visits. Click below
            to grant this tab read access to <code style={code}>{state.name}</code> again.
            Your handle is still remembered — you won't have to navigate through the picker.
          </div>
          <button onClick={reconnect} style={primaryBtn}>
            Reconnect to {state.name}
          </button>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={reset}
              style={{
                background: 'transparent', border: 'none', color: c.textFaint,
                fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              Or pick a different folder
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div style={centered}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ color: c.error, marginBottom: 12 }}>{state.message}</div>
          <button onClick={() => setState({ phase: 'pick' })} style={primaryBtn}>Try again</button>
        </div>
      </div>
    )
  }

  // ── Ready: full dashboard

  const { data, stale, cachedAt, needsPermission } = state
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: c.bg, color: c.text, fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: 180, background: c.surface, borderRight: `1px solid ${c.borderSoft}`, padding: '16px 0', flexShrink: 0, position: 'relative' }}>
        <div style={{ padding: '0 16px 20px', color: c.accent, fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>
          Claude Dashboard
        </div>
        {TABS.map(t => (
          <button key={t} onClick={() => changeTab(t)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '9px 16px', background: tab === t ? c.surfaceHover : 'transparent',
            color: tab === t ? c.text : c.textFaint, border: 'none',
            borderLeft: tab === t ? `2px solid ${c.accent}` : '2px solid transparent',
            cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400,
          }}>
            {t}
          </button>
        ))}

        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {canInstall && !isStandalone && (
            <button
              onClick={install}
              style={{
                background: c.accent, color: c.accentFg, border: 'none',
                borderRadius: 4, padding: '6px 12px', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, width: '100%',
              }}
              title="Install as standalone app for offline use"
            >
              ↓ Install app
            </button>
          )}
          {!online && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: c.surfaceHover, border: `1px solid ${c.warning}`,
                borderRadius: 4, padding: '5px 8px',
                fontSize: 10, color: c.warning, lineHeight: 1.3,
              }}
              title="Your device is offline, but this dashboard works fully offline — nothing is lost."
            >
              <span>●</span>
              <span>Offline · all features work</span>
            </div>
          )}
          <PrivacyBadge />
          {needsPermission && (
            <div style={{
              color: c.warning,
              fontSize: 10,
              textAlign: 'center',
              padding: '4px 6px',
              background: c.errorBg,
              border: `1px solid ${c.errorBorder}`,
              borderRadius: 4,
              lineHeight: 1.3,
            }}>
              Permission expired — click Refresh to reconnect
            </div>
          )}
          {stale && !needsPermission && (
            <div style={{ color: c.textGhost, fontSize: 10, textAlign: 'center', marginBottom: 2 }}>
              {refreshing ? '↻ Updating…' : cachedAt ? `cached ${new Date(cachedAt).toLocaleTimeString()}` : 'stale'}
            </div>
          )}
          <button onClick={refresh} disabled={refreshing} style={{
            background: c.surfaceHover, border: `1px solid ${c.border}`,
            color: refreshing ? c.textGhost : c.textMuted, borderRadius: 4,
            padding: '6px 12px', cursor: refreshing ? 'default' : 'pointer',
            fontSize: 12, width: '100%',
          }}>
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <button onClick={exportData} style={{
            background: 'transparent', border: `1px solid ${c.borderSoft}`,
            color: exportStatus ? c.success : c.textFaint, borderRadius: 4,
            padding: '5px 12px', cursor: 'pointer', fontSize: 11, width: '100%',
          }}>
            {exportStatus ?? '↓ Export JSON'}
          </button>
          <button onClick={reset} style={{
            background: 'transparent', border: `1px solid ${c.borderSoft}`,
            color: c.textDisabled, borderRadius: 4, padding: '5px 12px',
            cursor: 'pointer', fontSize: 11, width: '100%',
          }}>
            Change folder
          </button>
          <ThemeSwitcher />
        </div>
      </div>

      {/* Main content — view-transition-name is set via .tab-content class */}
      <div className="tab-content" style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {tab === 'Overview'  && <Overview  stats={data.stats} events={data.usage_events} onDrillDown={changeTab} />}
        {tab === 'Insights'  && <Insights  stats={data.stats} events={data.usage_events} />}
        {tab === 'Reports'   && <ReportsPage events={data.usage_events} />}
        {tab === 'Usage'     && <Usage     data={data.usage} />}
        {tab === 'Sessions'  && <Sessions  data={data.sessions} />}
        {tab === 'Projects'  && <Projects  data={data.projects} />}
        {tab === 'Plugins'   && <Plugins   data={data.plugins} />}
        {tab === 'Todos'     && <Todos     data={data.todos} />}
        {tab === 'Settings'  && <Settings  data={data.settings} />}
      </div>

      <SupportButton />
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const centered: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  minHeight: '100vh', background: c.bg, color: c.text,
  fontFamily: 'system-ui, sans-serif',
}
const primaryBtn: React.CSSProperties = {
  background: c.accent, color: c.accentFg, border: 'none',
  borderRadius: 6, padding: '10px 20px', fontSize: 14,
  cursor: 'pointer', fontWeight: 600,
}
const code: React.CSSProperties = {
  background: c.surfaceHover, padding: '1px 6px', borderRadius: 3,
  fontSize: 13, fontFamily: 'monospace',
}
const kbd: React.CSSProperties = {
  background: c.surfaceHover, padding: '1px 6px', borderRadius: 3,
  fontSize: 11, fontFamily: 'monospace', border: `1px solid ${c.border}`,
}
