import { useState, useEffect } from 'react'
import { get, put, post, del as apiDel } from '../api'
import { Card, Btn, Field, ErrorBox, C } from '../components/UI'

interface Schedule {
  id: string
  site_url: string
  report_email: string
  is_active: boolean
  last_sent: string | null
  created_at: string | null
}

interface SendResult {
  sent: boolean
  to: string
  score: number
  grade: string
  errors: number
  warnings: number
  passed: number
}

export default function AutoReportsPage() {
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)

  const [siteUrl, setSiteUrl] = useState('')
  const [email, setEmail] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const d = await get('/api/reports/schedule')
      if (d) {
        setSchedule(d)
        setSiteUrl(d.site_url)
        setEmail(d.report_email)
        setIsActive(d.is_active)
      }
    } catch (e: any) {
      if (!e.message?.includes('404')) setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!siteUrl.trim()) return setError('Ingresa una URL')
    if (!email.trim()) return setError('Ingresa un email')
    setSaving(true); setError(''); setSaved(false)
    try {
      const d = await put('/api/reports/schedule', { site_url: siteUrl.trim(), report_email: email.trim(), is_active: isActive })
      setSchedule(d)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleSendNow() {
    if (!schedule) return setError('Guarda la configuración primero')
    setSending(true); setError(''); setSendResult(null)
    try {
      const r = await post('/api/reports/send-now', {})
      setSendResult(r)
      await load()
    } catch (e: any) { setError(e.message) }
    finally { setSending(false) }
  }

  async function handleDelete() {
    if (!schedule) return
    if (!confirm('¿Eliminar programación de informes?')) return
    setDeleting(true); setError('')
    try {
      await apiDel('/api/reports/schedule')
      setSchedule(null); setSiteUrl(''); setEmail(''); setIsActive(true); setSendResult(null)
    } catch (e: any) { setError(e.message) }
    finally { setDeleting(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: C.muted, fontSize: 14 }}>
      Cargando...
    </div>
  )

  const scoreColor = sendResult ? (sendResult.score >= 75 ? C.green : sendResult.score >= 50 ? C.orange : C.red) : C.muted

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680 }}>

      {/* Header */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>Informes SEO automáticos</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
              Recibe un informe mensual por email con el score SEO, errores y recomendaciones de tu sitio.
              Úsalo para mantener a tus clientes informados del estado de su posicionamiento.
            </p>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setIsActive(v => !v)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: isActive ? C.green : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'background 0.2s', padding: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: isActive ? 22 : 3,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }} />
            </button>
            <span style={{ fontSize: 10, color: isActive ? C.green : C.muted, fontWeight: 600 }}>
              {isActive ? 'Activo' : 'Pausado'}
            </span>
          </div>
        </div>
        {schedule && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 9,
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>📅</span>
            <span style={{ fontSize: 12, color: '#818cf8', fontWeight: 500 }}>
              Programado — se enviará mensualmente
              {schedule.last_sent ? ` · Último envío: ${schedule.last_sent}` : ''}
            </span>
          </div>
        )}
      </Card>

      {/* Config */}
      <Card>
        <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, color: '#fff' }}>Configuración</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field
            label="URL del sitio"
            value={siteUrl}
            onChange={setSiteUrl}
            placeholder="https://misitioweb.com"
            hint="Se auditará esta URL y los resultados se incluirán en el informe"
            mono
          />
          <Field
            label="Email de destino"
            value={email}
            onChange={setEmail}
            placeholder="cliente@empresa.com"
            type="email"
            hint="El informe HTML se enviará a esta dirección cada mes"
          />
        </div>

        {error && <div style={{ marginTop: 14 }}><ErrorBox msg={error} /></div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <Btn onClick={handleSave} loading={saving} disabled={saving}>
            {saved ? '✓ Guardado' : 'Guardar programación'}
          </Btn>
          {schedule && (
            <Btn onClick={handleSendNow} loading={sending} disabled={sending} variant="secondary">
              {sending ? 'Enviando...' : '📧 Enviar informe ahora'}
            </Btn>
          )}
          {schedule && (
            <Btn onClick={handleDelete} loading={deleting} variant="danger" small>
              Eliminar
            </Btn>
          )}
        </div>
      </Card>

      {/* Send result */}
      {sendResult && (
        <Card style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', border: `3px solid ${scoreColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, color: scoreColor, flexShrink: 0,
            }}>{sendResult.score}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                Informe enviado correctamente
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>Enviado a <strong style={{ color: C.text }}>{sendResult.to}</strong></div>
            </div>
            <span style={{
              marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: C.green,
              background: 'rgba(16,185,129,0.1)', padding: '4px 12px', borderRadius: 20,
              border: '1px solid rgba(16,185,129,0.25)',
            }}>✓ Email enviado</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Score', value: `${sendResult.score}/100`, color: scoreColor },
              { label: 'Grado', value: sendResult.grade, color: C.accent },
              { label: 'Errores', value: sendResult.errors, color: C.red },
              { label: 'Avisos', value: sendResult.warnings, color: C.orange },
              { label: 'OK', value: sendResult.passed, color: C.green },
            ].map(m => (
              <div key={m.label} style={{
                flex: '1 0 70px', background: '#0d1117', borderRadius: 10, padding: '10px 14px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: m.color as string }}>{m.value}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Status if config exists */}
      {schedule && !sendResult && (
        <Card style={{ borderColor: 'rgba(99,102,241,0.15)' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontWeight: 600 }}>Sitio</div>
              <div style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>{schedule.site_url}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontWeight: 600 }}>Email destino</div>
              <div style={{ fontSize: 13, color: C.text }}>{schedule.report_email}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontWeight: 600 }}>Último envío</div>
              <div style={{ fontSize: 13, color: C.text }}>{schedule.last_sent || 'Nunca'}</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Btn onClick={handleSendNow} loading={sending} disabled={sending} variant="primary">
              {sending ? 'Enviando...' : '📧 Enviar informe ahora'}
            </Btn>
          </div>
        </Card>
      )}

      {/* Info */}
      <Card style={{ background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.15)' }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: C.accent }}>¿Qué incluye el informe?</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            '📊 Score SEO global (0–100) con grado de calidad',
            '✗ Lista de errores críticos a corregir',
            '⚠ Avisos y recomendaciones de mejora',
            '✓ Puntos SEO que ya están bien configurados',
            '📅 Fecha y hora del análisis automático',
          ].map((t, i) => (
            <div key={i} style={{ fontSize: 13, color: C.text }}>{t}</div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#ffffff06', borderRadius: 9, fontSize: 12, color: C.muted }}>
          💡 Usa <strong style={{ color: C.text }}>Enviar informe ahora</strong> para probar el formato antes de programarlo mensualmente.
        </div>
      </Card>
    </div>
  )
}
