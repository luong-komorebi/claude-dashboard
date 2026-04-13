export interface DailyActivity {
  date: string
  message_count: number
  session_count: number
  tool_call_count: number
}

export interface StatsData {
  daily_activity: DailyActivity[]
  total_messages: number
  total_sessions: number
  total_tool_calls: number
  active_days: number
  date_range: [string, string] | null
}

export interface SessionFacet {
  session_id: string
  brief_summary?: string
  underlying_goal?: string
  outcome?: string
  claude_helpfulness?: string
  session_type?: string
}

export interface UsageData {
  facets: SessionFacet[]
  total_sessions: number
  outcome_counts: Record<string, number>
  helpfulness_counts: Record<string, number>
}

export interface MemoryFile {
  name: string
  content: string
}

export interface Project {
  id: string
  path: string
  memory_files: MemoryFile[]
}

export interface Plugin {
  id: string
  enabled: boolean
}

export interface TodoItem {
  content: string
  status: string
  activeForm?: string
}

export interface TodoSession {
  id: string
  items: TodoItem[]
}

export interface Plan {
  name: string
  content: string
}

export interface TodosData {
  sessions: TodoSession[]
  plans: Plan[]
  pending_count: number
  in_progress_count: number
  completed_count: number
}

export interface HistoryEntry {
  display: string
  timestamp?: number
  project?: string
}

export interface SettingsData {
  allowed_tools: string[]
  enabled_plugins: string[]
  disabled_plugins: string[]
  effort_level?: string
  always_thinking?: boolean
  recent_history: HistoryEntry[]
}

/**
 * A single assistant-message usage record extracted from a project's
 * .jsonl session log. One record per assistant turn.
 */
export interface UsageEvent {
  timestamp: string           // ISO-8601 datetime
  session_id: string          // session UUID (filename stem)
  project_id: string          // parent directory name (path-encoded)
  model: string               // e.g. "claude-sonnet-4-6"
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

/**
 * Whitelisted subset of `~/.claude.json` (or `<config-dir>.json`). OAuth
 * tokens, MCP server env vars, and any other credentials are stripped in
 * the worker — they must NEVER reach the main thread.
 */
export interface AccountInfo {
  email: string | null
  accountUuid: string | null
  organizationUuid: string | null
  userId: string | null
  numStartups: number
  installMethod: string | null
  theme: string | null
  autoUpdates: boolean | null
  hasCompletedOnboarding: boolean | null
  /** Per-project runtime state Claude Code itself records (last cost, etc). */
  projectCosts: ProjectCostRecord[]
  /** Configured MCP server names — credentials stripped. */
  mcpServers: string[]
  /** Source filename we read (e.g. ".claude.json"), mostly for debugging. */
  source: string
}

export interface ProjectCostRecord {
  path: string
  lastCost: number
  lastSessionId: string | null
  lastApiDurationMs: number | null
  lastDurationMs: number | null
}

export interface DashboardData {
  stats: StatsData
  usage: UsageData
  projects: Project[]
  plugins: Plugin[]
  todos: TodosData
  sessions: SessionFacet[]
  settings: SettingsData
  usage_events: UsageEvent[]
  account: AccountInfo | null
  /**
   * Map from Claude Code's encoded project ID → real filesystem path,
   * extracted from the `cwd` field embedded in JSONL session events.
   *
   * Claude Code encodes `/` as `-` in project directory names, which is
   * lossy — a folder literally named `oxy-hq` and a path segment boundary
   * look identical after encoding. The JSONL `cwd` field is the only
   * reliable way to recover the original path.
   *
   * If we couldn't find a matching event (e.g. a project dir with no
   * JSONL files), the entry will be absent and callers should fall back
   * to naive dash-splitting.
   */
  project_paths: Record<string, string>
}

