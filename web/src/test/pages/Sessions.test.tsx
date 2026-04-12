import { render, screen } from '@testing-library/react'
import { Sessions } from '../../pages/Sessions'
import { mockSessions } from '../fixtures'

describe('Sessions page', () => {
  it('renders section header', () => {
    render(<Sessions data={mockSessions} />)
    expect(screen.getByText('Sessions')).toBeInTheDocument()
  })

  it('shows total session count', () => {
    render(<Sessions data={mockSessions} />)
    expect(screen.getByText('3')).toBeInTheDocument()
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
    const withMissing = [{ session_id: 'x' }]
    render(<Sessions data={withMissing} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('handles empty sessions array', () => {
    render(<Sessions data={[]} />)
    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
