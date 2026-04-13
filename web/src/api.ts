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

export interface DashboardData {
  stats: StatsData
  usage: UsageData
  projects: Project[]
  plugins: Plugin[]
  todos: TodosData
  sessions: SessionFacet[]
  settings: SettingsData
}

