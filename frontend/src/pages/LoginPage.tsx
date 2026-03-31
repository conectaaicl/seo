import { useState } from 'react'
import { login } from '../api'
import { C } from '../components/UI'

export default function LoginPage({ onLogin }: { onLogin: (user: any, token: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setLoading(true); setError('')
    try {
      const r = await login(email.trim(), password)
      localStorage.setItem('seo_token', r.token)
      localStorage.setItem('seo_user', JSON.stringify(r.user))
      onLogin(r.user, r.token)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(99,102,241,0.12) 0%, transparent 70%)',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, marginBottom: 16,
            boxShadow: '0 0 40px rgba(99,102,241,0.4)',
          }}>🚀</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>SEO UltraPRO</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>by ConectaAI</div>
        </div>

        {/* Card */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Iniciar sesión</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Accede a tu plataforma SEO</div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
                  background: C.surface, border: `1px solid ${C.border}`, color: C.text,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
                  background: C.surface, border: `1px solid ${C.border}`, color: C.text,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: '#ef444418', border: '1px solid #ef444440', borderRadius: 8,
                padding: '10px 14px', fontSize: 13, color: '#fca5a5',
              }}>
                ⚠ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              style={{
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
                border: 'none', borderRadius: 10, padding: '12px',
                fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, marginTop: 4,
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? '⏳ Iniciando sesión...' : 'Ingresar →'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: C.muted }}>
          ConectaAI © 2026 · SEO UltraPRO v3.0
        </div>
      </div>

      <style>{`
        input:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
      `}</style>
    </div>
  )
}
