import { api } from '../api'
import { mockDashboard } from './fixtures'

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  })
}

function mockError(status: number) {
  mockFetch.mockResolvedValueOnce({ ok: false, status })
}

describe('api client', () => {
  beforeEach(() => mockFetch.mockClear())

  it('api.all fetches /api/all', async () => {
    mockOk(mockDashboard)
    const result = await api.all()
    expect(mockFetch).toHaveBeenCalledWith('/api/all')
    expect(result.stats.total_messages).toBe(450)
  })

  it('api.stats fetches /api/stats', async () => {
    mockOk(mockDashboard.stats)
    await api.stats()
    expect(mockFetch).toHaveBeenCalledWith('/api/stats')
  })

  it('api.usage fetches /api/usage', async () => {
    mockOk(mockDashboard.usage)
    await api.usage()
    expect(mockFetch).toHaveBeenCalledWith('/api/usage')
  })

  it('api.projects fetches /api/projects', async () => {
    mockOk(mockDashboard.projects)
    await api.projects()
    expect(mockFetch).toHaveBeenCalledWith('/api/projects')
  })

  it('api.plugins fetches /api/plugins', async () => {
    mockOk(mockDashboard.plugins)
    await api.plugins()
    expect(mockFetch).toHaveBeenCalledWith('/api/plugins')
  })

  it('api.todos fetches /api/todos', async () => {
    mockOk(mockDashboard.todos)
    await api.todos()
    expect(mockFetch).toHaveBeenCalledWith('/api/todos')
  })

  it('api.sessions fetches /api/sessions', async () => {
    mockOk(mockDashboard.sessions)
    await api.sessions()
    expect(mockFetch).toHaveBeenCalledWith('/api/sessions')
  })

  it('api.settings fetches /api/settings', async () => {
    mockOk(mockDashboard.settings)
    await api.settings()
    expect(mockFetch).toHaveBeenCalledWith('/api/settings')
  })

  it('api.refresh sends POST to /api/refresh', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    await api.refresh()
    expect(mockFetch).toHaveBeenCalledWith('/api/refresh', { method: 'POST' })
  })

  it('throws on non-ok response', async () => {
    mockError(500)
    await expect(api.all()).rejects.toThrow('500')
  })
})
