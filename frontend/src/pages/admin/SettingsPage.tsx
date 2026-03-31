import { useState, useEffect } from 'react'
import { get, put, post } from '../../api'
import { Card, Btn, Field, ErrorBox, C } from '../../components/UI'

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: C.muted }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </Card>
  )
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ok ? '#10b981' : '#ef4444', marginRight: 6 }} />
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>({})
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testingEmail, setTestingEmail] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    get('/admin/settings').then(s => {
      setSettings(s)
      setForm({
        GROQ_API_KEY: '',
        PAGESPEED_API_KEY: '',
        SMTP_HOST: s.SMTP_HOST || 'mail.conectaai.cl',
        SMTP_PORT: s.SMTP_PORT || '587',
        SMTP_USER: s.SMTP_USER || 'no-reply@conectaai.cl',
        SMTP_PASSWORD: '',
        SMTP_FROM: s.SMTP_FROM || 'SEO UltraPRO <no-reply@conectaai.cl>',
        APP_URL: s.APP_URL || 'https://seo.conectaai.cl',
      })
    }).finally(() => setLoading(false))
  }, [])

  const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true); setError(''); setSuccess('')
    // Only send non-empty values (don't overwrite secrets with empty string)
    const toSave: any = {}
    for (const [k, v] of Object.entries(form)) {
      if (v !== '') toSave[k] = v
    }
    try {
      await put('/admin/settings', toSave)
      setSuccess('✓ Configuración guardada')
      const s = await get('/admin/settings')
      setSettings(s)
      setForm((f: any) => ({ ...f, GROQ_API_KEY: '', PAGESPEED_API_KEY: '', SMTP_PASSWORD: '' }))
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function sendTestEmail() {
    if (!testEmail.trim()) return
    setTestingEmail(true); setError('')
    try {
      await post('/admin/test-email', { to: testEmail.trim() })
      setSuccess(`✓ Email de prueba enviado a ${testEmail}`)
    } catch (e: any) { setError(e.message) }
    finally { setTestingEmail(false) }
  }

  if (loading) return <div style={{ padding: '60px 0', textAlign: 'center', color: C.muted }}>Cargando...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Configuración</div>
        <div style={{ fontSize: 13, color: C.muted }}>API Keys, SMTP y ajustes del sistema</div>
      </div>

      {error && <ErrorBox msg={error} />}
      {success && (
        <div style={{ background: '#10b98118', border: '1px solid #10b98140', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#10b981' }}>
          {success}
        </div>
      )}

      {/* API Keys */}
      <Section title="🤖 API Keys" desc="Claves de acceso a servicios externos">
        <div style={{ background: C.surface, borderRadius: 10, padding: '14px 16px', marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Estado actual</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13 }}>
              <StatusDot ok={!!settings.GROQ_API_KEY} />
              <span style={{ color: C.text }}>Groq API</span>
              {settings.GROQ_API_KEY_masked && (
                <span style={{ color: C.muted, marginLeft: 8, fontFamily: 'monospace', fontSize: 12 }}>{settings.GROQ_API_KEY_masked}</span>
              )}
            </div>
            <div style={{ fontSize: 13 }}>
              <StatusDot ok={!!settings.PAGESPEED_API_KEY} />
              <span style={{ color: C.text }}>PageSpeed API</span>
              {settings.PAGESPEED_API_KEY_masked && (
                <span style={{ color: C.muted, marginLeft: 8, fontFamily: 'monospace', fontSize: 12 }}>{settings.PAGESPEED_API_KEY_masked}</span>
              )}
            </div>
          </div>
        </div>
        <Field
          label="Groq API Key (dejar vacío para no cambiar)"
          value={form.GROQ_API_KEY} onChange={set('GROQ_API_KEY')}
          placeholder="gsk_••••••••••••••••"
          mono
          hint="Obtén tu clave en console.groq.com"
        />
        <Field
          label="Google PageSpeed API Key (opcional)"
          value={form.PAGESPEED_API_KEY} onChange={set('PAGESPEED_API_KEY')}
          placeholder="AIza••••••••••••••••"
          mono
          hint="Sin clave usa la API pública con límite de peticiones"
        />
      </Section>

      {/* SMTP */}
      <Section title="📧 Configuración SMTP" desc="Servidor de correo para enviar invitaciones a clientes">
        <div style={{ background: C.surface, borderRadius: 10, padding: '14px 16px', marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>SMTP configurado</div>
          <div style={{ fontSize: 13, color: C.text }}>
            <StatusDot ok={!!settings.SMTP_PASSWORD} />
            {settings.SMTP_USER || 'no-reply@conectaai.cl'} via {settings.SMTP_HOST || 'mail.conectaai.cl'}:{settings.SMTP_PORT || 587}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field label="SMTP Host" value={form.SMTP_HOST} onChange={set('SMTP_HOST')} placeholder="mail.conectaai.cl" mono />
          <Field label="Puerto" value={form.SMTP_PORT} onChange={set('SMTP_PORT')} placeholder="587" />
        </div>
        <Field label="Usuario SMTP" value={form.SMTP_USER} onChange={set('SMTP_USER')} placeholder="no-reply@conectaai.cl" mono />
        <Field label="Contraseña SMTP (dejar vacío para no cambiar)" value={form.SMTP_PASSWORD} onChange={set('SMTP_PASSWORD')} placeholder="••••••••" type="password" />
        <Field label="From (nombre del remitente)" value={form.SMTP_FROM} onChange={set('SMTP_FROM')} placeholder="SEO UltraPRO <no-reply@conectaai.cl>" mono />

        {/* Test email */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, fontWeight: 600 }}>PROBAR CONFIGURACIÓN</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label="" value={testEmail} onChange={setTestEmail} placeholder="tu@email.com para prueba" type="email" />
            </div>
            <Btn onClick={sendTestEmail} loading={testingEmail} disabled={!testEmail.trim()} variant="secondary">
              📧 Enviar test
            </Btn>
          </div>
        </div>
      </Section>

      {/* General */}
      <Section title="⚙️ General" desc="Configuración general de la aplicación">
        <Field label="URL de la aplicación" value={form.APP_URL} onChange={set('APP_URL')} placeholder="https://seo.conectaai.cl" mono hint="Se usa en los emails de invitación" />
      </Section>

      <div style={{ display: 'flex', gap: 10 }}>
        <Btn onClick={save} loading={saving}>💾 Guardar configuración</Btn>
      </div>
    </div>
  )
}
