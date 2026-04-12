import { render, screen } from '@testing-library/react'
import { Settings } from '../../pages/Settings'
import { mockSettings } from '../fixtures'

describe('Settings page', () => {
  it('renders section header', () => {
    render(<Settings data={mockSettings} />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('shows allowed tools count', () => {
    render(<Settings data={mockSettings} />)
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

  it('renders allowed tool names', () => {
    render(<Settings data={mockSettings} />)
    expect(screen.getByText('WebSearch')).toBeInTheDocument()
    expect(screen.getByText('Bash(git:*)')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })

  it('renders enabled plugins', () => {
    render(<Settings data={mockSettings} />)
    expect(screen.getByText('superpowers@official')).toBeInTheDocument()
    expect(screen.getByText('railway@skills')).toBeInTheDocument()
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

  it('hides disabled plugins section when empty', () => {
    render(<Settings data={{ ...mockSettings, disabled_plugins: [] }} />)
    expect(screen.queryByText('Disabled Plugins')).not.toBeInTheDocument()
  })
})
