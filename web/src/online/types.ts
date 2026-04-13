/**
 * TypeScript shapes for the Claude Code Analytics Admin API.
 *
 * Source: https://platform.claude.com/docs/en/build-with-claude/claude-code-analytics-api
 *
 * NOTE: this API is **admin-only**. It requires an Admin API key
 * (starting with `sk-ant-admin...`) provisioned from an organization's
 * Claude Console. Individual Pro/Max/API users cannot use it.
 */

export type ActorType = 'user_actor' | 'api_actor'

export interface AnalyticsActor {
  type: ActorType
  email_address?: string
  api_key_name?: string
}

export interface AnalyticsTokens {
  input: number
  output: number
  cache_read: number
  cache_creation: number
}

export interface AnalyticsCost {
  currency: string
  /** Amount in cents USD — divide by 100 for dollars. */
  amount: number
}

export interface AnalyticsModelBreakdown {
  model: string
  tokens: AnalyticsTokens
  estimated_cost: AnalyticsCost
}

export interface AnalyticsLinesOfCode {
  added: number
  removed: number
}

export interface AnalyticsCoreMetrics {
  num_sessions: number
  lines_of_code: AnalyticsLinesOfCode
  commits_by_claude_code: number
  pull_requests_by_claude_code: number
}

export interface AnalyticsToolAction {
  accepted: number
  rejected: number
}

export interface AnalyticsToolActions {
  edit_tool?: AnalyticsToolAction
  multi_edit_tool?: AnalyticsToolAction
  write_tool?: AnalyticsToolAction
  notebook_edit_tool?: AnalyticsToolAction
}

export type CustomerType = 'api' | 'subscription'

export interface AnalyticsRecord {
  /** RFC 3339 UTC timestamp for the day the metrics aggregate. */
  date: string
  actor: AnalyticsActor
  organization_id: string
  customer_type: CustomerType
  terminal_type: string
  core_metrics: AnalyticsCoreMetrics
  tool_actions: AnalyticsToolActions
  model_breakdown: AnalyticsModelBreakdown[]
}

export interface AnalyticsResponse {
  data: AnalyticsRecord[]
  has_more: boolean
  next_page: string | null
}

/** Rolled-up view of many records for a single UI card. */
export interface LiveUsageSummary {
  days: number
  rangeStart: string
  rangeEnd: string
  totalCostCents: number
  totalTokens: AnalyticsTokens
  totalSessions: number
  totalLinesAdded: number
  totalLinesRemoved: number
  totalCommits: number
  totalPullRequests: number
  uniqueUsers: number
  uniqueModels: string[]
  perDay: { date: string; costCents: number; totalTokens: number; sessions: number }[]
  fetchedAt: number // epoch ms
  /** Records we couldn't fetch due to API error, with the date + reason. */
  errors: { date: string; message: string }[]
}
