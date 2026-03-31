import { useState } from 'react'
import { post } from '../api'
import { Card, Btn, Field, Select, ErrorBox, Loader, C, CopyBtn, Badge } from '../components/UI'

function DiffBar({ value }: { value: number }) {
  const color = value < 30 ? '#22c55e' : value < 60 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <span style={{ color: '#22c55e', fontSize: 12 }}>↑</span>
  if (trend === 'down') return <span style={{ color: '#ef4444', fontSize: 12 }}>↓</span>
  return <span style={{ color: C.muted, fontSize: 12 }}>→</span>
}

function KwTable({ keywords, title }: { keywords: any[]; title: string }) {
  if (!keywords?.length) return null
  const intentColors: Record<string, string> = {
    'Comercial': '#6366f1', 'Informacional': '#3b82f6', 'Transaccional': '#10b981', 'Navegacional': '#f59e0b',
  }
  return (
    <Card>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Keyword', 'Volumen', 'Dificultad', 'Intención', 'CPC', 'Tendencia', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keywords.map((kw: any, i: number) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}20` }}>
                <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 500 }}>{kw.keyword}</td>
                <td style={{ padding: '10px 12px', color: C.green, fontWeight: 600 }}>{kw.volume?.toLocaleString()}</td>
                <td style={{ padding: '10px 12px' }}><DiffBar value={kw.difficulty || 0} /></td>
                <td style={{ padding: '10px 12px' }}>
                  <Badge label={kw.intent || '—'} color={intentColors[kw.intent] || C.muted} />
                </td>
                <td style={{ padding: '10px 12px', color: C.orange, fontWeight: 600 }}>${kw.cpc}</td>
                <td style={{ padding: '10px 12px' }}><TrendIcon trend={kw.trend} /></td>
                <td style={{ padding: '10px 12px' }}><CopyBtn text={kw.keyword} small /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function KeywordsPage() {
  const [form, setForm] = useState({ topic: '', industry: '', location: 'Chile' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  async function run() {
    if (!form.topic.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await post('/api/keywords', form)
      setResult(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const allKws = result ? [
    ...(result.primary || []),
    ...(result.secondary || []),
    ...(result.longtail || []),
  ] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
          Investigación de Palabras Clave con IA
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <Field label="Tema o negocio *" value={form.topic} onChange={set('topic')} placeholder="cortinas roller Chile" />
          <Field label="Industria" value={form.industry} onChange={set('industry')} placeholder="decoración, hogar" />
          <Select label="Ubicación" value={form.location} onChange={set('location')} options={[
            { value: 'Chile', label: '🇨🇱 Chile' },
            { value: 'Colombia', label: '🇨🇴 Colombia' },
            { value: 'Mexico', label: '🇲🇽 México' },
            { value: 'Argentina', label: '🇦🇷 Argentina' },
            { value: 'Espana', label: '🇪🇸 España' },
          ]} />
        </div>
        <Btn onClick={run} disabled={!form.topic.trim() || loading} loading={loading}>
          🎯 Investigar keywords
        </Btn>
      </Card>

      {error && <ErrorBox msg={error} />}
      {loading && <Loader />}

      {result && (
        <>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { label: 'Keywords totales', value: allKws.length, color: '#6366f1' },
              { label: 'Volumen máx.', value: Math.max(...allKws.map((k: any) => k.volume || 0)).toLocaleString(), color: C.green },
              { label: 'Long tails', value: result.longtail?.length || 0, color: C.orange },
              { label: 'Preguntas', value: result.questions?.length || 0, color: '#3b82f6' },
            ].map(s => (
              <Card key={s.label} style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
              </Card>
            ))}
          </div>

          {result.insights && (
            <Card style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.3)' }}>
              <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 600, marginBottom: 6 }}>💡 Análisis del mercado</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{result.insights}</div>
            </Card>
          )}

          <KwTable keywords={result.primary} title="🏆 Keywords Principales" />
          <KwTable keywords={result.secondary} title="📊 Keywords Secundarias" />
          <KwTable keywords={result.longtail} title="🎯 Long Tails (más fáciles de posicionar)" />

          {/* Questions */}
          {result.questions?.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
                ❓ Preguntas que hace tu audiencia (Google People Also Ask)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.questions.map((q: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.surface, borderRadius: 8 }}>
                    <span style={{ fontSize: 13, color: C.text }}>{q.question || q}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {q.volume && <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>{q.volume.toLocaleString()}/mes</span>}
                      <CopyBtn text={q.question || q} small />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Negatives */}
          {result.negative?.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
                🚫 Keywords negativas (excluir de Google Ads)
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {result.negative.map((kw: string, i: number) => (
                  <span key={i} style={{ padding: '4px 12px', borderRadius: 20, background: '#ef444418', color: '#fca5a5', fontSize: 12, fontWeight: 600 }}>
                    -{kw}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
