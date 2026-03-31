import { useState } from 'react'
import { post } from '../api'
import { Card, Btn, Field, ScoreCircle, ErrorBox, Loader, C, Badge } from '../components/UI'

export default function CompetitorPage() {
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
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
          Análisis de Competencia — Descubre sus estrategias SEO con IA
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
          Analiza: Estructura SEO, keywords usadas, estrategia de contenido, debilidades explotables
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
                  <div style={{ fontSize: 11, color: C.muted }}>Score SEO estimado</div>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{result.url}</div>
                {result.title && <div style={{ fontSize: 14, color: '#93c5fd', marginBottom: 4 }}>{result.title}</div>}
                {result.meta && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{result.meta}</div>}
              </div>
            </div>
          </Card>

          {/* Stats grid */}
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

          {/* AI Analysis */}
          {result.estrategia && (
            <Card style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.3)' }}>
              <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 600, marginBottom: 8 }}>🧠 Estrategia SEO detectada</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{result.estrategia}</div>
            </Card>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Fortalezas */}
            {result.fortalezas?.length > 0 && (
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 12 }}>✓ Fortalezas</div>
                {result.fortalezas.map((f: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: '#22c55e', fontSize: 13 }}>●</span>
                    <span style={{ fontSize: 13, color: C.text }}>{f}</span>
                  </div>
                ))}
              </Card>
            )}

            {/* Debilidades */}
            {result.debilidades?.length > 0 && (
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 12 }}>✗ Debilidades (oportunidades tuyas)</div>
                {result.debilidades.map((d: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: '#ef4444', fontSize: 13 }}>●</span>
                    <span style={{ fontSize: 13, color: C.text }}>{d}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>

          {/* Keywords detectadas */}
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

          {/* Cómo superarlos */}
          {result.como_superarlos?.length > 0 && (
            <Card style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 12 }}>
                🚀 Cómo superarlos
                {result.tiempo_estimado && (
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginLeft: 10 }}>
                    Tiempo estimado: {result.tiempo_estimado}
                  </span>
                )}
              </div>
              {result.como_superarlos.map((a: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.green, fontWeight: 700 }}>{i + 1}.</span>
                  <span style={{ fontSize: 13, color: C.text }}>{a}</span>
                </div>
              ))}
            </Card>
          )}

          {/* Oportunidades */}
          {result.oportunidades?.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.orange, marginBottom: 12 }}>⚡ Oportunidades identificadas</div>
              {result.oportunidades.map((o: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.orange }}>→</span>
                  <span style={{ fontSize: 13, color: C.text }}>{o}</span>
                </div>
              ))}
            </Card>
          )}

          {/* H2s encontrados */}
          {result.h2s?.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>📋 Estructura de contenido detectada</div>
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
    </div>
  )
}
