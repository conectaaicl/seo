import { useState, useEffect } from 'react'
import { get, put } from '../api'
import { Card, Btn, Field, ErrorBox, C } from '../components/UI'

function StatusDot({ ok }: { ok: boolean }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ok ? '#10b981' : C.muted, marginRight: 6 }} />
}

export default function MySettingsPage() {
  const [data, setData] = useState<any>(null)
  const [form, setForm] = useState({ groq_api_key: '', pagespeed_api_key: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    get('/api/my-keys').then(d => { setData(d) }).finally(() => setLoading(false))
  }, [])

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true); setError(''); setSuccess('')
    try {
      const body: any = {}
      if (form.groq_api_key) body.groq_api_key = form.groq_api_key
      if (form.pagespeed_api_key) body.pagespeed_api_key = form.pagespeed_api_key
      await put('/api/my-keys', body)
      setSuccess('✓ Claves guardadas correctamente')
      const d = await get('/api/my-keys')
      setData(d)
      setForm({ groq_api_key: '', pagespeed_api_key: '' })
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>Cargando...</div>

  if (!data?.has_tenant) return (
    <Card style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}>
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Cuenta de Administrador</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
          Las API Keys globales del sistema se configuran en<br />
          <strong style={{ color: '#818cf8' }}>Panel Admin → ⚙️ Configuración</strong>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320, margin: '0 auto', textAlign: 'left' }}>
          {[
            '🤖 Groq API Key — motor de IA para generación de contenido',
            '⚡ PageSpeed API Key — velocidad y Core Web Vitals',
            '📧 SMTP — configuración de email para invitaciones',
          ].map((t, i) => (
            <div key={i} style={{ fontSize: 13, color: C.text, padding: '8px 12px', background: '#ffffff06', borderRadius: 8 }}>{t}</div>
          ))}
        </div>
      </div>
    </Card>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Mis API Keys</div>
        <div style={{ fontSize: 13, color: C.muted }}>Configura tus propias claves para no depender del límite global</div>
      </div>

      {error && <ErrorBox msg={error} />}
      {success && (
        <div style={{ background: '#10b98118', border: '1px solid #10b98140', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#10b981' }}>
          {success}
        </div>
      )}

      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Estado actual</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: C.surface, borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                <StatusDot ok={data.groq_api_key_set} />
                Groq API Key (IA)
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {data.groq_api_key_set
                  ? `Usando tu clave: ${data.groq_api_key_masked}`
                  : 'Usando la clave global del sistema'}
              </div>
            </div>
            {data.groq_api_key_set && (
              <span style={{ padding: '3px 10px', borderRadius: 20, background: '#10b98118', color: '#10b981', fontSize: 11, fontWeight: 700 }}>
                API PROPIA
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: C.surface, borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                <StatusDot ok={data.pagespeed_api_key_set} />
                Google PageSpeed API Key
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {data.pagespeed_api_key_set
                  ? `Usando tu clave: ${data.pagespeed_api_key_masked}`
                  : 'Usando la API pública (con límite de cuota compartida)'}
              </div>
            </div>
            {data.pagespeed_api_key_set && (
              <span style={{ padding: '3px 10px', borderRadius: 20, background: '#10b98118', color: '#10b981', fontSize: 11, fontWeight: 700 }}>
                API PROPIA
              </span>
            )}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Actualizar claves</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field
              label="Groq API Key (dejar vacío para no cambiar)"
              value={form.groq_api_key} onChange={set('groq_api_key')}
              placeholder="gsk_••••••••••••••••" mono
              hint="Obtén tu clave gratuita en console.groq.com"
            />
            <Field
              label="Google PageSpeed API Key (dejar vacío para no cambiar)"
              value={form.pagespeed_api_key} onChange={set('pagespeed_api_key')}
              placeholder="AIza••••••••••••••••" mono
              hint="25.000 consultas/día gratis — console.cloud.google.com"
            />
            <Btn
              onClick={save} loading={saving}
              disabled={!form.groq_api_key.trim() && !form.pagespeed_api_key.trim()}
            >
              💾 Guardar mis claves
            </Btn>
          </div>
        </div>
      </Card>

      <Card style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', marginBottom: 10 }}>¿Por qué usar tu propia API Key?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            '✓ Cuota independiente — no compartes límites con otros usuarios',
            '✓ Mayor velocidad — sin colas de peticiones compartidas',
            '✓ Control total — puedes monitorear tu propio consumo',
            '✓ Groq es gratuito hasta cierto límite diario',
          ].map((t, i) => (
            <div key={i} style={{ fontSize: 13, color: C.text }}>{t}</div>
          ))}
        </div>
      </Card>
    </div>
  )
}
