import { useState } from 'react'
import { post } from '../api'
import { Card, Btn, Field, Select, ErrorBox, Loader, C, Badge, CopyBtn } from '../components/UI'

const intentColors: Record<string, string> = {
  'Informacional': '#3b82f6',
  'Comercial': '#6366f1',
  'Transaccional': '#10b981',
  'Navegacional': '#f59e0b',
}

const formatColors: Record<string, string> = {
  'articulo': '#6366f1', 'guia': '#10b981', 'listado': '#3b82f6',
  'comparativa': '#f59e0b', 'tutorial': '#8b5cf6', 'caso_estudio': '#ef4444',
}

const priorityColors: Record<string, string> = {
  'alta': '#ef4444', 'media': '#f59e0b', 'baja': '#22c55e',
}

export default function CalendarPage() {
  const [form, setForm] = useState({ business: '', industry: '', months: '1', posts_per_week: '2' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<'table' | 'board'>('table')

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  async function run() {
    if (!form.business.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await post('/api/generate/calendar', {
        ...form,
        months: parseInt(form.months),
        posts_per_week: parseInt(form.posts_per_week),
      })
      setResult(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  // Group posts by week
  const postsByWeek: Record<number, any[]> = {}
  result?.posts?.forEach((p: any) => {
    if (!postsByWeek[p.week]) postsByWeek[p.week] = []
    postsByWeek[p.week].push(p)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
          Calendario Editorial SEO con IA
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <Field label="Nombre del negocio *" value={form.business} onChange={set('business')} placeholder="TerraBlinds SpA" />
          <Field label="Industria" value={form.industry} onChange={set('industry')} placeholder="decoración, hogar" />
          <Select label="Meses" value={form.months} onChange={set('months')} options={[
            { value: '1', label: '1 mes' },
            { value: '2', label: '2 meses' },
            { value: '3', label: '3 meses' },
          ]} />
          <Select label="Posts / semana" value={form.posts_per_week} onChange={set('posts_per_week')} options={[
            { value: '1', label: '1 por semana' },
            { value: '2', label: '2 por semana' },
            { value: '3', label: '3 por semana' },
            { value: '4', label: '4 por semana' },
          ]} />
        </div>
        <Btn onClick={run} disabled={!form.business.trim() || loading} loading={loading}>
          📅 Generar calendario
        </Btn>
      </Card>

      {error && <ErrorBox msg={error} />}
      {loading && <Loader />}

      {result && (
        <>
          {/* Strategy */}
          {result.strategy && (
            <Card style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.3)' }}>
              <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 600, marginBottom: 6 }}>📌 Estrategia de contenido</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{result.strategy}</div>
            </Card>
          )}

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: 'Total de posts', value: result.posts?.length || 0, color: '#6366f1' },
              { label: 'Pillar pages', value: result.pillar_pages?.length || 0, color: C.green },
              { label: 'Quick wins', value: result.quick_wins?.length || 0, color: C.orange },
            ].map(s => (
              <Card key={s.label} style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              </Card>
            ))}
          </div>

          {/* Monthly themes */}
          {result.monthly_themes?.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {result.monthly_themes.map((mt: any, i: number) => (
                <Card key={i} style={{ flex: 1, minWidth: 200, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>MES {mt.month}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{mt.theme}</div>
                  <Badge label={mt.focus_keyword} color='#6366f1' />
                </Card>
              ))}
            </div>
          )}

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['table', 'board'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: view === v ? 'rgba(99,102,241,0.2)' : C.surface,
                color: view === v ? '#818cf8' : C.muted,
              }}>
                {v === 'table' ? '📋 Tabla' : '📌 Board'}
              </button>
            ))}
          </div>

          {/* Table view */}
          {view === 'table' && (
            <Card>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Sem', 'Día', 'Título', 'Keyword', 'Intención', 'Formato', 'Palabras', 'Canales', 'Prior.'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.posts?.map((p: any, i: number) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}20` }}>
                        <td style={{ padding: '9px 10px', color: C.muted, fontWeight: 600, fontSize: 12 }}>S{p.week}</td>
                        <td style={{ padding: '9px 10px', color: C.muted, fontSize: 12 }}>{p.day}</td>
                        <td style={{ padding: '9px 10px', color: '#fff', fontWeight: 500, maxWidth: 260 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{p.title}</span>
                            <CopyBtn text={p.title} small />
                          </div>
                        </td>
                        <td style={{ padding: '9px 10px', color: C.green, fontSize: 12 }}>{p.keyword}</td>
                        <td style={{ padding: '9px 10px' }}>
                          <Badge label={p.intent || '—'} color={intentColors[p.intent] || C.muted} />
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          <Badge label={p.format || '—'} color={formatColors[p.format] || C.muted} />
                        </td>
                        <td style={{ padding: '9px 10px', color: C.muted, fontSize: 12 }}>{p.word_count?.toLocaleString()}</td>
                        <td style={{ padding: '9px 10px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {p.channels?.map((ch: string, ci: number) => (
                              <span key={ci} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 20, background: '#ffffff10', color: C.muted }}>{ch}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: priorityColors[p.priority] || C.muted }}>
                            {p.priority?.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Board view */}
          {view === 'board' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(postsByWeek).map(([week, posts]) => (
                <div key={week}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', marginBottom: 8, padding: '4px 0' }}>
                    SEMANA {week}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 10 }}>
                    {posts.map((p: any, i: number) => (
                      <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: C.muted }}>{p.day}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: priorityColors[p.priority] || C.muted }}>{p.priority?.toUpperCase()}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 8, lineHeight: 1.4 }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: C.green, marginBottom: 8 }}>🎯 {p.keyword}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Badge label={p.intent || '—'} color={intentColors[p.intent] || C.muted} />
                          <Badge label={p.format || '—'} color={formatColors[p.format] || C.muted} />
                          <span style={{ fontSize: 11, color: C.muted }}>{p.word_count?.toLocaleString()} palabras</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pillar pages + Quick wins */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {result.pillar_pages?.length > 0 && (
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>🏛 Páginas Pilar sugeridas</div>
                {result.pillar_pages.map((p: string, i: number) => (
                  <div key={i} style={{ fontSize: 13, color: C.text, padding: '7px 0', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#818cf8' }}>→</span> {p}
                    <CopyBtn text={p} small />
                  </div>
                ))}
              </Card>
            )}
            {result.quick_wins?.length > 0 && (
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 12 }}>⚡ Quick Wins</div>
                {result.quick_wins.map((qw: string, i: number) => (
                  <div key={i} style={{ fontSize: 13, color: C.text, padding: '7px 0', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: C.green }}>✓</span> {qw}
                  </div>
                ))}
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}
