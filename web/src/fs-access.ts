import type { DashboardData, StatsData, UsageData, Project, Plugin, TodosData, SessionFacet, SettingsData } from './api'

// Persisted directory handle across page loads
const DB_NAME = 'claude-dashboard'
const DB_STORE = 'handles'
const HANDLE_KEY = 'claude-dir'

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveHandle(handle: FileSystemDirectoryHandle) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(handle, HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(HANDLE_KEY)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function clearHandle() {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).delete(HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Returns the stored handle if permission is still granted, otherwise null. */
export async function getStoredDir(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await loadHandle()
  if (!handle) return null
  const perm = await handle.queryPermission({ mode: 'read' })
  if (perm === 'granted') return handle
  // Try to re-request without a gesture (will fail silently if not possible)
  const req = await handle.requestPermission({ mode: 'read' })
  return req === 'granted' ? handle : null
}

/** Prompt the user to pick the ~/.claude directory. */
export async function pickClaudeDir(): Promise<FileSystemDirectoryHandle> {
  // startIn: 'documents' puts the picker one level up from home on most OSes,
  // which is the closest we can get without an arbitrary path API.
  const handle = await window.showDirectoryPicker({ mode: 'read', startIn: 'documents' })
  await saveHandle(handle)
  return handle
}

// ─── File helpers ────────────────────────────────────────────────────────────

async function readJson<T>(dir: FileSystemDirectoryHandle, ...path: string[]): Promise<T | null> {
  try {
    let current: FileSystemDirectoryHandle = dir
    for (const segment of path.slice(0, -1)) {
      current = await current.getDirectoryHandle(segment)
    }
    const fileHandle = await current.getFileHandle(path[path.length - 1])
    const file = await fileHandle.getFile()
    return JSON.parse(await file.text()) as T
  } catch {
    return null
  }
}

async function readText(dir: FileSystemDirectoryHandle, ...path: string[]): Promise<string | null> {
  try {
    let current: FileSystemDirectoryHandle = dir
    for (const segment of path.slice(0, -1)) {
      current = await current.getDirectoryHandle(segment)
    }
    const fileHandle = await current.getFileHandle(path[path.length - 1])
    const file = await fileHandle.getFile()
    return file.text()
  } catch {
    return null
  }
}

async function listDir(dir: FileSystemDirectoryHandle, ...path: string[]): Promise<AsyncIterable<[string, FileSystemHandle]>> {
  try {
    let current: FileSystemDirectoryHandle = dir
    for (const segment of path) {
      current = await current.getDirectoryHandle(segment)
    }
    return current.entries()
  } catch {
    return (async function* () {})()
  }
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

async function parseStats(dir: FileSystemDirectoryHandle): Promise<StatsData> {
  const raw = await readJson<{ dailyActivity: { date: string; messageCount: number; sessionCount: number; toolCallCount: number }[] }>(dir, 'stats-cache.json')
  if (!raw) return { daily_activity: [], total_messages: 0, total_sessions: 0, total_tool_calls: 0, active_days: 0, date_range: null }

  const daily_activity = raw.dailyActivity.map(d => ({
    date: d.date,
    message_count: d.messageCount,
    session_count: d.sessionCount,
    tool_call_count: d.toolCallCount,
  }))

  return {
    daily_activity,
    total_messages: daily_activity.reduce((s, d) => s + d.message_count, 0),
    total_sessions: daily_activity.reduce((s, d) => s + d.session_count, 0),
    total_tool_calls: daily_activity.reduce((s, d) => s + d.tool_call_count, 0),
    active_days: daily_activity.length,
    date_range: daily_activity.length > 0
      ? [daily_activity[0].date, daily_activity[daily_activity.length - 1].date]
      : null,
  }
}

async function parseUsage(dir: FileSystemDirectoryHandle): Promise<UsageData> {
  const facets: SessionFacet[] = []
  const outcome_counts: Record<string, number> = {}
  const helpfulness_counts: Record<string, number> = {}

  for await (const [name, handle] of await listDir(dir, 'usage-data', 'facets')) {
    if (!name.endsWith('.json') || handle.kind !== 'file') continue
    try {
      const file = await (handle as FileSystemFileHandle).getFile()
      const facet = JSON.parse(await file.text()) as SessionFacet
      if (facet.outcome) outcome_counts[facet.outcome] = (outcome_counts[facet.outcome] ?? 0) + 1
      if (facet.claude_helpfulness) helpfulness_counts[facet.claude_helpfulness] = (helpfulness_counts[facet.claude_helpfulness] ?? 0) + 1
      facets.push(facet)
    } catch { /* skip malformed */ }
  }

  return { facets, total_sessions: facets.length, outcome_counts, helpfulness_counts }
}

async function parseProjects(dir: FileSystemDirectoryHandle): Promise<Project[]> {
  const projects: Project[] = []

  for await (const [id, handle] of await listDir(dir, 'projects')) {
    if (handle.kind !== 'directory') continue
    const path = '/' + id.replace(/-/g, '/').replace(/^\//, '')
    const memory_files: Project['memory_files'] = []

    try {
      const projDir = handle as FileSystemDirectoryHandle
      const memDir = await projDir.getDirectoryHandle('memory').catch(() => null)
      if (memDir) {
        for await (const [mname, mhandle] of memDir.entries()) {
          if (mhandle.kind !== 'file') continue
          const mfile = await (mhandle as FileSystemFileHandle).getFile()
          memory_files.push({ name: mname, content: await mfile.text() })
        }
      }
    } catch { /* skip */ }

    projects.push({ id, path, memory_files })
  }

  return projects.sort((a, b) => a.path.localeCompare(b.path))
}

async function parsePlugins(dir: FileSystemDirectoryHandle): Promise<Plugin[]> {
  const installed = await readJson<{ plugins: Record<string, unknown> }>(dir, 'plugins', 'installed_plugins.json')
  const settings = await readJson<{ enabledPlugins?: Record<string, boolean> }>(dir, 'settings.json')

  const enabled = new Set(
    Object.entries(settings?.enabledPlugins ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k)
  )

  if (!installed?.plugins) return []

  return Object.keys(installed.plugins)
    .map(id => ({ id, enabled: enabled.has(id) }))
    .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.id.localeCompare(b.id))
}

async function parseTodos(dir: FileSystemDirectoryHandle): Promise<TodosData> {
  const sessions: TodosData['sessions'] = []
  const plans: TodosData['plans'] = []
  let pending_count = 0, in_progress_count = 0, completed_count = 0

  for await (const [name, handle] of await listDir(dir, 'todos')) {
    if (!name.endsWith('.json') || handle.kind !== 'file') continue
    try {
      const file = await (handle as FileSystemFileHandle).getFile()
      const items = JSON.parse(await file.text()) as { content: string; status: string; activeForm?: string }[]
      for (const item of items) {
        if (item.status === 'pending') pending_count++
        else if (item.status === 'in_progress') in_progress_count++
        else if (item.status === 'completed') completed_count++
      }
      sessions.push({ id: name.replace('.json', ''), items })
    } catch { /* skip */ }
  }

  for await (const [name, handle] of await listDir(dir, 'plans')) {
    if (!name.endsWith('.md') || handle.kind !== 'file') continue
    const file = await (handle as FileSystemFileHandle).getFile()
    plans.push({ name: name.replace('.md', ''), content: await file.text() })
  }

  return { sessions, plans, pending_count, in_progress_count, completed_count }
}

async function parseSessions(dir: FileSystemDirectoryHandle): Promise<SessionFacet[]> {
  const sessions: SessionFacet[] = []
  for await (const [name, handle] of await listDir(dir, 'usage-data', 'facets')) {
    if (!name.endsWith('.json') || handle.kind !== 'file') continue
    try {
      const file = await (handle as FileSystemFileHandle).getFile()
      sessions.push(JSON.parse(await file.text()))
    } catch { /* skip */ }
  }
  return sessions
}

async function parseSettings(dir: FileSystemDirectoryHandle): Promise<SettingsData> {
  const raw = await readJson<{
    permissions?: { allow?: string[] }
    enabledPlugins?: Record<string, boolean>
    effortLevel?: string
    alwaysThinkingEnabled?: boolean
  }>(dir, 'settings.json')

  const historyText = await readText(dir, 'history.jsonl')
  let recent_history: SettingsData['recent_history'] = []
  if (historyText) {
    const entries = historyText.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean) as SettingsData['recent_history']
    entries.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    // deduplicate by display
    const seen = new Set<string>()
    for (const e of entries) {
      if (!seen.has(e.display)) { seen.add(e.display); recent_history.push(e) }
    }
    recent_history = recent_history.slice(0, 50)
  }

  const enabled_plugins: string[] = []
  const disabled_plugins: string[] = []
  for (const [id, on] of Object.entries(raw?.enabledPlugins ?? {})) {
    ;(on ? enabled_plugins : disabled_plugins).push(id)
  }
  enabled_plugins.sort(); disabled_plugins.sort()

  return {
    allowed_tools: raw?.permissions?.allow ?? [],
    enabled_plugins,
    disabled_plugins,
    effort_level: raw?.effortLevel,
    always_thinking: raw?.alwaysThinkingEnabled,
    recent_history,
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function loadAll(dir: FileSystemDirectoryHandle): Promise<DashboardData> {
  const [stats, usage, projects, plugins, todos, sessions, settings] = await Promise.all([
    parseStats(dir),
    parseUsage(dir),
    parseProjects(dir),
    parsePlugins(dir),
    parseTodos(dir),
    parseSessions(dir),
    parseSettings(dir),
  ])
  return { stats, usage, projects, plugins, todos, sessions, settings }
}
