interface Props {
  title: string
  sub?: string
}

export function SectionHeader({ title, sub }: Props) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ margin: 0, color: '#e8e8e8', fontSize: 18 }}>{title}</h2>
      {sub && <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
