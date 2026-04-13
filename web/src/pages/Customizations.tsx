import { useMemo, useState } from 'react'
import type { CustomCommand, CustomSkill, ConnectedIde } from '../api'
import { StatCard } from '../components/StatCard'
import { SectionHeader } from '../components/SectionHeader'
import { SearchInput, matchesQuery } from '../components/SearchInput'
import { c } from '../theme/colors'

interface Props {
  commands: CustomCommand[]
  skills: CustomSkill[]
  connectedIdes: ConnectedIde[]
}

export function Customizations({ commands, skills, connectedIdes }: Props) {
  const [query, setQuery] = useState('')

  const filteredCommands = useMemo(() => {
    if (!query) return commands
    return commands.filter(
      cmd =>
        matchesQuery(cmd.name, query) ||
        matchesQuery(cmd.description ?? '', query) ||
        matchesQuery(cmd.body, query),
    )
  }, [commands, query])

  const filteredSkills = useMemo(() => {
    if (!query) return skills
    return skills.filter(s => matchesQuery(s.name, query) || matchesQuery(s.description ?? '', query))
  }, [skills, query])

  const totalMatches = query ? filteredCommands.length + filteredSkills.length : undefined

  return (
    <div>
      <SectionHeader
        title="Customizations"
        sub="Your custom slash commands, skills, and connected IDE extensions"
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard label="Commands" value={commands.length} sub="custom slash /foo" highlight />
        <StatCard label="Skills" value={skills.length} sub="SKILL.md entries" />
        <StatCard
          label="Connected IDEs"
          value={connectedIdes.length}
          sub={connectedIdes.length > 0 ? connectedIdes[0].ideName : 'none attached'}
          color={connectedIdes.length > 0 ? c.success : undefined}
        />
      </div>

      {(commands.length > 0 || skills.length > 0) && (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search commands and skills…"
          count={totalMatches}
        />
      )}

      {/* Commands */}
      <Section title={`Custom Commands${query ? ` (${filteredCommands.length})` : ''}`}>
        {filteredCommands.length === 0 ? (
          <EmptyRow text={query ? `No commands match "${query}"` : 'No commands in ~/.claude/commands/'} />
        ) : (
          filteredCommands.map(cmd => <CommandRow key={cmd.name} command={cmd} />)
        )}
      </Section>

      {/* Skills */}
      <Section title={`Skills${query ? ` (${filteredSkills.length})` : ''}`}>
        {filteredSkills.length === 0 ? (
          <EmptyRow text={query ? `No skills match "${query}"` : 'No skills in ~/.claude/skills/'} />
        ) : (
          filteredSkills.map(s => <SkillRow key={s.name} skill={s} />)
        )}
      </Section>

      {/* Connected IDEs */}
      <Section title="Connected IDEs">
        {connectedIdes.length === 0 ? (
          <EmptyRow text="No IDE extensions attached — auth tokens are automatically redacted when any appear here" />
        ) : (
          connectedIdes.map(ide => <IdeRow key={ide.pid} ide={ide} />)
        )}
      </Section>
    </div>
  )
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

function CommandRow({ command }: { command: CustomCommand }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: `1px solid ${c.borderSoft}`, padding: '8px 12px' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
      >
        <span style={{ color: c.textFaint, fontSize: 10 }}>{open ? '▼' : '▶'}</span>
        <span style={{ color: c.accent, fontFamily: 'monospace', fontSize: 13, fontWeight: 500 }}>
          /{command.name}
        </span>
        {command.description && (
          <span style={{
            color: c.textFaint, fontSize: 11, flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            — {command.description}
          </span>
        )}
      </div>
      {open && command.body && (
        <pre style={{
          margin: '8px 0 0 16px',
          color: c.textMuted,
          fontSize: 11,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 240,
          overflowY: 'auto',
        }}>
          {command.body}
        </pre>
      )}
    </div>
  )
}

function SkillRow({ skill }: { skill: CustomSkill }) {
  return (
    <div style={{
      borderTop: `1px solid ${c.borderSoft}`,
      padding: '8px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ color: c.accent, fontSize: 13 }}>🎓</span>
      <span style={{ color: c.text, fontFamily: 'monospace', fontSize: 13, fontWeight: 500 }}>
        {skill.name}
      </span>
      {skill.hasScripts && (
        <span style={{
          color: c.success, fontSize: 9, fontWeight: 600,
          background: c.successBg, border: `1px solid ${c.successBorder}`,
          borderRadius: 3, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          scripts
        </span>
      )}
      {skill.description && (
        <span style={{
          color: c.textFaint, fontSize: 11, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          — {skill.description}
        </span>
      )}
    </div>
  )
}

function IdeRow({ ide }: { ide: ConnectedIde }) {
  return (
    <div style={{
      borderTop: `1px solid ${c.borderSoft}`,
      padding: '8px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: c.success,
        }} />
        <span style={{ color: c.text, fontSize: 13, fontWeight: 500 }}>{ide.ideName}</span>
        <span style={{ color: c.textFaint, fontSize: 11 }}>
          pid {ide.pid} · {ide.transport}
          {ide.runningInWindows && ' · windows'}
        </span>
      </div>
      {ide.workspaceFolders.length > 0 && (
        <div style={{ marginTop: 4, marginLeft: 16, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {ide.workspaceFolders.map(folder => (
            <span key={folder} style={{
              fontFamily: 'monospace', fontSize: 10,
              color: c.textMuted, background: c.surfaceHover,
              padding: '2px 6px', borderRadius: 3,
            }} title={folder}>
              {folder.split('/').filter(Boolean).slice(-2).join('/') || folder}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6,
      overflow: 'hidden', marginBottom: 14,
    }}>
      <div style={{
        padding: '10px 14px',
        background: c.surfaceAlt,
        color: c.accent,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{
      color: c.textGhost, fontSize: 12,
      padding: '12px 14px', fontStyle: 'italic',
    }}>
      {text}
    </div>
  )
}
