import { useState } from 'react'
import { post } from '../api'
import { Card, Btn, Field, ScoreCircle, ErrorBox, Loader, C } from '../components/UI'

function MetricCard({ label, value, score }: { label: string; value: string; score: number | null }) {
  const color = score === null ? C.muted : score >= 90 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <Card style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value || '—'}</div>
    </Card>
  )
}

export default function PageSpeedPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  async function run() {
    if (!url.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await post('/api/pagespeed', { url: url.trim() })
      setResult(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const scoreColor = (s: number | null) =>
    s === null ? C.muted : s >= 90 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
          Core Web Vitals — Velocidad y Rendimiento (Google PageSpeed)
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Field label="" value={url} onChange={setUrl} placeholder="https://terrablinds.cl" mono />
          </div>
          <Btn onClick={run} disabled={!url.trim() || loading} loading={loading}>
            ⚡ Analizar velocidad
          </Btn>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
          Analiza: FCP, LCP, TBT, CLS, Speed Index — datos reales de Google PageSpeed API
        </div>
      </Card>

      {error && <ErrorBox msg={error} />}
      {loading && <Loader />}

      {result && (
        <>
          {/* Score cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { label: 'Performance', key: 'performance' },
              { label: 'SEO', key: 'seo' },
              { label: 'Accesibilidad', key: 'accessibility' },
              { label: 'Best Practices', key: 'best_practices' },
            ].map(({ label, key }) => {
              const s = result.scores?.[key]
              return (
                <Card key={key} style={{ padding: '20px', textAlign: 'center' }}>
                  <ScoreCircle score={s ?? 0} size={80} />
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 10, fontWeight: 600 }}>{label}</div>
                </Card>
              )
            })}
          </div>

          {/* Core Web Vitals */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
              Core Web Vitals
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                { label: 'FCP — First Contentful Paint', key: 'fcp' },
                { label: 'LCP — Largest Contentful Paint', key: 'lcp' },
                { label: 'TBT — Total Blocking Time', key: 'tbt' },
                { label: 'CLS — Cumulative Layout Shift', key: 'cls' },
                { label: 'Speed Index', key: 'si' },
                { label: 'TTI — Time to Interactive', key: 'tti' },
              ].map(({ label, key }) => {
                const m = result.metrics?.[key]
                return (
                  <MetricCard
                    key={key}
                    label={label}
                    value={m?.displayValue || '—'}
                    score={m?.score ?? null}
                  />
                )
              })}
            </div>
          </Card>

          {/* Score bars */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
              Puntuaciones de categoría
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Performance', key: 'performance' },
                { label: 'SEO', key: 'seo' },
                { label: 'Accesibilidad', key: 'accessibility' },
                { label: 'Best Practices', key: 'best_practices' },
              ].map(({ label, key }) => {
                const s = result.scores?.[key] ?? 0
                const color = scoreColor(s)
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 140, fontSize: 13, color: C.text }}>{label}</div>
                    <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${s}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ width: 36, fontSize: 13, fontWeight: 700, color, textAlign: 'right' }}>{s}</div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Opportunities */}
          {result.opportunities?.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
                🚀 Oportunidades de mejora
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.opportunities.map((o: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', background: '#f59e0b0a', border: '1px solid #f59e0b20', borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 13, color: C.text }}>{o.title}</span>
                    {o.savings && (
                      <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>
                        {o.savings}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
