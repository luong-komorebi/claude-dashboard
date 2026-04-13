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
    expect(screen.getByText('myrepo')).toBeInTheDocument()
    expect(screen.getByText('other')).toBeInTheDocument()
  })

  it('memory file bodies hidden by default', () => {
    render(<Projects data={mockProjects} />)
    // The raw frontmatter line should not be visible until the memory file is expanded
    expect(screen.queryByText(/type: user/)).not.toBeInTheDocument()
  })

  it('shows no memory files message for empty projects', () => {
    render(<Projects data={mockProjects} />)
    expect(screen.getByText('No memory files')).toBeInTheDocument()
  })

  it('expands memory file to show raw content on click', async () => {
    const user = userEvent.setup()
    render(<Projects data={mockProjects} />)
    await user.click(screen.getByText('User role'))
    expect(screen.getByText(/type: user/)).toBeInTheDocument()
  })

  it('handles empty projects list', () => {
    render(<Projects data={[]} />)
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })
})
