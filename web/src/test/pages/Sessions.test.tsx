import { render, screen } from '@testing-library/react'
import { Sessions } from '../../pages/Sessions'
import { mockSessions } from '../fixtures'

describe('Sessions page', () => {
  it('renders section heading', () => {
    render(<Sessions data={mockSessions} />)
    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument()
  })

  it('shows Sessions stat card label', () => {
    render(<Sessions data={mockSessions} />)
    // The stat card label "Sessions" and "with summaries" sub
    expect(screen.getByText('with summaries')).toBeInTheDocument()
  })

  it('renders session summaries', () => {
    render(<Sessions data={mockSessions} />)
    expect(screen.getByText('Fix auth bug')).toBeInTheDocument()
    expect(screen.getByText('Add dashboard feature')).toBeInTheDocument()
    expect(screen.getByText('Debug performance')).toBeInTheDocument()
  })

  it('renders session types', () => {
    render(<Sessions data={mockSessions} />)
    expect(screen.getByText('bug_fix')).toBeInTheDocument()
    expect(screen.getByText('feature_development')).toBeInTheDocument()
  })

  it('renders outcome values', () => {
    render(<Sessions data={mockSessions} />)
    expect(screen.getByText('mostly_achieved')).toBeInTheDocument()
    expect(screen.getByText('partially_achieved')).toBeInTheDocument()
  })

  it('shows em dash for missing summary', () => {
    render(<Sessions data={[{ session_id: 'x' }]} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('handles empty sessions array', () => {
    render(<Sessions data={[]} />)
    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument()
    expect(screen.getByText('with summaries')).toBeInTheDocument()
  })
})
