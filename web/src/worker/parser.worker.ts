/**
 * Parser Web Worker
 *
 * Runs all ~/.claude file-reading and parsing off the main thread.
 * Receives a FileSystemDirectoryHandle via postMessage and replies with
 * { ok: true, data: DashboardData } or { ok: false, error: string }.
 *
 * FileSystemDirectoryHandle is structured-cloneable (Chrome 86+) so it
 * can be sent to a Worker without the Transferable API.
 */

import type {
  DashboardData, StatsData, UsageData, Project, Plugin,
  TodosData, SessionFacet, SettingsData, UsageEvent,
} from '../api'

// ─── File-system helpers ──────────────────────────────────────────────────────

async function readJson<T>(dir: FileSystemDirectoryHandle, ...path: string[]): Promise<T | null> {
  try {
    let current: FileSystemDirectoryHandle = dir
    for (const segment of path.slice(0, -1)) {
      current = await current.getDirectoryHandle(segment)
    }
    const fh = await current.getFileHandle(path[path.length - 1])
    return JSON.parse(await (await fh.getFile()).text()) as T
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
    const fh = await current.getFileHandle(path[path.length - 1])
    return (await fh.getFile()).text()
  } catch {
    return null
  }
}

async function listDir(
  dir: FileSystemDirectoryHandle,
  ...path: string[]
): Promise<AsyncIterable<[string, FileSystemHandle]>> {
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

// ─── Parsers ──────────────────────────────────────────────────────────────────

async function parseStats(dir: FileSystemDirectoryHandle): Promise<StatsData> {
  const raw = await readJson<{
    dailyActivity: { date: string; messageCount: number; sessionCount: number; toolCallCount: number }[]
  }>(dir, 'stats-cache.json')

  if (!raw) {
    return { daily_activity: [], total_messages: 0, total_sessions: 0, total_tool_calls: 0, active_days: 0, date_range: null }
  }

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
    active_days: daily_activity.filter(d => d.message_count > 0).length,
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
      const facet = JSON.parse(await (await (handle as FileSystemFileHandle).getFile()).text()) as SessionFacet
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
      const items = JSON.parse(
        await (await (handle as FileSystemFileHandle).getFile()).text()
      ) as { content: string; status: string; activeForm?: string }[]
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
      sessions.push(JSON.parse(await (await (handle as FileSystemFileHandle).getFile()).text()))
    } catch { /* skip */ }
  }
  return sessions
}

/**
 * Walks projects/<id>/<uuid>.jsonl session logs and returns:
 *   - an array of UsageEvents (one per assistant message with `message.usage`)
 *   - a map from projectId → real filesystem path ("cwd")
 *
 * Claude Code encodes project directory names by replacing `/` with `-`,
 * which is lossy: a folder literally named "oxy-hq" and a path segment
 * boundary are indistinguishable after encoding. The JSONL events carry a
 * `cwd` field with the unencoded path, so we use that as the ground truth.
 *
 * Line-by-line streaming via Blob.stream() + TextDecoderStream keeps peak
 * memory low even for very long histories.
 */
async function parseUsageEvents(
  dir: FileSystemDirectoryHandle,
): Promise<{ events: UsageEvent[]; projectPaths: Map<string, string> }> {
  const events: UsageEvent[] = []
  const projectPaths = new Map<string, string>()

  for await (const [projectId, projHandle] of await listDir(dir, 'projects')) {
    if (projHandle.kind !== 'directory') continue
    const projDir = projHandle as FileSystemDirectoryHandle

    for await (const [name, entry] of projDir.entries()) {
      if (!name.endsWith('.jsonl') || entry.kind !== 'file') continue

      const sessionId = name.replace('.jsonl', '')
      const file = await (entry as FileSystemFileHandle).getFile()

      const stream = file.stream().pipeThrough(new TextDecoderStream())
      let buffer = ''

      for await (const chunk of stream as unknown as AsyncIterable<string>) {
        buffer += chunk
        let newline = buffer.indexOf('\n')
        while (newline !== -1) {
          const line = buffer.slice(0, newline)
          buffer = buffer.slice(newline + 1)
          newline = buffer.indexOf('\n')
          if (!line) continue
          try {
            // Opportunistic cwd capture — any line that has a `cwd` field
            // tells us the real path for this encoded projectId.
            if (!projectPaths.has(projectId) && line.includes('"cwd"')) {
              const parsed = JSON.parse(line) as { cwd?: string }
              if (typeof parsed.cwd === 'string' && parsed.cwd.length > 0) {
                projectPaths.set(projectId, parsed.cwd)
              }
            }
            const ev = extractUsageEvent(line, sessionId, projectId)
            if (ev) events.push(ev)
          } catch { /* skip malformed line */ }
        }
      }
      if (buffer) {
        try {
          if (!projectPaths.has(projectId) && buffer.includes('"cwd"')) {
            const parsed = JSON.parse(buffer) as { cwd?: string }
            if (typeof parsed.cwd === 'string' && parsed.cwd.length > 0) {
              projectPaths.set(projectId, parsed.cwd)
            }
          }
          const ev = extractUsageEvent(buffer, sessionId, projectId)
          if (ev) events.push(ev)
        } catch { /* skip */ }
      }
    }
  }

  return { events, projectPaths }
}

interface JsonlMessage {
  type?: string
  timestamp?: string
  message?: {
    model?: string
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
}

function extractUsageEvent(line: string, sessionId: string, projectId: string): UsageEvent | null {
  const entry = JSON.parse(line) as JsonlMessage
  if (entry.type !== 'assistant') return null
  const msg = entry.message
  const usage = msg?.usage
  if (!msg || !usage) return null

  const model = msg.model ?? 'unknown'

  // Skip non-billable internal messages — Claude Code emits these for retries,
  // interruptions, and system-synthesized turns. They carry `type: assistant`
  // + a usage block but the model name is wrapped in angle brackets (e.g.
  // "<synthetic>") and every token count is 0.
  if (model.startsWith('<')) return null

  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const cacheCreate = usage.cache_creation_input_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0

  // Zero-token entries contribute nothing useful to reports — drop them to
  // keep tables clean and avoid cluttering the unpriced-models warning.
  if (input + output + cacheCreate + cacheRead === 0) return null

  return {
    timestamp: entry.timestamp ?? '',
    session_id: sessionId,
    project_id: projectId,
    model,
    input_tokens: input,
    output_tokens: output,
    cache_creation_input_tokens: cacheCreate,
    cache_read_input_tokens: cacheRead,
  }
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
    const entries = historyText.trim().split('\n').filter(Boolean).flatMap(line => {
      try { return [JSON.parse(line) as SettingsData['recent_history'][number]] } catch { return [] }
    })
    entries.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
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

// ─── Entry point ──────────────────────────────────────────────────────────────

export type WorkerResponse =
  | { ok: true; data: DashboardData }
  | { ok: false; error: string }

async function loadAll(dir: FileSystemDirectoryHandle): Promise<DashboardData> {
  const [stats, usage, projects, plugins, todos, sessions, settings, eventsResult] = await Promise.all([
    parseStats(dir),
    parseUsage(dir),
    parseProjects(dir),
    parsePlugins(dir),
    parseTodos(dir),
    parseSessions(dir),
    parseSettings(dir),
    parseUsageEvents(dir),
  ])

  const { events: usage_events, projectPaths } = eventsResult
  const project_paths: Record<string, string> = Object.fromEntries(projectPaths.entries())

  // Overwrite each Project's guessed `path` with the real cwd when available.
  // The naive dash-splitting in parseProjects is only a fallback for projects
  // that have no associated JSONL events yet.
  for (const p of projects) {
    const real = project_paths[p.id]
    if (real) p.path = real
  }

  // Re-sort alphabetically by the (now-accurate) path
  projects.sort((a, b) => a.path.localeCompare(b.path))

  return { stats, usage, projects, plugins, todos, sessions, settings, usage_events, project_paths }
}

self.addEventListener('message', (e: MessageEvent<FileSystemDirectoryHandle>) => {
  loadAll(e.data)
    .then(data => self.postMessage({ ok: true, data } satisfies WorkerResponse))
    .catch(err => self.postMessage({ ok: false, error: String(err) } satisfies WorkerResponse))
})
