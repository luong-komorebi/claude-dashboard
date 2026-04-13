/**
 * Origin Private File System (OPFS) cache for DashboardData.
 *
 * After a successful parse we write the full DashboardData to OPFS so the
 * next page-load can show stale data instantly while re-parsing in background.
 *
 * The payload is gzipped via the Compression Streams API before writing —
 * DashboardData JSON compresses to ~25-30% of its original size.
 *
 * Cache format version is encoded in the filename so schema changes can
 * invalidate old caches by bumping the version (old files are cleaned up
 * on first load of a new version).
 */

import type { DashboardData } from './api'

// Bump the version whenever the DashboardData shape changes in a way that
// can't be filled in by `migrate()` below. Current rationale for v3:
//   - `project_paths`, `account`, `changelog`, `commands`, `skills`,
//     `liveSessions`, `connectedIdes` were added after v2 shipped — old v2
//     snapshots deserialize with those fields as `undefined`, which blew up
//     consumers that expected `Record<string, string>` / arrays. Bumping
//     the filename forces a clean re-parse on next load.
const CACHE_FILE = 'dashboard-cache-v3.json.gz'
const LEGACY_CACHE_FILES = [
  'dashboard-cache.json',
  'dashboard-cache-v2.json.gz',
]

export interface CacheEntry {
  data: DashboardData
  cachedAt: number // Unix ms
}

// ─── Compression helpers ──────────────────────────────────────────────────────

async function gzipEncode(text: string): Promise<ArrayBuffer> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

async function gzipDecode(buffer: ArrayBuffer): Promise<string> {
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

// ─── OPFS API ────────────────────────────────────────────────────────────────

export async function saveToOpfs(data: DashboardData): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    const fh = await root.getFileHandle(CACHE_FILE, { create: true })
    const writable = await fh.createWritable()
    const entry: CacheEntry = { data, cachedAt: Date.now() }
    const compressed = await gzipEncode(JSON.stringify(entry))
    await writable.write(compressed)
    await writable.close()
  } catch {
    // Non-fatal — next load will just re-parse from scratch
  }
}

export async function loadFromOpfs(): Promise<CacheEntry | null> {
  try {
    const root = await navigator.storage.getDirectory()
    const fh = await root.getFileHandle(CACHE_FILE)
    const file = await fh.getFile()
    const text = await gzipDecode(await file.arrayBuffer())
    const parsed = JSON.parse(text) as CacheEntry
    // Fill in any fields that weren't present in older snapshots so every
    // consumer can trust the declared types. Cheap defense-in-depth for
    // schema drift — if a field is missing (or `null`/`undefined`), we
    // substitute a safe empty value.
    parsed.data = migrateDashboardData(parsed.data)
    return parsed
  } catch {
    return null
  }
}

/**
 * Fill in missing fields on a partially-shaped DashboardData so it satisfies
 * the current TypeScript definition. Used by `loadFromOpfs` to handle
 * snapshots written by older versions of the parser that didn't yet emit
 * every field. Add a new line here whenever you add a field to
 * `DashboardData` — keep it cheap (just empty defaults, no I/O).
 */
function migrateDashboardData(data: Partial<DashboardData>): DashboardData {
  return {
    stats: data.stats ?? {
      daily_activity: [],
      total_messages: 0,
      total_sessions: 0,
      total_tool_calls: 0,
      active_days: 0,
      date_range: null,
    },
    usage: data.usage ?? {
      facets: [],
      total_sessions: 0,
      outcome_counts: {},
      helpfulness_counts: {},
    },
    projects: data.projects ?? [],
    plugins: data.plugins ?? [],
    todos: data.todos ?? {
      sessions: [],
      plans: [],
      pending_count: 0,
      in_progress_count: 0,
      completed_count: 0,
    },
    sessions: data.sessions ?? [],
    settings: data.settings ?? {
      allowed_tools: [],
      enabled_plugins: [],
      disabled_plugins: [],
      recent_history: [],
    },
    usage_events: data.usage_events ?? [],
    project_paths: data.project_paths ?? {},
    account: data.account ?? null,
    changelog: data.changelog ?? [],
    commands: data.commands ?? [],
    skills: data.skills ?? [],
    liveSessions: data.liveSessions ?? [],
    connectedIdes: data.connectedIdes ?? [],
  }
}

export async function clearOpfsCache(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry(CACHE_FILE)
  } catch {
    // Already gone — fine
  }
}

/** Delete any pre-v2 cache files. Safe to call on every startup. */
export async function cleanupLegacyCache(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    for (const name of LEGACY_CACHE_FILES) {
      await root.removeEntry(name).catch(() => {})
    }
  } catch {
    // No OPFS support — nothing to clean
  }
}

/** Returns OPFS usage info or null if the API is unsupported. */
export async function getStorageEstimate(): Promise<{ usageKb: number; quotaMb: number } | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const est = await navigator.storage.estimate()
    return {
      usageKb: Math.round((est.usage ?? 0) / 1024),
      quotaMb: Math.round((est.quota ?? 0) / 1024 / 1024),
    }
  } catch {
    return null
  }
}
