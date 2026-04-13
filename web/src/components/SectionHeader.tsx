import { c } from '../theme/colors'

interface Props {
  title: string
  sub?: string
}

export function SectionHeader({ title, sub }: Props) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ margin: 0, color: c.text, fontSize: 18 }}>{title}</h2>
      {sub && <div style={{ color: c.textFaint, fontSize: 13, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
