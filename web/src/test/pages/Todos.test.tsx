import { render, screen } from '@testing-library/react'
import { Todos } from '../../pages/Todos'
import { mockTodos } from '../fixtures'

describe('Todos page', () => {
  it('renders section heading', () => {
    render(<Todos data={mockTodos} />)
    expect(screen.getByRole('heading', { name: 'Todos & Plans' })).toBeInTheDocument()
  })

  it('shows In Progress stat card', () => {
    render(<Todos data={mockTodos} />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('shows in-progress task content', () => {
    render(<Todos data={mockTodos} />)
    expect(screen.getByText('Write tests')).toBeInTheDocument()
  })

  it('shows pending task content', () => {
    render(<Todos data={mockTodos} />)
    expect(screen.getByText('Review PR')).toBeInTheDocument()
  })

  it('does not show completed tasks in active view', () => {
    render(<Todos data={mockTodos} />)
    expect(screen.queryByText('Update docs')).not.toBeInTheDocument()
  })

  it('shows plan names', () => {
    render(<Todos data={mockTodos} />)
    expect(screen.getByText(/feature-plan/)).toBeInTheDocument()
  })

  it('shows plan content preview', () => {
    render(<Todos data={mockTodos} />)
    expect(screen.getByText(/Feature Plan/)).toBeInTheDocument()
  })

  it('handles empty todos data', () => {
    const empty = { sessions: [], plans: [], pending_count: 0, in_progress_count: 0, completed_count: 0 }
    render(<Todos data={empty} />)
    expect(screen.getByRole('heading', { name: 'Todos & Plans' })).toBeInTheDocument()
  })

  it('hides active sessions section when all completed', () => {
    const allDone = {
      ...mockTodos,
      sessions: [{ id: 'session', items: [{ content: 'Done task', status: 'completed', activeForm: 'Done' }] }],
    }
    render(<Todos data={allDone} />)
    expect(screen.queryByText('Done task')).not.toBeInTheDocument()
  })
})
