import { render, screen } from '@testing-library/react'
import { StatCard } from '../../components/StatCard'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total Messages" value={23059} />)
    expect(screen.getByText('Total Messages')).toBeInTheDocument()
    expect(screen.getByText(23059)).toBeInTheDocument()
  })

  it('renders sub text when provided', () => {
    render(<StatCard label="Sessions" value={42} sub="active days" />)
    expect(screen.getByText('active days')).toBeInTheDocument()
  })

  it('does not render sub element when omitted', () => {
    render(<StatCard label="Sessions" value={42} />)
    expect(screen.queryByText('active days')).not.toBeInTheDocument()
  })

  it('renders string values', () => {
    render(<StatCard label="Effort Level" value="high" />)
    expect(screen.getByText('high')).toBeInTheDocument()
  })

  it('applies highlight border when highlight=true', () => {
    const { container } = render(<StatCard label="L" value="V" highlight />)
    const card = container.firstChild as HTMLElement
    expect(card.style.border).toContain('#7c6af7')
  })

  it('applies default border when highlight is not set', () => {
    const { container } = render(<StatCard label="L" value="V" />)
    const card = container.firstChild as HTMLElement
    expect(card.style.border).toContain('#333')
  })
})
