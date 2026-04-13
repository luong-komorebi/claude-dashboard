import { useMemo, useState } from 'react'
import type { Project, MemoryFile } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'
import { SearchInput } from '../components/SearchInput'
import { c } from '../theme/colors'

// ─── Tree model ───────────────────────────────────────────────────────────────

interface TreeNode {
  /** Display name — may span multiple path segments after collapse */
  name: string
  /** Absolute path up to and including this node */
  fullPath: string
  /** Non-null iff this node is a project leaf */
  project: Project | null
  children: TreeNode[]
}

function buildTree(projects: Project[]): TreeNode {
  const root: TreeNode = { name: '', fullPath: '', project: null, children: [] }

  for (const proj of projects) {
    const segments = proj.path.split('/').filter(Boolean)
    let current = root
    segments.forEach((seg, i) => {
      let child = current.children.find(n => n.name === seg)
      if (!child) {
        child = {
          name: seg,
          fullPath: '/' + segments.slice(0, i + 1).join('/'),
          project: null,
          children: [],
        }
        current.children.push(child)
      }
      current = child
      if (i === segments.length - 1) current.project = proj
    })
  }

  collapseSingleChildChains(root)
  sortTree(root)
  return root
}

/**
 * Merges parent → child nodes when the parent has exactly one child and isn't
 * itself a project leaf. Turns `/Users/luong/luong-komorebi/repo` (3 nested
 * nodes) into a single "Users/luong/luong-komorebi/repo" row. Keeps the tree
 * compact when users have deep but sparse home-directory structures.
 */
function collapseSingleChildChains(node: TreeNode): void {
  for (const child of node.children) collapseSingleChildChains(child)

  while (node.children.length === 1 && !node.project) {
    const only = node.children[0]
    node.name = node.name ? `${node.name}/${only.name}` : only.name
    node.fullPath = only.fullPath
    node.project = only.project
    node.children = only.children
  }
}

function sortTree(node: TreeNode): void {
  node.children.sort((a, b) => {
    // Directories with children go below leaves within the same level
    const aLeaf = a.children.length === 0
    const bLeaf = b.children.length === 0
    if (aLeaf !== bLeaf) return aLeaf ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const child of node.children) sortTree(child)
}

/**
 * Returns a filtered copy of the tree containing only nodes whose path, memory
 * file name, or memory file content matches the query, plus the ancestors
 * required to reach them. Returns null if nothing matches.
 */
function filterTree(node: TreeNode, query: string): TreeNode | null {
  if (!query) return node

  const q = query.toLowerCase()
  const selfMatches =
    node.fullPath.toLowerCase().includes(q) ||
    (node.project?.memory_files.some(
      mf => mf.name.toLowerCase().includes(q) || mf.content.toLowerCase().includes(q),
    ) ?? false)

  const filteredChildren = node.children
    .map(c => filterTree(c, query))
    .filter((n): n is TreeNode => n !== null)

  if (!selfMatches && filteredChildren.length === 0) return null
  return { ...node, children: filteredChildren }
}

function countLeaves(node: TreeNode): number {
  if (node.project !== null) return 1 + node.children.reduce((s, c) => s + countLeaves(c), 0)
  return node.children.reduce((s, c) => s + countLeaves(c), 0)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Projects({ data }: { data: Project[] }) {
  const [query, setQuery] = useState('')

  const tree = useMemo(() => buildTree(data), [data])
  const filtered = useMemo(() => filterTree(tree, query), [tree, query])

  const totalMemory = data.reduce((s, p) => s + p.memory_files.length, 0)
  const matchCount = filtered ? countLeaves(filtered) : 0

  return (
    <div>
      <SectionHeader title="Projects" sub="Directories Claude has memory for, grouped by path" />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard label="Projects" value={data.length} sub="with Claude memory" highlight />
        <StatCard label="Memory Files" value={totalMemory} sub="across all projects" />
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search paths, memory file names, or contents…"
        count={query ? matchCount : undefined}
      />

      {!filtered || filtered.children.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6, padding: 8 }}>
          {filtered.children.map(child => (
            <TreeNodeView key={child.fullPath} node={child} depth={0} autoExpand={!!query} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tree node renderer ──────────────────────────────────────────────────────

function TreeNodeView({
  node,
  depth,
  autoExpand,
}: {
  node: TreeNode
  depth: number
  autoExpand: boolean
}) {
  const [open, setOpen] = useState(autoExpand || depth < 1)
  const hasChildren = node.children.length > 0
  const hasProject = node.project !== null
  const isClickable = hasChildren || hasProject

  return (
    <div>
      <div
        onClick={() => isClickable && setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          paddingLeft: 8 + depth * 18,
          cursor: isClickable ? 'pointer' : 'default',
          borderRadius: 4,
          fontSize: 13,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = c.surfaceHover)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span
          style={{
            color: c.textFaint,
            fontSize: 10,
            width: 10,
            display: 'inline-block',
            textAlign: 'center',
          }}
        >
          {isClickable ? (open ? '▼' : '▶') : ''}
        </span>
        <span style={{ color: c.textFaint, fontSize: 13 }}>
          {hasProject && !hasChildren ? '📄' : '📁'}
        </span>
        <span
          style={{
            color: hasProject ? c.text : c.textMuted,
            fontFamily: 'monospace',
            fontWeight: hasProject ? 500 : 400,
          }}
        >
          {node.name}
        </span>
        {hasProject && node.project && (
          <span style={{ marginLeft: 'auto', color: c.textFaint, fontSize: 11 }}>
            {node.project.memory_files.length} memory file
            {node.project.memory_files.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {open && (
        <>
          {hasProject && node.project && (
            <div style={{ paddingLeft: 8 + (depth + 1) * 18 }}>
              {node.project.memory_files.length === 0 ? (
                <div style={{ color: c.textGhost, fontSize: 12, padding: '4px 0' }}>
                  No memory files
                </div>
              ) : (
                node.project.memory_files.map(mf => <MemoryFileView key={mf.name} file={mf} />)
              )}
            </div>
          )}
          {node.children.map(child => (
            <TreeNodeView
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              autoExpand={autoExpand}
            />
          ))}
        </>
      )}
    </div>
  )
}

// ─── Memory file renderer (unchanged shape) ──────────────────────────────────

function MemoryFileView({ file }: { file: MemoryFile }) {
  const [open, setOpen] = useState(false)
  const name = extractFrontmatterField(file.content, 'name') ?? file.name
  const type = extractFrontmatterField(file.content, 'type')
  const desc = extractFrontmatterField(file.content, 'description')

  return (
    <div style={{ borderTop: `1px solid ${c.borderSoft}`, padding: '6px 0 6px 12px' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ color: c.textGhost, fontSize: 10 }}>{open ? '▼' : '▶'}</span>
        <span style={{ color: c.accent, fontSize: 12, fontWeight: 500 }}>{name}</span>
        {type && (
          <span
            style={{
              color: c.textGhost,
              fontSize: 10,
              background: c.surfaceHover,
              borderRadius: 3,
              padding: '1px 6px',
            }}
          >
            {type}
          </span>
        )}
        {desc && (
          <span
            style={{
              color: c.textGhost,
              fontSize: 11,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {desc}
          </span>
        )}
      </div>
      {open && (
        <pre
          style={{
            margin: '6px 0 0 16px',
            color: c.textMuted,
            fontSize: 11,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {file.content}
        </pre>
      )}
    </div>
  )
}

function EmptyState({ query }: { query: string }) {
  return (
    <div
      style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: 6,
        padding: 32,
        textAlign: 'center',
        color: c.textGhost,
        fontSize: 13,
      }}
    >
      {query ? `No projects match "${query}"` : 'No projects found'}
    </div>
  )
}

function extractFrontmatterField(content: string, field: string): string | undefined {
  const lines = content.split('\n')
  let inFm = false
  let dashes = 0
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
