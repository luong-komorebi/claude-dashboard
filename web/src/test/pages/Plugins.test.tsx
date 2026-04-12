import { render, screen } from '@testing-library/react'
import { Plugins } from '../../pages/Plugins'
import { mockPlugins } from '../fixtures'

describe('Plugins page', () => {
  it('renders section heading', () => {
    render(<Plugins data={mockPlugins} />)
    expect(screen.getByRole('heading', { name: 'Plugins' })).toBeInTheDocument()
  })

  it('shows total installed count label', () => {
    render(<Plugins data={mockPlugins} />)
    expect(screen.getByText('Total Installed')).toBeInTheDocument()
  })

  it('renders enabled plugin names', () => {
    render(<Plugins data={mockPlugins} />)
    expect(screen.getByText('superpowers')).toBeInTheDocument()
    expect(screen.getByText('railway')).toBeInTheDocument()
  })

  it('renders disabled plugin', () => {
    render(<Plugins data={mockPlugins} />)
    expect(screen.getByText('old-plugin')).toBeInTheDocument()
  })

  it('shows registry names', () => {
    render(<Plugins data={mockPlugins} />)
    expect(screen.getByText('@claude-plugins-official')).toBeInTheDocument()
  })

  it('renders no disabled section when all enabled', () => {
    const allEnabled = mockPlugins.map(p => ({ ...p, enabled: true }))
    render(<Plugins data={allEnabled} />)
    // "Disabled" section heading should not be present (stat card label "Disabled" might still be)
    const disabledSection = screen.queryByText('Disabled', { selector: 'div[style*="font-weight: 600"]' })
    expect(disabledSection).not.toBeInTheDocument()
  })

  it('renders no enabled section when all disabled', () => {
    const allDisabled = mockPlugins.map(p => ({ ...p, enabled: false }))
    render(<Plugins data={allDisabled} />)
    const enabledSection = screen.queryByText('Enabled', { selector: 'div[style*="font-weight: 600"]' })
    expect(enabledSection).not.toBeInTheDocument()
  })
})
