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

const CACHE_FILE = 'dashboard-cache-v2.json.gz'
const LEGACY_CACHE_FILES = ['dashboard-cache.json']

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
    return JSON.parse(text) as CacheEntry
  } catch {
    return null
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
