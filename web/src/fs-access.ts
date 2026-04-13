/**
 * File System Access API — handle persistence + arbitrary CLAUDE_CONFIG_DIR
 * support.
 *
 * Responsibilities:
 *   - Persist a PAIR of directory handles across page loads:
 *       `configDir`  — the Claude Code config directory itself (e.g. ~/.claude
 *                      or ~/.claude-work if the user sets CLAUDE_CONFIG_DIR)
 *       `parentDir`  — the directory that CONTAINS configDir, if available.
 *                      Needed to read `~/.claude.json` (the sibling file that
 *                      holds account info + per-project cost state).
 *   - Prompt the user to pick either (a) the config dir directly or (b) any
 *     parent folder that contains one — same UX as before, but no longer
 *     hard-coded to the name ".claude".
 *
 * All file-reading and parsing still runs in the Web Worker.
 */

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

const DB_NAME = 'claude-dashboard'
const DB_STORE = 'handles'
/** Bumped from `claude-dir` to force a re-pick when upgrading to dual-handle. */
const HANDLE_KEY = 'claude-config-v2'

interface StoredHandles {
  configDir: FileSystemDirectoryHandle
  /** null when the user picked the config dir directly (no parent context). */
  parentDir: FileSystemDirectoryHandle | null
  /** The NAME of the config dir, e.g. ".claude" or ".claude-work". Used to
   *  construct the sibling JSON filename (`<name>.json`). */
  configDirName: string
}

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveHandles(handles: StoredHandles): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(handles, HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function loadHandles(): Promise<StoredHandles | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(HANDLE_KEY)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

// ─── Detection helpers ───────────────────────────────────────────────────────

/** A directory is a valid Claude Code config dir if it looks like one. */
async function looksLikeConfigDir(dir: FileSystemDirectoryHandle): Promise<boolean> {
  // Strong signal: settings.json OR projects/ OR stats-cache.json
  const markers = ['settings.json', 'stats-cache.json']
  for (const name of markers) {
    try {
      await dir.getFileHandle(name)
      return true
    } catch { /* try next */ }
  }
  try {
    await dir.getDirectoryHandle('projects')
    return true
  } catch { /* fall through */ }
  return false
}

/** Search a parent folder for any subdirectory that looks like a Claude
 *  Code config dir. Prefers names matching `.claude*`; falls back to any
 *  dotfile dir that passes the marker check. */
async function findConfigSubdir(
  parent: FileSystemDirectoryHandle,
): Promise<{ name: string; handle: FileSystemDirectoryHandle } | null> {
  // Priority 1: the canonical ".claude" name
  try {
    const handle = await parent.getDirectoryHandle('.claude')
    return { name: '.claude', handle }
  } catch { /* continue */ }

  // Priority 2: any .claude-<suffix> (e.g. .claude-work, .claude-personal)
  for await (const [name, h] of parent.entries()) {
    if (h.kind !== 'directory') continue
    if (name.startsWith('.claude-')) {
      const candidate = h as FileSystemDirectoryHandle
      if (await looksLikeConfigDir(candidate)) {
        return { name, handle: candidate }
      }
    }
  }

  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ConfigDirResult {
  handles: StoredHandles
  permission: PermissionState
}

/** Returns the stored config handles + current permission state. Does NOT
 *  call requestPermission() — that requires a user gesture. */
export async function getStoredDir(): Promise<ConfigDirResult | null> {
  const handles = await loadHandles()
  if (!handles) return null
  // Permission on the broadest handle we have; parent when present, else config
  const broadest = handles.parentDir ?? handles.configDir
  const permission = await broadest.queryPermission({ mode: 'read' })
  return { handles, permission }
}

/** Escalate read permission on the stored handles. Must be called from
 *  inside a user-gesture handler. */
export async function ensurePermission(handles: StoredHandles): Promise<boolean> {
  const broadest = handles.parentDir ?? handles.configDir
  const current = await broadest.queryPermission({ mode: 'read' })
  if (current === 'granted') return true
  try {
    const result = await broadest.requestPermission({ mode: 'read' })
    return result === 'granted'
  } catch {
    return false
  }
}

/** Forget the stored handles (used by "Change folder"). */
export async function clearHandle(): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).delete(HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Open the directory picker and return a pair of handles.
 *
 * The user may pick:
 *   - The Claude Code config directory itself (e.g. `.claude`, `.claude-work`)
 *     → `{ configDir: picked, parentDir: null }`. Account info is not
 *        available in this mode because we can't reach the sibling JSON.
 *   - Any parent folder that contains a config directory (e.g. the home folder)
 *     → `{ configDir: <subdir>, parentDir: picked }`. We can read the full
 *        account file from parentDir.
 *
 * IMPORTANT: this function is NOT `async`. `showDirectoryPicker` must be
 * called synchronously from the click handler that initiated it — wrapping
 * it in an async function introduces a microtask break that some browsers
 * reject with `SecurityError: Must be handling a user gesture`.
 *
 * Throws DOMException with name 'AbortError' if the user cancels.
 * Throws a plain Error if the picked folder doesn't contain a config dir.
 */
export function pickClaudeDir(): Promise<StoredHandles> {
  return window
    .showDirectoryPicker({
      id: 'claude-dir',
      mode: 'read',
      startIn: 'documents',
    })
    .then(resolveToConfigDir)
}

async function resolveToConfigDir(picked: FileSystemDirectoryHandle): Promise<StoredHandles> {
  // Case 1: user picked the config dir directly
  if (await looksLikeConfigDir(picked)) {
    const handles: StoredHandles = {
      configDir: picked,
      parentDir: null,
      configDirName: picked.name,
    }
    await saveHandles(handles)
    return handles
  }

  // Case 2: user picked a parent — find a .claude* subdirectory
  const sub = await findConfigSubdir(picked)
  if (sub) {
    const handles: StoredHandles = {
      configDir: sub.handle,
      parentDir: picked,
      configDirName: sub.name,
    }
    await saveHandles(handles)
    return handles
  }

  throw new Error(
    `"${picked.name}" isn't a Claude Code config folder and doesn't contain ` +
    `one. Pick either the \`.claude\` folder directly, or a parent folder ` +
    `that contains it (like your home folder). If you set CLAUDE_CONFIG_DIR, ` +
    `pick that folder instead.`,
  )
}

export type { StoredHandles }
