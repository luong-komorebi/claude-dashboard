interface Props {
  label: string
  value: string | number
  sub?: string
  highlight?: boolean
  color?: string
}

export function StatCard({ label, value, sub, highlight, color }: Props) {
  return (
    <div style={{
      border: `1px solid ${highlight ? '#7c6af7' : '#333'}`,
      borderRadius: 6,
      padding: '12px 16px',
      flex: 1,
      minWidth: 120,
    }}>
      <div style={{ color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ color: color ?? '#e8e8e8', fontSize: 22, fontWeight: 700, margin: '4px 0' }}>{value}</div>
      {sub && <div style={{ color: '#555', fontSize: 11 }}>{sub}</div>}
    </div>
  )
}
