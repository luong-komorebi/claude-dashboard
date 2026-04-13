/**
 * Persistent Storage API wrapper.
 *
 * By default, browser storage (IndexedDB, OPFS, localStorage) is "best-effort":
 * the browser can evict it under disk pressure, and Safari's ITP wipes it after
 * 7 days of inactivity. Calling navigator.storage.persist() escalates our origin
 * to "persistent" — the browser then never auto-evicts it. Only the user can
 * clear it manually from browser settings.
 *
 * Browser behavior:
 *   - Chrome/Edge: auto-grants silently if the site is installed as a PWA, is
 *     bookmarked with high engagement, or has notification permissions. Otherwise
 *     auto-denies without a prompt.
 *   - Firefox: shows a user prompt the first time (requires a user gesture).
 *   - Safari: partial — works for home-screen-installed PWAs.
 *
 * Safe to call multiple times: returns true immediately if already persistent.
 */

export async function isStoragePersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false
  try {
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}

/**
 * Must be called inside a user-gesture handler (e.g. click) on Firefox —
 * otherwise the permission prompt is blocked.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/**
 * Returns `true` iff the Persistent Storage API is at all available.
 * Used to decide whether to show the persistence toggle in the UI at all.
 */
export function isPersistenceSupported(): boolean {
  return typeof navigator.storage?.persist === 'function'
}
