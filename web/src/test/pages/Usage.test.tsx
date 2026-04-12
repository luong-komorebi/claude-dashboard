import { render, screen } from '@testing-library/react'
import { Usage } from '../../pages/Usage'
import { mockUsage } from '../fixtures'

describe('Usage page', () => {
  it('renders section header', () => {
    render(<Usage data={mockUsage} />)
    expect(screen.getByText('Usage')).toBeInTheDocument()
  })

  it('displays total sessions', () => {
    render(<Usage data={mockUsage} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows outcome distribution labels', () => {
    render(<Usage data={mockUsage} />)
    expect(screen.getByText('mostly_achieved')).toBeInTheDocument()
    expect(screen.getByText('fully_achieved')).toBeInTheDocument()
    expect(screen.getByText('partially_achieved')).toBeInTheDocument()
  })

  it('shows helpfulness labels', () => {
    render(<Usage data={mockUsage} />)
    expect(screen.getByText('very_helpful')).toBeInTheDocument()
    expect(screen.getByText('helpful')).toBeInTheDocument()
  })

  it('renders session summaries in table', () => {
    render(<Usage data={mockUsage} />)
    expect(screen.getByText('Fix auth bug')).toBeInTheDocument()
    expect(screen.getByText('Add dashboard feature')).toBeInTheDocument()
  })

  it('shows session types in table', () => {
    render(<Usage data={mockUsage} />)
    expect(screen.getByText('bug_fix')).toBeInTheDocument()
    expect(screen.getByText('feature_development')).toBeInTheDocument()
  })

  it('handles empty facets', () => {
    const empty = { ...mockUsage, facets: [], total_sessions: 0, outcome_counts: {}, helpfulness_counts: {} }
    render(<Usage data={empty} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
