import { render, screen } from '@testing-library/react'
import { SectionHeader } from '../../components/SectionHeader'

describe('SectionHeader', () => {
  it('renders title', () => {
    render(<SectionHeader title="Stats" />)
    expect(screen.getByText('Stats')).toBeInTheDocument()
  })

  it('renders sub text when provided', () => {
    render(<SectionHeader title="Stats" sub="Jan – Mar 2026" />)
    expect(screen.getByText('Jan – Mar 2026')).toBeInTheDocument()
  })

  it('does not render sub element when omitted', () => {
    const { container } = render(<SectionHeader title="Stats" />)
    expect(container.querySelectorAll('div').length).toBe(1)
  })
})
