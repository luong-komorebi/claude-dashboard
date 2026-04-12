import { render, screen } from '@testing-library/react'
import { Stats } from '../../pages/Stats'
import { mockStats } from '../fixtures'

describe('Stats page', () => {
  it('renders section header', () => {
    render(<Stats data={mockStats} />)
    expect(screen.getByText('Stats')).toBeInTheDocument()
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
    expect(screen.getByText(/2026-04-10/)).toBeInTheDocument()
    expect(screen.getByText(/2026-04-12/)).toBeInTheDocument()
  })

  it('renders daily activity table rows', () => {
    render(<Stats data={mockStats} />)
    expect(screen.getAllByText(/2026-04-/)).not.toHaveLength(0)
  })

  it('handles empty activity gracefully', () => {
    const empty = { ...mockStats, daily_activity: [], active_days: 0, date_range: null }
    render(<Stats data={empty} />)
    expect(screen.getByText('Stats')).toBeInTheDocument()
  })

  it('does not show subtitle when date_range is null', () => {
    const noRange = { ...mockStats, date_range: null }
    render(<Stats data={noRange} />)
    // subtitle only contains "Stats" heading, no date range text
    expect(screen.queryByText(/–/)).not.toBeInTheDocument()
  })
})
