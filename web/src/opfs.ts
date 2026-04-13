/**
 * Origin Private File System (OPFS) cache for DashboardData.
 *
 * After a successful parse, we write the full DashboardData to OPFS so the
 * next page-load can show stale data instantly while re-parsing in background.
 * OPFS reads are 10–100× faster than re-reading the real ~/.claude folder
 * because there are no permission prompts and the browser controls the I/O.
 */

import type { DashboardData } from './api'

const CACHE_FILE = 'dashboard-cache.json'

export interface CacheEntry {
  data: DashboardData
  cachedAt: number // Unix ms
}

export async function saveToOpfs(data: DashboardData): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    const fh = await root.getFileHandle(CACHE_FILE, { create: true })
    const writable = await fh.createWritable()
    await writable.write(JSON.stringify({ data, cachedAt: Date.now() } satisfies CacheEntry))
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
    return JSON.parse(await file.text()) as CacheEntry
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
