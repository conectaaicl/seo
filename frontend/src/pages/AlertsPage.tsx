import { useState, useEffect } from 'react'
import { get, put, post, del as apiDel } from '../api'
import { Card, Btn, Field, ErrorBox, C } from '../components/UI'

interface AlertConfig {
  id: string
  user_id: string
  site_url: string
  alert_email: string
  seo_score_threshold: string
  pagespeed_threshold: string
  is_active: boolean
  last_checked: string | null
  last_seo_score: string
  last_pagespeed_score: string
  created_at: string | null
}

interface CheckResult {
  score: number
  threshold: number
  alert_sent: boolean
  site_url: string
  grade: string
  errors: number
  warnings: number
  passed: number
  issues: Array<{ type: string; field: string; msg: string }>
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? C.green : score >= 50 ? C.orange : C.red
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 52, height: 52, borderRadius: '50%',
      border: `3px solid ${color}`,
      fontSize: 17, fontWeight: 800, color,
      flexShrink: 0,
    }}>{score}</span>
  )
}

function Toggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!active)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: active ? C.green : 'rgba(255,255,255,0.1)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        padding: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: active ? 22 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }} />
    </button>
  )
}

export default function AlertsPage() {
  const [config, setConfig] = useState<AlertConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
  const [saved, setSaved] = useState(false)

  // Form state
  const [siteUrl, setSiteUrl] = useState('')
  const [alertEmail, setAlertEmail] = useState('')
  const [seoThreshold, setSeoThreshold] = useState('70')
  const [psThreshold, setPsThreshold] = useState('50')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    setLoading(true)
    setError('')
    try {
      const data = await get('/api/alerts/config')
      if (data) {
        setConfig(data)
        setSiteUrl(data.site_url)
        setAlertEmail(data.alert_email)
        setSeoThreshold(data.seo_score_threshold)
        setPsThreshold(data.pagespeed_threshold)
        setIsActive(data.is_active)
      }
    } catch (e: any) {
      // 404 = no config yet, that's fine
      if (!e.message?.includes('404')) setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!siteUrl.trim()) return setError('Ingresa una URL de sitio')
    if (!alertEmail.trim()) return setError('Ingresa un email de alerta')
    const seoN = parseInt(seoThreshold)
    const psN = parseInt(psThreshold)
    if (isNaN(seoN) || seoN < 0 || seoN > 100) return setError('El umbral SEO debe estar entre 0 y 100')
    if (isNaN(psN) || psN < 0 || psN > 100) return setError('El umbral PageSpeed debe estar entre 0 y 100')

    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const data = await put('/api/alerts/config', {
        site_url: siteUrl.trim(),
        alert_email: alertEmail.trim(),
        seo_score_threshold: seoThreshold,
        pagespeed_threshold: psThreshold,
        is_active: isActive,
      })
      setConfig(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!config) return
    if (!confirm('¿Eliminar configuración de alertas?')) return
    setDeleting(true)
    setError('')
    try {
      await apiDel('/api/alerts/config')
      setConfig(null)
      setSiteUrl('')
      setAlertEmail('')
      setSeoThreshold('70')
      setPsThreshold('50')
      setIsActive(true)
      setCheckResult(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleCheckNow() {
    if (!config) return setError('Guarda la configuración primero')
    setChecking(true)
    setError('')
    setCheckResult(null)
    try {
      const result = await post('/api/alerts/check-now', {})
      setCheckResult(result)
      // Refresh config to get updated last_checked / last_seo_score
      await loadConfig()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setChecking(false)
    }
  }

  const seoN = parseInt(seoThreshold) || 70
  const sliderColor = seoN >= 75 ? C.green : seoN >= 50 ? C.orange : C.red

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: C.muted, fontSize: 14 }}>
        Cargando configuración...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680 }}>

      {/* Header Card */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>
              Alertas SEO automáticas
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
              Recibe un email cuando el score SEO de tu sitio caiga por debajo del umbral configurado.
              Útil para detectar caídas inesperadas antes de que afecten tu posicionamiento.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: isActive ? C.green : C.muted, fontWeight: 600 }}>
              {isActive ? 'Activo' : 'Pausado'}
            </span>
            <Toggle active={isActive} onChange={setIsActive} />
          </div>
        </div>

        {config && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 9,
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <span style={{ fontSize: 12, color: C.green, fontWeight: 500 }}>
              Configuración guardada
              {config.last_checked ? ` · Último check: ${config.last_checked}` : ''}
            </span>
          </div>
        )}
      </Card>

      {/* Config Card */}
      <Card>
        <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, color: '#fff' }}>
          Configuración de alertas
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field
            label="URL del sitio a monitorear"
            value={siteUrl}
            onChange={setSiteUrl}
            placeholder="https://misitioweb.com"
            hint="Se auditará esta URL cada vez que se ejecute la verificación"
          />

          <Field
            label="Email de notificación"
            value={alertEmail}
            onChange={setAlertEmail}
            placeholder="tu@email.com"
            type="email"
            hint="Recibirás las alertas en esta dirección cuando el score caiga"
          />

          {/* SEO Score Threshold */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Umbral score SEO
              </label>
              <span style={{
                fontSize: 15, fontWeight: 800, color: sliderColor,
                background: sliderColor + '18', padding: '2px 10px', borderRadius: 20,
              }}>
                {seoThreshold}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={seoN}
              onChange={e => setSeoThreshold(e.target.value)}
              style={{
                width: '100%', accentColor: sliderColor, cursor: 'pointer',
                height: 6, borderRadius: 4,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted }}>
              <span>0 — critico</span>
              <span style={{ color: C.orange }}>50 — regular</span>
              <span style={{ color: C.green }}>100 — optimo</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              Se enviará una alerta si el score SEO cae por debajo de{' '}
              <strong style={{ color: sliderColor }}>{seoThreshold}</strong>.
              Recomendamos un umbral de <strong style={{ color: C.text }}>70</strong> o superior.
            </div>
          </div>

          {/* PageSpeed Threshold */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Field
              label="Umbral PageSpeed / Performance (0–100)"
              value={psThreshold}
              onChange={setPsThreshold}
              placeholder="50"
              type="number"
              hint="Reservado para alertas de rendimiento. Valor de referencia: 50. (Funcionalidad de verificación activa en score SEO)"
            />
          </div>
        </div>

        {error && <div style={{ marginTop: 16 }}><ErrorBox msg={error} /></div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <Btn onClick={handleSave} loading={saving} disabled={saving}>
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar configuración'}
          </Btn>
          {config && (
            <Btn
              onClick={handleCheckNow}
              loading={checking}
              disabled={checking}
              variant="secondary"
            >
              {checking ? 'Verificando...' : '🔔 Verificar ahora'}
            </Btn>
          )}
          {config && (
            <Btn onClick={handleDelete} loading={deleting} variant="danger" small>
              Eliminar
            </Btn>
          )}
        </div>
      </Card>

      {/* Check result */}
      {checkResult && (
        <Card style={{ borderColor: checkResult.alert_sent ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <ScoreBadge score={checkResult.score} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                Resultado de la verificación
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {checkResult.site_url}
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              {checkResult.alert_sent ? (
                <span style={{
                  fontSize: 12, fontWeight: 700, color: C.red,
                  background: 'rgba(239,68,68,0.12)', padding: '4px 12px', borderRadius: 20,
                  border: '1px solid rgba(239,68,68,0.3)',
                }}>
                  ⚠ Alerta enviada
                </span>
              ) : (
                <span style={{
                  fontSize: 12, fontWeight: 700, color: C.green,
                  background: 'rgba(16,185,129,0.1)', padding: '4px 12px', borderRadius: 20,
                  border: '1px solid rgba(16,185,129,0.25)',
                }}>
                  ✓ Sin alerta
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Score', value: `${checkResult.score}/100`, color: checkResult.score >= 75 ? C.green : checkResult.score >= 50 ? C.orange : C.red },
              { label: 'Umbral', value: checkResult.threshold, color: C.muted },
              { label: 'Grado', value: checkResult.grade, color: C.accent },
              { label: 'Errores', value: checkResult.errors, color: C.red },
              { label: 'Avisos', value: checkResult.warnings, color: C.orange },
              { label: 'OK', value: checkResult.passed, color: C.green },
            ].map(m => (
              <div key={m.label} style={{
                flex: '1 0 80px', background: '#0d1117', borderRadius: 10, padding: '10px 14px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: m.color as string }}>{m.value}</div>
              </div>
            ))}
          </div>

          {checkResult.alert_sent && (
            <div style={{
              padding: '10px 14px', borderRadius: 9, marginBottom: 14,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 13, color: '#fca5a5',
            }}>
              Se envió una alerta a <strong>{config?.alert_email}</strong> porque el score ({checkResult.score}) cayó por debajo del umbral ({checkResult.threshold}).
            </div>
          )}

          {!checkResult.alert_sent && (
            <div style={{
              padding: '10px 14px', borderRadius: 9, marginBottom: 14,
              background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
              fontSize: 13, color: '#6ee7b7',
            }}>
              El score ({checkResult.score}) está por encima del umbral ({checkResult.threshold}). No se envió alerta.
            </div>
          )}

          {checkResult.issues.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontWeight: 600 }}>
                Problemas detectados
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {checkResult.issues.filter(i => i.type !== 'ok').slice(0, 8).map((issue, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px',
                    background: '#0d1117', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <span style={{
                      fontSize: 13, flexShrink: 0,
                      color: issue.type === 'error' ? C.red : C.orange,
                    }}>
                      {issue.type === 'error' ? '✗' : '⚠'}
                    </span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 2 }}>{issue.field}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{issue.msg}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Status summary if config exists but no check yet */}
      {config && !checkResult && (
        <Card style={{ borderColor: 'rgba(99,102,241,0.2)' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontWeight: 600 }}>
                Sitio monitoreado
              </div>
              <div style={{ fontSize: 14, color: C.accent, fontWeight: 600 }}>{config.site_url}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontWeight: 600 }}>
                Último score
              </div>
              <div style={{ fontSize: 14, color: config.last_seo_score ? (parseInt(config.last_seo_score) >= parseInt(config.seo_score_threshold) ? C.green : C.red) : C.muted, fontWeight: 600 }}>
                {config.last_seo_score ? `${config.last_seo_score}/100` : 'Sin datos — haz clic en Verificar ahora'}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontWeight: 600 }}>
                Último check
              </div>
              <div style={{ fontSize: 13, color: C.text }}>
                {config.last_checked || 'Nunca verificado'}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontWeight: 600 }}>
                Umbral SEO
              </div>
              <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{config.seo_score_threshold}/100</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Btn onClick={handleCheckNow} loading={checking} disabled={checking} variant="primary">
              {checking ? 'Verificando...' : '🔔 Verificar ahora'}
            </Btn>
          </div>
        </Card>
      )}

      {/* Help */}
      <Card style={{ background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.15)' }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: C.accent }}>
          ¿Cómo funcionan las alertas?
        </h4>
        <ol style={{ margin: 0, paddingLeft: 20, color: C.muted, fontSize: 13, lineHeight: 1.8 }}>
          <li>Configura la URL de tu sitio y el email donde recibirás las notificaciones.</li>
          <li>Establece el umbral mínimo de score SEO (recomendamos 70+).</li>
          <li>Usa <strong style={{ color: C.text }}>Verificar ahora</strong> para ejecutar una auditoría inmediata.</li>
          <li>Si el score está por debajo del umbral, recibirás un email con los problemas detectados.</li>
          <li>Las alertas solo se envían cuando el score <strong style={{ color: C.text }}>cambia</strong> y está bajo el umbral.</li>
        </ol>
      </Card>
    </div>
  )
}
