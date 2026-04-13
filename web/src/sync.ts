/**
 * Multi-tab synchronization.
 *
 * Combines two APIs:
 *   1. BroadcastChannel — pub/sub between tabs on the same origin. Used to
 *      notify other open tabs that fresh data is available in the OPFS cache.
 *   2. Web Locks API    — a cross-tab mutex. Wraps the parse operation so
 *      only one tab at a time is reading ~/.claude, even if a user hits
 *      Refresh in multiple tabs simultaneously. The losers wait and then
 *      pick up the freshly-written OPFS cache instead of re-parsing.
 */

const CHANNEL_NAME = 'claude-dashboard'
const PARSE_LOCK = 'claude-dashboard:parse'

export type SyncMessage =
  | { type: 'refreshed'; cachedAt: number }
  | { type: 'cleared' }

export function createSyncChannel(): BroadcastChannel {
  return new BroadcastChannel(CHANNEL_NAME)
}

export function broadcast(channel: BroadcastChannel, msg: SyncMessage): void {
  channel.postMessage(msg)
}

/**
 * Run `task` holding an exclusive cross-tab lock. If Web Locks isn't supported,
 * falls back to running the task directly (lock is best-effort).
 */
export async function withParseLock<T>(task: () => Promise<T>): Promise<T> {
  if (!navigator.locks?.request) return task()
  return navigator.locks.request(PARSE_LOCK, async () => task())
}
