import { useState, useEffect } from 'react'
import { post, get } from '../api'
import { Card, Btn, Field, ScoreCircle, ErrorBox, Loader, C, Badge } from '../components/UI'

// ── helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function ActionSection({
  title, color, icon, items,
}: { title: string; color: string; icon: string; items: string[] }) {
  if (!items?.length) return null
  return (
    <Card style={{ borderColor: `${color}33` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 12 }}>{icon} {title}</div>
      {items.map((a: string, i: number) => (
        <div key={i} style={{
          display: 'flex', gap: 10, padding: '8px 0',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <span style={{ color, fontWeight: 700, minWidth: 20, flexShrink: 0 }}>{i + 1}.</span>
          <span style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{a}</span>
        </div>
      ))}
    </Card>
  )
}

// ── History tab ───────────────────────────────────────────────────────────────
function HistoryTab({ onLoad }: { onLoad: (result: any) => void }) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get('/api/competitor/history')
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loader />

  if (history.length === 0) return (
    <Card>
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
        <div style={{ color: C.text, fontWeight: 600, marginBottom: 6 }}>Sin historial aún</div>
        <div style={{ color: C.muted, fontSize: 13 }}>
          Cada análisis de competidor se guardará aquí automáticamente.
        </div>
      </div>
    </Card>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {history.map((h: any) => {
        const data = typeof h.output === 'string' ? JSON.parse(h.output) : h.output
        return (
          <button
            key={h.id}
            onClick={() => onLoad({ ...data, url: h.url })}
            style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: '14px 18px', cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 14,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
          >
            {data.score_estimado != null && (
              <ScoreCircle score={data.score_estimado} size={44} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {h.url}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{formatDate(h.created_at)}</div>
            </div>
            <span style={{ color: C.muted, fontSize: 18 }}>›</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CompetitorPage() {
  const [tab, setTab] = useState<'analyze' | 'history'>('analyze')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  async function run() {
    if (!url.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await post('/api/competitor', { url: url.trim() })
      setResult(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[
          { id: 'analyze', label: '🕵️ Analizar', },
          { id: 'history', label: '📋 Historial', },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'rgba(99,102,241,0.2)' : 'transparent',
            color: tab === t.id ? '#818cf8' : C.muted,
            fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'history' && (
        <HistoryTab onLoad={r => { setResult(r); setTab('analyze') }} />
      )}

      {tab === 'analyze' && (
        <>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
              Análisis de Competencia — Estrategia SEO + Web + Ads con IA
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field label="" value={url} onChange={setUrl} placeholder="https://competidor.cl" mono />
              </div>
              <Btn onClick={run} disabled={!url.trim() || loading} loading={loading}>
                🕵️ Analizar competidor
              </Btn>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
              Analiza: Estructura SEO, keywords, estrategia de contenido, debilidades + plan de acción por SEO, Web y Ads
            </div>
          </Card>

          {error && <ErrorBox msg={error} />}
          {loading && <Loader />}

          {result && (
            <>
              {/* Overview */}
              <Card>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
                  {result.score_estimado != null && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <ScoreCircle score={result.score_estimado} size={90} />
                      <div style={{ fontSize: 11, color: C.muted }}>Score estimado</div>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{result.url}</div>
                    {result.title && <div style={{ fontSize: 14, color: '#93c5fd', marginBottom: 4 }}>{result.title}</div>}
                    {result.meta && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{result.meta}</div>}
                  </div>
                </div>
              </Card>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {[
                  { label: 'Palabras', value: result.word_count?.toLocaleString(), icon: '📝' },
                  { label: 'Links totales', value: result.link_count, icon: '🔗' },
                  { label: 'Imágenes', value: result.img_count, icon: '🖼' },
                  { label: 'Schema', value: result.schema_count, icon: '🗂' },
                ].map(s => (
                  <Card key={s.label} style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{s.icon} {s.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{s.value ?? '—'}</div>
                  </Card>
                ))}
              </div>

              {/* AI estrategia */}
              {result.estrategia && (
                <Card style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.3)' }}>
                  <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 600, marginBottom: 8 }}>🧠 Estrategia SEO detectada</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{result.estrategia}</div>
                </Card>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {result.fortalezas?.length > 0 && (
                  <Card>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 12 }}>✓ Fortalezas del competidor</div>
                    {result.fortalezas.map((f: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ color: '#22c55e' }}>●</span>
                        <span style={{ fontSize: 13, color: C.text }}>{f}</span>
                      </div>
                    ))}
                  </Card>
                )}
                {result.debilidades?.length > 0 && (
                  <Card>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 12 }}>✗ Sus debilidades = tus oportunidades</div>
                    {result.debilidades.map((d: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ color: '#ef4444' }}>●</span>
                        <span style={{ fontSize: 13, color: C.text }}>{d}</span>
                      </div>
                    ))}
                  </Card>
                )}
              </div>

              {/* Keywords */}
              {result.keywords_detectadas?.length > 0 && (
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>🎯 Keywords detectadas en su estrategia</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {result.keywords_detectadas.map((kw: string, i: number) => (
                      <Badge key={i} label={kw} color='#6366f1' />
                    ))}
                  </div>
                </Card>
              )}

              {/* ── Plan de acción por área ── */}
              <div style={{
                fontSize: 16, fontWeight: 800, color: '#fff',
                padding: '8px 0 4px', borderBottom: `1px solid ${C.border}`,
              }}>
                🚀 Plan de acción para superarlos
                {result.tiempo_estimado && (
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginLeft: 12 }}>
                    Tiempo estimado: {result.tiempo_estimado}
                  </span>
                )}
              </div>

              {/* SEO Actions */}
              <ActionSection
                title="Acciones SEO"
                color="#818cf8"
                icon="🔍"
                items={result.seo_actions || result.como_superarlos || []}
              />

              {/* Web Actions */}
              <ActionSection
                title="Mejoras en tu Web"
                color="#22d3ee"
                icon="🌐"
                items={result.web_actions || []}
              />

              {/* Ads Actions */}
              <ActionSection
                title="Estrategia de Ads (Google + Meta)"
                color="#f59e0b"
                icon="📢"
                items={result.ads_actions || []}
              />

              {/* Oportunidades */}
              {result.oportunidades?.length > 0 && (
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 12 }}>⚡ Oportunidades rápidas</div>
                  {result.oportunidades.map((o: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ color: '#f59e0b' }}>→</span>
                      <span style={{ fontSize: 13, color: C.text }}>{o}</span>
                    </div>
                  ))}
                </Card>
              )}

              {/* Estructura contenido */}
              {result.h2s?.length > 0 && (
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>📋 Estructura de contenido del competidor</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.h1s?.map((h: string, i: number) => (
                      <div key={`h1-${i}`} style={{ fontSize: 14, color: '#a3e635', fontWeight: 600 }}>H1: {h}</div>
                    ))}
                    {result.h2s.map((h: string, i: number) => (
                      <div key={i} style={{ fontSize: 13, color: C.muted, paddingLeft: 16 }}>H2: {h}</div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
