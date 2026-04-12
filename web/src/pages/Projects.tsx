import { useState } from 'react'
import type { Project, MemoryFile } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'

function MemoryFileView({ file }: { file: MemoryFile }) {
  const [open, setOpen] = useState(false)
  const name = extractFrontmatterField(file.content, 'name') ?? file.name
  const type = extractFrontmatterField(file.content, 'type')
  const desc = extractFrontmatterField(file.content, 'description')

  return (
    <div style={{ borderTop: '1px solid #1e1e1e', padding: '8px 0 8px 16px' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ color: '#555', fontSize: 11 }}>{open ? '▼' : '▶'}</span>
        <span style={{ color: '#7c6af7', fontSize: 13, fontWeight: 500 }}>{name}</span>
        {type && <span style={{ color: '#555', fontSize: 11, background: '#1e1e1e', borderRadius: 3, padding: '1px 6px' }}>{type}</span>}
        {desc && <span style={{ color: '#555', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</span>}
      </div>
      {open && (
        <pre style={{ margin: '8px 0 0 16px', color: '#aaa', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {file.content}
        </pre>
      )}
    </div>
  )
}

export function Projects({ data }: { data: Project[] }) {
  const totalMemory = data.reduce((s, p) => s + p.memory_files.length, 0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <div>
      <SectionHeader title="Projects" sub="Directories Claude has memory for" />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="Projects" value={data.length} sub="with Claude memory" highlight />
        <StatCard label="Memory Files" value={totalMemory} sub="across all projects" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map(p => (
          <div key={p.id} style={{ background: '#111', border: '1px solid #333', borderRadius: 6, overflow: 'hidden' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', cursor: 'pointer' }}
              onClick={() => toggle(p.id)}
            >
              <span style={{ color: '#7c6af7', fontSize: 13 }}>{expanded.has(p.id) ? '▼' : '▶'}</span>
              <span style={{ color: '#e8e8e8', fontWeight: 600, fontSize: 13 }}>{p.path}</span>
              <span style={{ color: '#555', fontSize: 12, marginLeft: 'auto' }}>
                {p.memory_files.length} memory file{p.memory_files.length !== 1 ? 's' : ''}
              </span>
            </div>
            {expanded.has(p.id) && (
              <div>
                {p.memory_files.length === 0
                  ? <div style={{ padding: '8px 32px', color: '#555', fontSize: 13 }}>No memory files</div>
                  : p.memory_files.map(mf => <MemoryFileView key={mf.name} file={mf} />)
                }
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function extractFrontmatterField(content: string, field: string): string | undefined {
  const lines = content.split('\n')
  let inFm = false, dashes = 0
  for (const line of lines) {
    if (line === '---') {
      dashes++
      inFm = dashes === 1
      if (dashes === 2) break
      continue
    }
    if (inFm && line.startsWith(`${field}:`)) {
      return line.slice(field.length + 1).trim()
    }
  }
}
