import type { DashboardData } from '../api'

export const mockStats: DashboardData['stats'] = {
  daily_activity: [
    { date: '2026-04-10', message_count: 100, session_count: 2, tool_call_count: 30 },
    { date: '2026-04-11', message_count: 200, session_count: 3, tool_call_count: 60 },
    { date: '2026-04-12', message_count: 150, session_count: 2, tool_call_count: 45 },
  ],
  total_messages: 450,
  total_sessions: 7,
  total_tool_calls: 135,
  active_days: 3,
  date_range: ['2026-04-10', '2026-04-12'],
}

export const mockUsage: DashboardData['usage'] = {
  facets: [
    {
      session_id: 'abc',
      brief_summary: 'Fix auth bug',
      outcome: 'mostly_achieved',
      claude_helpfulness: 'very_helpful',
      session_type: 'bug_fix',
    },
    {
      session_id: 'def',
      brief_summary: 'Add dashboard feature',
      outcome: 'fully_achieved',
      claude_helpfulness: 'very_helpful',
      session_type: 'feature_development',
    },
    {
      session_id: 'ghi',
      brief_summary: 'Debug performance',
      outcome: 'partially_achieved',
      claude_helpfulness: 'helpful',
      session_type: 'debugging',
    },
  ],
  total_sessions: 3,
  outcome_counts: { mostly_achieved: 1, fully_achieved: 1, partially_achieved: 1 },
  helpfulness_counts: { very_helpful: 2, helpful: 1 },
}

export const mockProjects: DashboardData['projects'] = [
  {
    id: '-Users-alice-myrepo',
    path: '/Users/alice/myrepo',
    memory_files: [
      {
        name: 'user_role.md',
        content: '---\nname: User role\ntype: user\ndescription: Senior engineer working on dashboard\n---\n',
      },
    ],
  },
  {
    id: '-Users-alice-other',
    path: '/Users/alice/other',
    memory_files: [],
  },
]

export const mockPlugins: DashboardData['plugins'] = [
  { id: 'superpowers@claude-plugins-official', enabled: true },
  { id: 'railway@railway-skills', enabled: true },
  { id: 'old-plugin@some-registry', enabled: false },
]

export const mockTodos: DashboardData['todos'] = {
  sessions: [
    {
      id: 'session-abc-123',
      items: [
        { content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' },
        { content: 'Review PR', status: 'pending', activeForm: 'Reviewing PR' },
        { content: 'Update docs', status: 'completed', activeForm: 'Updating docs' },
      ],
    },
  ],
  plans: [
    { name: 'feature-plan', content: '# Feature Plan\nStep 1: design\nStep 2: implement' },
  ],
  pending_count: 1,
  in_progress_count: 1,
  completed_count: 1,
}

export const mockSessions: DashboardData['sessions'] = mockUsage.facets

export const mockSettings: DashboardData['settings'] = {
  allowed_tools: ['WebSearch', 'Bash(git:*)', 'Edit'],
  enabled_plugins: ['superpowers@official', 'railway@skills'],
  disabled_plugins: ['old-plugin@registry'],
  effort_level: 'high',
  always_thinking: true,
  recent_history: [
    { display: 'cargo test', timestamp: 2000, project: '/Users/alice/repo' },
    { display: 'git status', timestamp: 1000, project: '/Users/alice/repo' },
  ],
}

export const mockUsageEvents: DashboardData['usage_events'] = [
  {
    timestamp: '2026-04-10T10:00:00Z',
    session_id: 'sess-1',
    project_id: '-Users-alice-myrepo',
    model: 'claude-sonnet-4-6',
    input_tokens: 100,
    output_tokens: 500,
    cache_creation_input_tokens: 1000,
    cache_read_input_tokens: 2000,
  },
  {
    timestamp: '2026-04-10T11:30:00Z',
    session_id: 'sess-1',
    project_id: '-Users-alice-myrepo',
    model: 'claude-sonnet-4-6',
    input_tokens: 200,
    output_tokens: 800,
    cache_creation_input_tokens: 500,
    cache_read_input_tokens: 3000,
  },
  {
    timestamp: '2026-04-12T09:15:00Z',
    session_id: 'sess-2',
    project_id: '-Users-alice-other',
    model: 'claude-opus-4-6',
    input_tokens: 50,
    output_tokens: 300,
    cache_creation_input_tokens: 2000,
    cache_read_input_tokens: 0,
  },
]

export const mockAccount: DashboardData['account'] = {
  email: 'alice@example.com',
  accountUuid: '23c63b4f-4567-4ba7-8d82-d3681f7aac1a',
  organizationUuid: '6f6ccbe7-7d2e-4085-b715-63c13f2f601b',
  userId: '12345',
  numStartups: 847,
  installMethod: 'homebrew',
  theme: 'dark',
  autoUpdates: true,
  hasCompletedOnboarding: true,
  projectCosts: [
    {
      path: '/Users/alice/myrepo',
      lastCost: 1.42,
      lastSessionId: 'sess-1',
      lastApiDurationMs: 3500,
      lastDurationMs: 42000,
    },
  ],
  mcpServers: ['github', 'notion'],
  source: '.claude.json',
}

export const mockChangelog: DashboardData['changelog'] = [
  { version: '2.1.101', items: ['Added `/team-onboarding` command', 'Improved brief mode'] },
  { version: '2.1.100', items: ['Fixed memory leak in long sessions'] },
]

export const mockCommands: DashboardData['commands'] = [
  { name: 'deploy', description: 'Deploy to production', body: 'Run the deploy pipeline…' },
]

export const mockSkills: DashboardData['skills'] = [
  { name: 'rust-debugger', description: 'Debug Rust code with gdb', hasScripts: true },
]

export const mockLiveSessions: DashboardData['liveSessions'] = [
  {
    pid: 42069,
    sessionId: 'abc-123',
    cwd: '/Users/alice/myrepo',
    startedAt: 1_776_017_824_172,
    kind: 'interactive',
    entrypoint: 'claude-vscode',
  },
]

export const mockConnectedIdes: DashboardData['connectedIdes'] = [
  {
    pid: 646,
    ideName: 'Visual Studio Code',
    workspaceFolders: ['/Users/alice/myrepo'],
    transport: 'ws',
    runningInWindows: false,
  },
]

export const mockDashboard: DashboardData = {
  stats: mockStats,
  usage: mockUsage,
  projects: mockProjects,
  plugins: mockPlugins,
  todos: mockTodos,
  sessions: mockSessions,
  settings: mockSettings,
  usage_events: mockUsageEvents,
  project_paths: {
    '-Users-alice-myrepo': '/Users/alice/myrepo',
    '-Users-alice-other': '/Users/alice/other',
  },
  account: mockAccount,
  changelog: mockChangelog,
  commands: mockCommands,
  skills: mockSkills,
  liveSessions: mockLiveSessions,
  connectedIdes: mockConnectedIdes,
}
