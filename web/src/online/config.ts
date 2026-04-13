/**
 * Online mode configuration — persisted to localStorage.
 *
 * When enabled, the dashboard will call Anthropic's Claude Code Analytics
 * Admin API from the browser. This DOES send the user's admin key to
 * `api.anthropic.com` over HTTPS — the only external destination the CSP
 * then allows. Off by default; explicitly opt-in via Config → Settings.
 *
 * The admin API key is stored in plaintext in localStorage. This is a
 * tradeoff: we could use Web Crypto to encrypt with a passphrase, but for
 * a dashboard that already has File System Access to `~/.claude`, adding
 * a second auth layer is security theatre. "Clear web data" wipes it.
 */

const STORAGE_KEY = 'claude-dashboard:online-mode'

export interface OnlineConfig {
  enabled: boolean
  /** Admin API key starting with `sk-ant-admin...`. Empty string if unset. */
  apiKey: string
  /** How many days of history to pull (1..30). Default 7. */
  daysToFetch: number
}

const DEFAULTS: OnlineConfig = {
  enabled: false,
  apiKey: '',
  daysToFetch: 7,
}

export function getOnlineConfig(): OnlineConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<OnlineConfig>
    return {
      enabled: parsed.enabled === true,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      daysToFetch:
        typeof parsed.daysToFetch === 'number' && parsed.daysToFetch > 0 && parsed.daysToFetch <= 30
          ? parsed.daysToFetch
          : DEFAULTS.daysToFetch,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function setOnlineConfig(next: OnlineConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch { /* private mode */ }
}

export function clearOnlineConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* private mode */ }
}

/** Display-only — only the last 4 characters of the key are ever shown. */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return key
  return `sk-ant-admin-…${key.slice(-4)}`
}
