import { useState } from 'react'
import { post } from '../api'
import { Card, Btn, Field, ScoreCircle, IssueRow, ErrorBox, Loader, C, CopyBtn, Badge } from '../components/UI'

const priorityColors: Record<string, string> = {
  'ALTA': '#ef4444', 'MEDIA': '#f59e0b', 'BAJA': '#22c55e',
}

export default function ReportPage() {
  const [form, setForm] = useState({ audit_url: '', business: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  async function run() {
    if (!form.audit_url.trim() || !form.business.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await post('/api/report', form)
      setResult(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  function printReport() {
    window.print()
  }

  const rec = result?.recommendations
  const audit = result?.audit

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
          Informe SEO Profesional — Genera reportes para entregar a clientes
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
          <Field label="URL del sitio *" value={form.audit_url} onChange={set('audit_url')} placeholder="https://terrablinds.cl" mono />
          <Field label="Nombre del cliente *" value={form.business} onChange={set('business')} placeholder="TerraBlinds SpA" />
        </div>
        <Btn onClick={run} disabled={!form.audit_url.trim() || !form.business.trim() || loading} loading={loading}>
          📊 Generar informe completo
        </Btn>
      </Card>

      {error && <ErrorBox msg={error} />}
      {loading && <Loader />}

      {result && (
        <>
          {/* Report header */}
          <Card style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))', borderColor: 'rgba(99,102,241,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: '#818cf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Informe SEO Profesional
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{result.business}</div>
                <div style={{ fontSize: 13, color: C.muted }}>{audit?.url}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Generado: {result.generated_at}</div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <ScoreCircle score={audit?.score ?? 0} size={90} />
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Score SEO</div>
                </div>
                <Btn onClick={printReport} variant="secondary">🖨 Imprimir / PDF</Btn>
              </div>
            </div>
          </Card>

          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { label: 'Puntuación', value: `${audit?.score}/100`, color: audit?.score >= 75 ? '#22c55e' : audit?.score >= 50 ? '#f59e0b' : '#ef4444' },
              { label: 'Errores críticos', value: audit?.errors, color: '#ef4444' },
              { label: 'Advertencias', value: audit?.warnings, color: '#f59e0b' },
              { label: 'Puntos OK', value: audit?.passed, color: '#22c55e' },
            ].map(s => (
              <Card key={s.label} style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              </Card>
            ))}
          </div>

          {/* Executive Summary */}
          {rec?.executive_summary && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>📋 Resumen Ejecutivo</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8, whiteSpace: 'pre-line' }}>{rec.executive_summary}</div>
            </Card>
          )}

          {/* Priority Actions */}
          {rec?.priority_actions?.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>⚡ Acciones prioritarias</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rec.priority_actions.map((a: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 10,
                    background: (priorityColors[a.priority] || C.muted) + '0a',
                    border: `1px solid ${(priorityColors[a.priority] || C.muted)}22`,
                  }}>
                    <div style={{ flexShrink: 0 }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: (priorityColors[a.priority] || C.muted) + '22',
                        color: priorityColors[a.priority] || C.muted,
                      }}>{a.priority}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{a.action}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{a.impact}</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, flexShrink: 0, alignSelf: 'flex-start', marginTop: 4 }}>
                      {a.timeframe}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Quick wins */}
          {rec?.quick_wins?.length > 0 && (
            <Card style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 12 }}>🏃 Quick Wins — Resultados en días</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rec.quick_wins.map((qw: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: C.text, padding: '5px 0' }}>
                    <span style={{ color: C.green, fontWeight: 700 }}>✓</span> {qw}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Roadmap */}
          {rec?.monthly_roadmap?.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>🗺 Roadmap — Plan de acción 90 días</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {rec.monthly_roadmap.map((m: any, i: number) => (
                  <div key={i} style={{ background: C.surface, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', marginBottom: 6 }}>{m.month}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 10 }}>{m.focus}</div>
                    {m.tasks?.map((t: string, ti: number) => (
                      <div key={ti} style={{ fontSize: 12, color: C.muted, padding: '4px 0', display: 'flex', gap: 6 }}>
                        <span>•</span><span>{t}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Expected results */}
          {rec?.expected_results && (
            <Card style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.3)' }}>
              <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 600, marginBottom: 8 }}>📈 Resultados esperados en 90 días</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{rec.expected_results}</div>
            </Card>
          )}

          {/* Technical audit detail */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
              🔍 Auditoría técnica completa ({audit?.issues?.length} puntos)
            </div>

            {/* Page data */}
            {(audit?.title || audit?.meta_desc) && (
              <div style={{ marginBottom: 16, padding: '12px 14px', background: C.surface, borderRadius: 8 }}>
                {audit.title && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase' }}>Título ({audit.title.length} chars): </span>
                    <span style={{ fontSize: 13, color: '#93c5fd' }}>{audit.title}</span>
                    <CopyBtn text={audit.title} small />
                  </div>
                )}
                {audit.meta_desc && (
                  <div>
                    <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase' }}>Meta ({audit.meta_desc.length} chars): </span>
                    <span style={{ fontSize: 13, color: C.text }}>{audit.meta_desc}</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {audit?.issues
                ?.sort((a: any, b: any) => {
                  const order = { error: 0, warning: 1, ok: 2 }
                  return (order[a.type as keyof typeof order] || 0) - (order[b.type as keyof typeof order] || 0)
                })
                .map((issue: any, i: number) => <IssueRow key={i} issue={issue} />)}
            </div>
          </Card>

          {/* Footer */}
          <Card style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: 12, color: C.muted }}>
              Informe generado por <span style={{ color: '#818cf8', fontWeight: 600 }}>SEO UltraPRO</span> — ConectaAI © 2026
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
