import { render, screen } from '@testing-library/react'
import { Settings } from '../../pages/Settings'
import { mockSettings } from '../fixtures'

describe('Settings page', () => {
  it('renders section heading', () => {
    render(<Settings data={mockSettings} />)
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('shows allowed tools count', () => {
    render(<Settings data={mockSettings} />)
    // mockSettings.allowed_tools has 3 entries — appears in StatCard value
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows effort level', () => {
    render(<Settings data={mockSettings} />)
    expect(screen.getByText('high')).toBeInTheDocument()
  })

  it('shows always thinking status', () => {
    render(<Settings data={mockSettings} />)
    expect(screen.getByText('on')).toBeInTheDocument()
  })

  it('renders allowed tool names as pills', () => {
    render(<Settings data={mockSettings} />)
    expect(screen.getByText('WebSearch')).toBeInTheDocument()
    expect(screen.getByText('Bash(git:*)')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })

  it('renders history entries', () => {
    render(<Settings data={mockSettings} />)
    expect(screen.getByText('cargo test')).toBeInTheDocument()
    expect(screen.getByText('git status')).toBeInTheDocument()
  })

  it('shows off for always_thinking=false', () => {
    render(<Settings data={{ ...mockSettings, always_thinking: false }} />)
    expect(screen.getByText('off')).toBeInTheDocument()
  })

  it('shows default for missing effort_level', () => {
    render(<Settings data={{ ...mockSettings, effort_level: undefined }} />)
    expect(screen.getByText('default')).toBeInTheDocument()
  })
})
