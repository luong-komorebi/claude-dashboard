import { useState } from 'react'
import { c } from '../theme/colors'
import {
  getOnlineConfig,
  setOnlineConfig,
  maskApiKey,
  type OnlineConfig,
} from '../online/config'

interface Props {
  onChange: () => void
}

/**
 * Opt-in online mode controls. Lives in the main Settings page and is
 * off by default. Toggling it here changes app behavior immediately via
 * the `onChange` callback (which triggers a live-usage refetch on Overview).
 */
export function OnlineModeSettings({ onChange }: Props) {
  const [config, setConfig] = useState<OnlineConfig>(() => getOnlineConfig())
  const [draftKey, setDraftKey] = useState(config.apiKey)
  const [reveal, setReveal] = useState(false)

  const save = (next: Partial<OnlineConfig>) => {
    const merged = { ...config, ...next }
    setConfig(merged)
    setOnlineConfig(merged)
    onChange()
  }

  const saveKey = () => {
    save({ apiKey: draftKey.trim() })
  }

  const disable = () => {
    save({ enabled: false })
  }

  const enable = () => {
    if (!draftKey.trim().startsWith('sk-ant-admin')) {
      // Still save, but the API call will fail with 401 — warning shown in UI
    }
    save({ enabled: true, apiKey: draftKey.trim() })
  }

  const hasKey = config.apiKey.length > 0

  return (
    <div style={{
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderLeft: `3px solid ${config.enabled ? c.warning : c.border}`,
      borderRadius: 6,
      padding: 16,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ color: c.text, fontSize: 13, fontWeight: 600 }}>
            Online mode {config.enabled && <span style={{ color: c.warning, fontSize: 11, marginLeft: 6 }}>● active</span>}
          </div>
          <div style={{ color: c.textFaint, fontSize: 11, marginTop: 2 }}>
            Anthropic Claude Code Analytics Admin API — org-admin accounts only
          </div>
        </div>
        {config.enabled ? (
          <button
            onClick={disable}
            style={{
              background: c.surfaceHover, border: `1px solid ${c.border}`,
              color: c.textMuted, borderRadius: 3, padding: '5px 12px',
              fontSize: 11, cursor: 'pointer',
            }}
          >
            Disable
          </button>
        ) : (
          <button
            onClick={enable}
            disabled={!draftKey.trim()}
            style={{
              background: draftKey.trim() ? c.accent : c.surfaceHover,
              color: draftKey.trim() ? c.accentFg : c.textDisabled,
              border: 'none',
              borderRadius: 3,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: draftKey.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Enable
          </button>
        )}
      </div>

      <div style={{ fontSize: 11, color: c.textMuted, lineHeight: 1.6, marginBottom: 12 }}>
        When enabled, the dashboard fetches live organization-wide usage metrics
        (cost, sessions, tool acceptance rates, commits, PRs, per-user breakdowns)
        directly from <code style={code}>api.anthropic.com</code>.
        {' '}<strong style={{ color: c.warning }}>Your Admin API key is sent to Anthropic on every refresh.</strong>
        {' '}The dashboard's CSP allows exactly one external origin
        (<code style={code}>api.anthropic.com</code>) while online mode is on;
        the privacy badge reflects that.
      </div>

      {/* API key input */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          color: c.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
        }}>
          Admin API key
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type={reveal ? 'text' : 'password'}
            value={draftKey}
            onChange={e => setDraftKey(e.target.value)}
            placeholder={hasKey ? maskApiKey(config.apiKey) : 'sk-ant-admin-…'}
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1, background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: 3, color: c.text, padding: '6px 10px',
              fontSize: 12, fontFamily: 'monospace', outline: 'none',
            }}
          />
          <button
            onClick={() => setReveal(r => !r)}
            style={{
              background: c.surfaceHover, border: `1px solid ${c.border}`,
              color: c.textFaint, borderRadius: 3, padding: '5px 10px',
              fontSize: 11, cursor: 'pointer',
            }}
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
          {draftKey !== config.apiKey && (
            <button
              onClick={saveKey}
              style={{
                background: c.accent, color: c.accentFg, border: 'none',
                borderRadius: 3, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Save
            </button>
          )}
        </div>
        {draftKey && !draftKey.startsWith('sk-ant-admin') && (
          <div style={{ fontSize: 10, color: c.warning, marginTop: 4 }}>
            Admin API keys start with <code style={code}>sk-ant-admin-</code>. This doesn't look like one — the API call will probably fail.
          </div>
        )}
      </div>

      {/* Days to fetch */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          color: c.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
        }}>
          Days of history
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[1, 7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => save({ daysToFetch: d })}
              style={{
                background: config.daysToFetch === d ? c.surfaceHover : 'transparent',
                border: `1px solid ${config.daysToFetch === d ? c.accent : c.border}`,
                color: config.daysToFetch === d ? c.text : c.textFaint,
                borderRadius: 3, padding: '4px 10px', fontSize: 11,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {d}d
            </button>
          ))}
          <span style={{ color: c.textGhost, fontSize: 10, marginLeft: 6 }}>
            (each day = one API call, paginated)
          </span>
        </div>
      </div>

      <div style={{ fontSize: 10, color: c.textGhost, lineHeight: 1.5, paddingTop: 8, borderTop: `1px solid ${c.borderSoft}` }}>
        <strong style={{ color: c.textFaint }}>Gotcha:</strong> the API is restricted to
        organization admins — individual Pro/Max/API customers will get HTTP 403.
        Browser CORS support isn't officially documented; if the preflight fails,
        the error is surfaced on the Overview page with a link back here.
      </div>
    </div>
  )
}

const code: React.CSSProperties = {
  background: c.surfaceHover,
  padding: '1px 6px',
  borderRadius: 3,
  fontSize: 10,
  fontFamily: 'monospace',
}
