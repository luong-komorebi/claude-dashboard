import { render, screen } from '@testing-library/react'
import { Plugins } from '../../pages/Plugins'
import { mockPlugins } from '../fixtures'

describe('Plugins page', () => {
  it('renders section header', () => {
    render(<Plugins data={mockPlugins} />)
    expect(screen.getByText('Plugins')).toBeInTheDocument()
  })

  it('shows total count', () => {
    render(<Plugins data={mockPlugins} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows enabled and disabled counts', () => {
    render(<Plugins data={mockPlugins} />)
    expect(screen.getByText('2')).toBeInTheDocument() // enabled
    expect(screen.getByText('1')).toBeInTheDocument() // disabled
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
    expect(screen.queryByText('Disabled')).not.toBeInTheDocument()
  })

  it('renders no enabled section when all disabled', () => {
    const allDisabled = mockPlugins.map(p => ({ ...p, enabled: false }))
    render(<Plugins data={allDisabled} />)
    expect(screen.queryByText('Enabled')).not.toBeInTheDocument()
  })
})
