import { useState, useEffect } from 'react'
import { get, post, del as apiDel } from '../api'
import { Card, Btn, Field, ErrorBox, Loader, C } from '../components/UI'

function PositionBadge({ pos }: { pos: string }) {
  const n = parseFloat(pos)
  const color = isNaN(n) ? C.muted : n <= 3 ? '#10b981' : n <= 10 ? '#f59e0b' : n <= 20 ? '#f97316' : '#ef4444'
  const bg = isNaN(n) ? '#ffffff0a' : n <= 3 ? '#10b98118' : n <= 10 ? '#f59e0b18' : n <= 20 ? '#f9731618' : '#ef444418'
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: bg, color }}>
      {isNaN(n) ? '—' : `#${pos}`}
    </span>
  )
}

function MiniChart({ history }: { history: { date: string; position: string }[] }) {
  if (history.length < 2) return <span style={{ fontSize: 11, color: C.muted }}>Sin historial</span>
  const valid = history.filter(h => !isNaN(parseFloat(h.position)))
  if (valid.length < 2) return <span style={{ fontSize: 11, color: C.muted }}>Sin datos</span>
  const positions = valid.map(h => parseFloat(h.position))
  const max = Math.max(...positions)
  const min = Math.min(...positions)
  const range = max - min || 1
  const w = 80, h = 28
  const pts = valid.map((h, i) => {
    const x = (i / (valid.length - 1)) * w
    // Invert: lower position = higher on chart
    const y = ((parseFloat(h.position) - min) / range) * (h - 4) + 2
    return `${x},${y}`
  }).join(' ')
  const last = positions[positions.length - 1]
  const prev = positions[positions.length - 2]
  const trend = last < prev ? '↑' : last > prev ? '↓' : '→'
  const trendColor = last < prev ? '#10b981' : last > prev ? '#ef4444' : C.muted
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={w} height={h} style={{ overflow: 'visible' }}>
        <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="1.5" />
      </svg>
      <span style={{ fontSize: 12, color: trendColor, fontWeight: 700 }}>{trend}</span>
    </div>
  )
}

export default function RankTrackingPage() {
  const [keywords, setKeywords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ keyword: '', site_url: '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const r = await get('/api/rank/keywords')
      setKeywords(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function checkNow() {
    setChecking(true); setError(''); setSuccess('')
    try {
      const r = await post('/api/rank/check', {})
      setSuccess(`✓ ${r.updated} keywords actualizadas (últimos 7 días de Search Console)`)
      load()
    } catch (e: any) { setError(e.message) }
    finally { setChecking(false) }
  }

  async function addKeyword() {
    if (!form.keyword.trim() || !form.site_url.trim()) return
    setAdding(true); setError('')
    try {
      await post('/api/rank/keywords', form)
      setForm({ keyword: '', site_url: '' })
      load()
    } catch (e: any) { setError(e.message) }
    finally { setAdding(false) }
  }

  async function remove(id: string) {
    await apiDel(`/api/rank/keywords/${id}`)
    setKeywords(kws => kws.filter(k => k.id !== id))
  }

  if (loading) return <Loader />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header + check button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Monitorea las posiciones de tus keywords en Google usando Search Console
          </div>
        </div>
        <Btn onClick={checkNow} loading={checking} disabled={keywords.length === 0}>
          🔄 Actualizar posiciones
        </Btn>
      </div>

      {error && <ErrorBox msg={error} />}
      {success && (
        <div style={{ background: '#10b98118', border: '1px solid #10b98140', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#10b981' }}>
          {success}
        </div>
      )}

      {/* Add keyword */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>+ Agregar keyword a rastrear</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: 10, alignItems: 'flex-end' }}>
          <Field
            label="Keyword"
            value={form.keyword}
            onChange={v => setForm(f => ({ ...f, keyword: v }))}
            placeholder="cortinas blackout"
          />
          <Field
            label="Sitio"
            value={form.site_url}
            onChange={v => setForm(f => ({ ...f, site_url: v }))}
            placeholder="https://terrablinds.cl/"
            mono
          />
          <Btn
            onClick={addKeyword}
            loading={adding}
            disabled={!form.keyword.trim() || !form.site_url.trim()}
          >
            Agregar
          </Btn>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
          💡 El sitio debe estar verificado en tu Google Search Console. Usa el formato exacto: <code style={{ color: '#818cf8' }}>https://terrablinds.cl/</code>
        </div>
      </Card>

      {/* Keywords table */}
      {keywords.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 6 }}>Sin keywords rastreadas</div>
            <div style={{ fontSize: 13, color: C.muted }}>Agrega keywords arriba y haz clic en "Actualizar posiciones"</div>
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Keyword', 'Sitio', 'Posición', 'Clics', 'Impresiones', 'Tendencia', 'Última actualización', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keywords.map(kw => (
                  <tr key={kw.id} style={{ borderBottom: `1px solid ${C.border}20` }}>
                    <td style={{ padding: '12px', color: '#fff', fontWeight: 600 }}>{kw.keyword}</td>
                    <td style={{ padding: '12px', color: C.muted, fontSize: 12 }}>
                      {kw.site_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </td>
                    <td style={{ padding: '12px' }}><PositionBadge pos={kw.position} /></td>
                    <td style={{ padding: '12px', color: '#fff', fontWeight: 600 }}>{kw.clicks}</td>
                    <td style={{ padding: '12px', color: C.muted }}>{kw.impressions}</td>
                    <td style={{ padding: '12px' }}><MiniChart history={kw.history} /></td>
                    <td style={{ padding: '12px', color: C.muted, fontSize: 11 }}>
                      {kw.last_checked || 'Nunca'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button onClick={() => remove(kw.id)} style={{
                        background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, padding: '4px 8px', borderRadius: 6,
                      }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 14, padding: '10px 12px', background: '#ffffff06', borderRadius: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>● Top 3</span>
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>● Top 10</span>
            <span style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>● Top 20</span>
            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>● +20</span>
            <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>Datos: últimos 7 días · Google Search Console</span>
          </div>
        </Card>
      )}
    </div>
  )
}
