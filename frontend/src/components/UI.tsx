import { useState } from 'react'

export const C = {
  bg: '#080b10', sidebar: '#0d1117', card: '#131920', surface: '#0d1117',
  border: 'rgba(255,255,255,0.06)', accent: '#6366f1',
  green: '#10b981', text: '#e2e8f0', muted: '#64748b',
  orange: '#f59e0b', red: '#ef4444', blue: '#3b82f6', purple: '#8b5cf6',
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, ...style }}>
      {children}
    </div>
  )
}

export function Btn({
  onClick, children, disabled, variant = 'primary', small, loading, full
}: {
  onClick?: () => void; children: React.ReactNode; disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  small?: boolean; loading?: boolean; full?: boolean;
}) {
  const bg = variant === 'primary' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
    : variant === 'danger' ? C.red
    : variant === 'ghost' ? 'transparent'
    : C.surface
  const color = variant === 'ghost' ? C.muted : '#fff'
  const border = variant === 'ghost' ? `1px solid ${C.border}` : 'none'
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        background: bg, color, border, borderRadius: 9,
        padding: small ? '6px 12px' : '10px 18px',
        fontSize: small ? 11 : 13, fontWeight: 600,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        opacity: (disabled || loading) ? 0.6 : 1,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        width: full ? '100%' : 'auto', justifyContent: full ? 'center' : undefined,
        transition: 'opacity 0.2s',
      }}
    >
      {loading ? '⏳' : null} {children}
    </button>
  )
}

export function Field({
  label, value, onChange, placeholder, mono, rows, type = 'text', hint
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean; rows?: number; type?: string; hint?: string;
}) {
  const base: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 9, fontSize: 13,
    background: C.surface, border: `1px solid ${C.border}`, color: C.text,
    outline: 'none', boxSizing: 'border-box',
    fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
    lineHeight: 1.5,
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</label>}
      {rows ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          rows={rows} style={{ ...base, resize: 'vertical' }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} style={base} />
      )}
      {hint && <div style={{ fontSize: 11, color: C.muted }}>{hint}</div>}
    </div>
  )
}

export function Select({
  label, value, onChange, options
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 9, fontSize: 13,
          background: C.surface, border: `1px solid ${C.border}`, color: C.text,
          outline: 'none',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function Badge({ label, color = C.accent }: { label: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 9px',
      borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: color + '22', color,
    }}>{label}</span>
  )
}

export function ScoreCircle({ score, size = 80 }: { score: number; size?: number }) {
  const color = score >= 90 ? '#22c55e' : score >= 75 ? '#84cc16' : score >= 60 ? '#eab308' : score >= 45 ? '#f97316' : '#ef4444'
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F'
  const r = (size / 2) - 6
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: size > 60 ? 20 : 16, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: size > 60 ? 10 : 8, color: C.muted }}>{grade}</div>
      </div>
    </div>
  )
}

export function IssueRow({ issue }: { issue: { type: string; field: string; msg: string } }) {
  const icon = issue.type === 'ok' ? '✓' : issue.type === 'error' ? '✗' : '⚠'
  const color = issue.type === 'ok' ? '#22c55e' : issue.type === 'error' ? '#ef4444' : '#f59e0b'
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
      borderRadius: 8, background: color + '08', border: `1px solid ${color}20`,
    }}>
      <span style={{ color, fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginRight: 8 }}>{issue.field}</span>
        <span style={{ fontSize: 13, color: C.text }}>{issue.msg}</span>
      </div>
    </div>
  )
}

export function CopyBtn({ text, small }: { text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{
        background: copied ? '#10b981' : C.surface, color: copied ? '#fff' : C.muted,
        border: `1px solid ${C.border}`, borderRadius: 7,
        padding: small ? '4px 10px' : '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
      }}
    >
      {copied ? '✓ Copiado' : 'Copiar'}
    </button>
  )
}

export function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      background: '#ef444418', border: '1px solid #ef444440', borderRadius: 10,
      padding: '12px 16px', fontSize: 13, color: '#fca5a5',
    }}>⚠ {msg}</div>
  )
}

export function Loader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px 0' }}>
      <div style={{
        width: 40, height: 40, border: `3px solid ${C.border}`,
        borderTopColor: '#6366f1', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{ color: C.muted, fontSize: 13 }}>Analizando con IA...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
