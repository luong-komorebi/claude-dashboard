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

/**
 * Returns the stored handle if read permission is still granted.
 * Attempts a silent re-request (will fail if no user gesture is present).
 */
export async function getStoredDir(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await loadHandle()
  if (!handle) return null
  const perm = await handle.queryPermission({ mode: 'read' })
  if (perm === 'granted') return handle
  const req = await handle.requestPermission({ mode: 'read' })
  return req === 'granted' ? handle : null
}

/**
 * Open the directory picker, save the handle, and return it.
 * Throws DOMException with name 'AbortError' if the user cancels.
 */
export async function pickClaudeDir(): Promise<FileSystemDirectoryHandle> {
  const handle = await window.showDirectoryPicker({ mode: 'read', startIn: 'documents' })
  await saveHandle(handle)
  return handle
}
