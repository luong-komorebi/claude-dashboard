/**
 * File System Access API — handle persistence layer.
 *
 * Only responsible for:
 *   - Persisting the FileSystemDirectoryHandle to IndexedDB across page loads
 *   - Prompting the user to pick the ~/.claude folder
 *
 * All file-reading and parsing runs in the Web Worker (parser.worker.ts).
 */

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

async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
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

/** Remove the persisted handle (used when the user clicks "Change folder"). */
export async function clearHandle(): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).delete(HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export interface StoredDirResult {
  handle: FileSystemDirectoryHandle
  /** 'granted' | 'prompt' | 'denied' — call ensurePermission() on anything non-granted, but only inside a user gesture. */
  permission: PermissionState
}

/**
 * Returns the stored handle along with its current read-permission state.
 * Does NOT call requestPermission() — that would throw SecurityError on page
 * load because it requires a user gesture. Callers must invoke
 * ensurePermission() from a click handler when they need to escalate.
 */
export async function getStoredDir(): Promise<StoredDirResult | null> {
  const handle = await loadHandle()
  if (!handle) return null
  const permission = await handle.queryPermission({ mode: 'read' })
  return { handle, permission }
}

/**
 * Request read permission on a previously-stored handle. MUST be called from
 * inside a user-gesture handler (click, keypress, etc.) — otherwise the
 * browser throws SecurityError.
 *
 * Returns true iff the user granted or had already granted access.
 */
export async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const current = await handle.queryPermission({ mode: 'read' })
  if (current === 'granted') return true
  try {
    const result = await handle.requestPermission({ mode: 'read' })
    return result === 'granted'
  } catch {
    return false
  }
}

/**
 * Open the directory picker, save the handle, and return it.
 *
 * Accepts either the `.claude` folder itself OR any parent that contains it
 * (e.g. the user's home folder). Picking a parent is often easier because
 * home/Documents are visible in the file picker sidebar, whereas `.claude`
 * is hidden by default on macOS/Linux.
 *
 * Throws DOMException with name 'AbortError' if the user cancels.
 * Throws a plain Error if the picked folder doesn't contain `.claude`.
 */
export async function pickClaudeDir(): Promise<FileSystemDirectoryHandle> {
  const picked = await window.showDirectoryPicker({
    id: 'claude-dir',
    mode: 'read',
    startIn: 'documents',
  })

  // Case 1: user picked .claude directly
  if (picked.name === '.claude') {
    await saveHandle(picked)
    return picked
  }

  // Case 2: user picked a parent containing .claude — grab the subhandle
  try {
    const sub = await picked.getDirectoryHandle('.claude')
    await saveHandle(sub)
    return sub
  } catch {
    throw new Error(
      `"${picked.name}" doesn't contain a .claude folder. Pick either ` +
      `the .claude folder directly, or a parent folder that contains it ` +
      `(like your home folder).`,
    )
  }
}
