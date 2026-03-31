import { useState } from 'react'
import { post } from '../api'
import { Card, Btn, Field, ScoreCircle, IssueRow, ErrorBox, Loader, C, CopyBtn, Badge } from '../components/UI'

const PRIORITY_COLORS: Record<string, string> = { ALTA: '#ef4444', MEDIA: '#f59e0b', BAJA: '#22c55e' }

function FixPanel({ fix, result }: { fix: any; result: any }) {
  if (!fix) return null
  return (
    <Card style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 20 }}>🔧</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Plan de reparación con IA</div>
          <div style={{ fontSize: 12, color: C.muted }}>{fix.summary}</div>
        </div>
        {fix.score_potencial && (
          <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Score potencial</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{fix.score_potencial}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fix.fixes?.map((f: any, i: number) => (
          <div key={i} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px',
            borderLeft: `3px solid ${PRIORITY_COLORS[f.prioridad] || C.muted}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Badge label={f.prioridad} color={PRIORITY_COLORS[f.prioridad] || C.muted} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{f.titulo}</div>
              <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>⏱ {f.tiempo}</span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{f.problema}</div>
            <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 600, marginBottom: 6 }}>✓ Solución: <span style={{ color: C.text, fontWeight: 400 }}>{f.solucion}</span></div>
            {f.pasos?.length > 0 && (
              <div style={{ background: C.surface, borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                {f.pasos.map((p: string, pi: number) => (
                  <div key={pi} style={{ fontSize: 12, color: C.text, padding: '3px 0', display: 'flex', gap: 8 }}>
                    <span style={{ color: C.green, fontWeight: 700, flexShrink: 0 }}>{pi + 1}.</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11, color: C.green }}>📈 Impacto: {f.impacto}</div>
          </div>
        ))}
      </div>

      {fix.herramientas?.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.muted }}>🛠 Herramientas:</span>
          {fix.herramientas.map((h: string, i: number) => (
            <span key={i} style={{ padding: '3px 10px', borderRadius: 20, background: '#6366f118', color: '#818cf8', fontSize: 11 }}>{h}</span>
          ))}
        </div>
      )}
      {fix.consejo_final && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(99,102,241,0.08)', borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: '#818cf8' }}>💡 {fix.consejo_final}</span>
        </div>
      )}
    </Card>
  )
}

export default function AuditPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [fixLoading, setFixLoading] = useState(false)
  const [fixResult, setFixResult] = useState<any>(null)

  async function runFix() {
    if (!result) return
    setFixLoading(true); setFixResult(null)
    try {
      const r = await post('/api/audit/fix', { url: result.url, score: result.score, issues: result.issues })
      setFixResult(r)
    } catch (e: any) { setError(e.message) }
    finally { setFixLoading(false) }
  }

  async function run() {
    if (!url.trim()) return
    setLoading(true); setError(''); setResult(null); setFixResult(null)
    try {
      const r = await post('/api/audit', { url: url.trim() })
      setResult(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const stats = result ? [
    { label: 'Palabras', value: result.word_count?.toLocaleString(), icon: '📝' },
    { label: 'H2 headings', value: result.h2_count, icon: '📋' },
    { label: 'Imágenes', value: result.img_count, icon: '🖼' },
    { label: 'Links internos', value: result.int_links, icon: '🔗' },
    { label: 'Links externos', value: result.ext_links, icon: '↗' },
    { label: 'HTTP status', value: result.status, icon: '🌐' },
  ] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Input */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
          Auditoría SEO On-Page — analiza cualquier URL en segundos
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Field label="" value={url} onChange={setUrl} placeholder="https://terrablinds.cl" mono />
          </div>
          <Btn onClick={run} disabled={!url.trim() || loading} loading={loading}>
            🔍 Analizar
          </Btn>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
          Analiza: Title, Meta, H1-H6, Imágenes, Schema.org, OG Tags, HTTPS, Canonical, Contenido, Estructura
        </div>
      </Card>

      {error && <ErrorBox msg={error} />}
      {loading && <Loader />}

      {result && (
        <>
          {/* Score + summary */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <ScoreCircle score={result.score} size={100} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                  {result.url}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: '#22c55e' }}>✓ {result.passed} correctos</span>
                  <span style={{ fontSize: 13, color: '#f59e0b' }}>⚠ {result.warnings} advertencias</span>
                  <span style={{ fontSize: 13, color: '#ef4444' }}>✗ {result.errors} errores</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'HTTPS', ok: result.is_https },
                    { label: 'Schema', ok: result.has_schema },
                    { label: 'Canonical', ok: result.has_canonical },
                    { label: 'Open Graph', ok: result.has_og },
                  ].map(({ label, ok }) => (
                    <span key={label} style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: (ok ? '#22c55e' : '#ef4444') + '18',
                      color: ok ? '#22c55e' : '#ef4444',
                    }}>{ok ? '✓' : '✗'} {label}</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {stats.map(s => (
              <Card key={s.label} style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{s.icon} {s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{s.value}</div>
              </Card>
            ))}
          </div>

          {/* Page data */}
          {(result.title || result.meta_desc || result.h1) && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Datos de la página</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {result.title && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      Título ({result.title.length} chars)
                    </div>
                    <div style={{ fontSize: 13, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {result.title}
                      <CopyBtn text={result.title} small />
                    </div>
                  </div>
                )}
                {result.meta_desc && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      Meta descripción ({result.meta_desc.length} chars)
                    </div>
                    <div style={{ fontSize: 13, color: C.text, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ flex: 1 }}>{result.meta_desc}</span>
                      <CopyBtn text={result.meta_desc} small />
                    </div>
                  </div>
                )}
                {result.h1 && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>H1</div>
                    <div style={{ fontSize: 13, color: '#a3e635' }}>{result.h1}</div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Google Preview */}
          {result.title && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
                Vista previa en Google
              </div>
              <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', maxWidth: 600 }}>
                <div style={{ fontSize: 12, color: '#202124', marginBottom: 4 }}>{result.url}</div>
                <div style={{ fontSize: 18, color: '#1a0dab', fontWeight: 400, marginBottom: 4, lineHeight: 1.3 }}>
                  {result.title}
                </div>
                <div style={{ fontSize: 13, color: '#4d5156', lineHeight: 1.58 }}>
                  {result.meta_desc || 'Sin meta descripción — Google generará un snippet automático.'}
                </div>
              </div>
            </Card>
          )}

          {/* Issues */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                Revisión completa ({result.issues.length} puntos)
              </div>
              {(result.errors > 0 || result.warnings > 0) && (
                <Btn onClick={runFix} loading={fixLoading} variant="secondary" small>
                  🔧 ¿Cómo lo soluciono? — Plan con IA
                </Btn>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.issues
                .sort((a: any, b: any) => {
                  const order = { error: 0, warning: 1, ok: 2 }
                  return (order[a.type as keyof typeof order] || 0) - (order[b.type as keyof typeof order] || 0)
                })
                .map((issue: any, i: number) => <IssueRow key={i} issue={issue} />)}
            </div>
          </Card>

          {fixLoading && <Loader />}
          <FixPanel fix={fixResult} result={result} />
        </>
      )}
    </div>
  )
}
