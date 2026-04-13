/**
 * Claude Code Analytics Admin API client.
 *
 * Endpoint: https://api.anthropic.com/v1/organizations/usage_report/claude_code
 * Auth:     x-api-key: sk-ant-admin...
 * Version:  anthropic-version: 2023-06-01
 *
 * CAVEAT: this is an Admin API, not the regular user API. Individual Pro/Max
 * users can't use it. CORS is not officially documented for this endpoint
 * either — if the browser rejects the preflight, online mode will fail with
 * a clear error message and the UI will explain that a CI/CD or server-side
 * caller is required instead.
 */

import type { AnalyticsRecord, AnalyticsResponse, LiveUsageSummary, AnalyticsTokens } from './types'

const BASE_URL = 'https://api.anthropic.com/v1/organizations/usage_report/claude_code'
const ANTHROPIC_VERSION = '2023-06-01'

/** Fetch one page of records for a single UTC day. */
export async function fetchAnalyticsPage(
  apiKey: string,
  startingAt: string, // YYYY-MM-DD
  opts: { limit?: number; page?: string } = {},
): Promise<AnalyticsResponse> {
  const params = new URLSearchParams({ starting_at: startingAt })
  if (opts.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts.page !== undefined) params.set('page', opts.page)

  let res: Response
  try {
    res = await fetch(`${BASE_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        // Tells Anthropic we acknowledge the risk of shipping the admin key
        // to a client — required for direct-from-browser API calls.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      // Don't send cookies / auth across origins
      credentials: 'omit',
      mode: 'cors',
    })
  } catch (e) {
    // Network error, CORS failure, or CSP block — give the UI something actionable
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `Couldn't reach api.anthropic.com: ${msg}. This usually means either (a) ` +
      `your browser blocked a CORS preflight (Anthropic's Admin API may not ` +
      `allow browser origins), or (b) Online Mode isn't enabled in Settings so ` +
      `the CSP is still blocking outbound connections. Check DevTools → Network.`,
    )
  }

  if (!res.ok) {
    let errDetail = ''
    try {
      const body = await res.text()
      errDetail = body.slice(0, 300)
    } catch { /* ignore */ }
    throw new Error(
      `Anthropic API ${res.status} ${res.statusText}` +
      (errDetail ? ` — ${errDetail}` : '') +
      (res.status === 401 ? ' (check your Admin API key)' : '') +
      (res.status === 403 ? ' (this API is admin-only; individual accounts cannot use it)' : ''),
    )
  }

  return res.json() as Promise<AnalyticsResponse>
}

/** Walk the cursor pagination and return every record for a single day. */
export async function fetchDayComplete(apiKey: string, startingAt: string): Promise<AnalyticsRecord[]> {
  const all: AnalyticsRecord[] = []
  let page: string | undefined
  // Hard safety cap so a broken cursor can't DoS the browser
  for (let i = 0; i < 50; i++) {
    const resp: AnalyticsResponse = await fetchAnalyticsPage(apiKey, startingAt, { limit: 100, page })
    all.push(...resp.data)
    if (!resp.has_more || !resp.next_page) return all
    page = resp.next_page
  }
  return all
}

/** Fetch last N days and roll them into a single LiveUsageSummary. */
export async function fetchLiveUsage(apiKey: string, days: number): Promise<LiveUsageSummary> {
  const clamped = Math.max(1, Math.min(30, Math.floor(days)))
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const perDay: LiveUsageSummary['perDay'] = []
  const errors: LiveUsageSummary['errors'] = []
  const uniqueUsers = new Set<string>()
  const uniqueModels = new Set<string>()
  const totalTokens: AnalyticsTokens = { input: 0, output: 0, cache_read: 0, cache_creation: 0 }
  let totalCostCents = 0
  let totalSessions = 0
  let totalLinesAdded = 0
  let totalLinesRemoved = 0
  let totalCommits = 0
  let totalPullRequests = 0

  for (let i = clamped - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() - i)
    const dateStr = d.toISOString().slice(0, 10)

    let records: AnalyticsRecord[] = []
    try {
      records = await fetchDayComplete(apiKey, dateStr)
    } catch (e) {
      errors.push({ date: dateStr, message: e instanceof Error ? e.message : String(e) })
      perDay.push({ date: dateStr, costCents: 0, totalTokens: 0, sessions: 0 })
      continue
    }

    let dayCostCents = 0
    let dayTokens = 0
    let daySessions = 0

    for (const rec of records) {
      // Track unique actors
      const actorKey = rec.actor.email_address ?? rec.actor.api_key_name ?? 'unknown'
      uniqueUsers.add(actorKey)

      totalSessions += rec.core_metrics.num_sessions
      daySessions += rec.core_metrics.num_sessions
      totalLinesAdded += rec.core_metrics.lines_of_code.added
      totalLinesRemoved += rec.core_metrics.lines_of_code.removed
      totalCommits += rec.core_metrics.commits_by_claude_code
      totalPullRequests += rec.core_metrics.pull_requests_by_claude_code

      for (const m of rec.model_breakdown) {
        uniqueModels.add(m.model)
        totalCostCents += m.estimated_cost.amount
        dayCostCents += m.estimated_cost.amount
        totalTokens.input += m.tokens.input
        totalTokens.output += m.tokens.output
        totalTokens.cache_read += m.tokens.cache_read
        totalTokens.cache_creation += m.tokens.cache_creation
        dayTokens +=
          m.tokens.input + m.tokens.output + m.tokens.cache_read + m.tokens.cache_creation
      }
    }

    perDay.push({ date: dateStr, costCents: dayCostCents, totalTokens: dayTokens, sessions: daySessions })
  }

  const start = perDay[0]?.date ?? ''
  const end = perDay[perDay.length - 1]?.date ?? ''

  return {
    days: clamped,
    rangeStart: start,
    rangeEnd: end,
    totalCostCents,
    totalTokens,
    totalSessions,
    totalLinesAdded,
    totalLinesRemoved,
    totalCommits,
    totalPullRequests,
    uniqueUsers: uniqueUsers.size,
    uniqueModels: [...uniqueModels].sort(),
    perDay,
    fetchedAt: Date.now(),
    errors,
  }
}
