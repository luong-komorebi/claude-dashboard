import { render, screen } from '@testing-library/react'
import { Stats } from '../../pages/Stats'
import { mockStats } from '../fixtures'

describe('Stats page', () => {
  it('renders section heading', () => {
    render(<Stats data={mockStats} />)
    expect(screen.getByRole('heading', { name: 'Stats' })).toBeInTheDocument()
  })

  it('displays total messages', () => {
    render(<Stats data={mockStats} />)
    expect(screen.getByText('450')).toBeInTheDocument()
  })

  it('displays formatted large numbers', () => {
    render(<Stats data={{ ...mockStats, total_messages: 23059 }} />)
    expect(screen.getByText('23.1K')).toBeInTheDocument()
  })

  it('displays active days in sub text', () => {
    render(<Stats data={mockStats} />)
    expect(screen.getByText(/3 active days/)).toBeInTheDocument()
  })

  it('shows date range in subtitle', () => {
    render(<Stats data={mockStats} />)
    expect(screen.getByText(/2026-04-10.*2026-04-12/)).toBeInTheDocument()
  })

  it('renders daily activity table rows', () => {
    render(<Stats data={mockStats} />)
    const dates = screen.getAllByText(/2026-04-1/)
    expect(dates.length).toBeGreaterThan(0)
  })

  it('handles empty activity gracefully', () => {
    const empty = { ...mockStats, daily_activity: [], active_days: 0, date_range: null }
    render(<Stats data={empty} />)
    expect(screen.getByRole('heading', { name: 'Stats' })).toBeInTheDocument()
  })

  it('does not show subtitle when date_range is null', () => {
    const noRange = { ...mockStats, date_range: null }
    const { container } = render(<Stats data={noRange} />)
    // SectionHeader renders sub only when provided
    const subs = container.querySelectorAll('div[style*="color: rgb(102"]')
    const subTexts = Array.from(subs).map(el => el.textContent)
    expect(subTexts.every(t => !t?.includes('2026'))).toBe(true)
  })
})
