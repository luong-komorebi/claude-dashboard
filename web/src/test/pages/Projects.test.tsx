import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Projects } from '../../pages/Projects'
import { mockProjects } from '../fixtures'

describe('Projects page', () => {
  it('renders section heading', () => {
    render(<Projects data={mockProjects} />)
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })

  it('shows project paths', () => {
    render(<Projects data={mockProjects} />)
    expect(screen.getByText('/Users/alice/myrepo')).toBeInTheDocument()
    expect(screen.getByText('/Users/alice/other')).toBeInTheDocument()
  })

  it('memory files hidden by default (collapsed)', () => {
    render(<Projects data={mockProjects} />)
    expect(screen.queryByText('Senior engineer working on dashboard')).not.toBeInTheDocument()
  })

  it('expands project to show memory files on click', async () => {
    const user = userEvent.setup()
    render(<Projects data={mockProjects} />)
    await user.click(screen.getByText('/Users/alice/myrepo'))
    expect(screen.getByText(/Senior engineer working on dashboard/)).toBeInTheDocument()
  })

  it('shows no memory files message for empty projects', async () => {
    const user = userEvent.setup()
    render(<Projects data={mockProjects} />)
    await user.click(screen.getByText('/Users/alice/other'))
    expect(screen.getByText('No memory files')).toBeInTheDocument()
  })

  it('collapses project on second click', async () => {
    const user = userEvent.setup()
    render(<Projects data={mockProjects} />)
    await user.click(screen.getByText('/Users/alice/myrepo'))
    await user.click(screen.getByText('/Users/alice/myrepo'))
    expect(screen.queryByText(/Senior engineer/)).not.toBeInTheDocument()
  })

  it('handles empty projects list', () => {
    render(<Projects data={[]} />)
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })
})
