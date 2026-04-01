import { useState, useEffect } from 'react'
import { get, del as apiDel } from '../api'
import { Card, Btn, Loader, ErrorBox, C } from '../components/UI'

const API_BASE = import.meta.env.VITE_API_URL || ''

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  if (!secs || isNaN(secs)) return '0s'
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, color,
}: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card style={{ padding: '20px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: color || '#fff', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{sub}</div>}
    </Card>
  )
}

// ── Bar chart (inline SVG) ────────────────────────────────────────────────────

function BarChart({
  rows, metric, color,
}: {
  rows: { date: string; sessions: number; users: number; pageviews: number }[]
  metric: 'sessions' | 'users' | 'pageviews'
  color: string
}) {
  if (!rows.length) return null
  const values = rows.map(r => r[metric])
  const maxVal = Math.max(...values, 1)
  const W = 100  // percentage width per column; we lay out using flex

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, width: '100%' }}>
      {rows.map((r, i) => {
        const pct = (r[metric] / maxVal) * 100
        const isLast = i === rows.length - 1
        return (
          <div
            key={r.date}
            title={`${r.date}: ${r[metric].toLocaleString()}`}
            style={{
              flex: 1,
              height: `${Math.max(pct, 2)}%`,
              background: isLast ? color : color + '88',
              borderRadius: '3px 3px 0 0',
              minWidth: 2,
              transition: 'height 0.3s',
              cursor: 'default',
            }}
          />
        )
      })}
    </div>
  )
}

// ── Top pages table ───────────────────────────────────────────────────────────

function PagesTable({ pages }: { pages: { path: string; pageviews: number; sessions: number; bounceRate: number }[] }) {
  if (!pages.length) return null
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Página', 'Pageviews', 'Sesiones', 'Bounce Rate'].map(h => (
              <th key={h} style={{
                padding: '10px 12px',
                textAlign: h === 'Página' ? 'left' : 'right',
                color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pages.map((p, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}20` }}>
              <td style={{ padding: '10px 12px', color: '#93c5fd', maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span title={p.path}>{p.path || '/'}</span>
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fff', fontWeight: 600 }}>
                {p.pageviews.toLocaleString()}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: C.text }}>
                {p.sessions.toLocaleString()}
              </td>
              <td style={{
                padding: '10px 12px', textAlign: 'right', fontWeight: 600,
                color: p.bounceRate <= 40 ? '#10b981' : p.bounceRate <= 65 ? '#f59e0b' : '#ef4444',
              }}>
                {p.bounceRate}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [status, setStatus] = useState<{ connected: boolean } | null>(null)
  const [properties, setProperties] = useState<{ id: string; name: string; account: string }[]>([])
  const [selectedProperty, setSelectedProperty] = useState('')
  const [days, setDays] = useState(28)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [propsLoading, setPropsLoading] = useState(false)
  const [error, setError] = useState('')
  const [chartMetric, setChartMetric] = useState<'sessions' | 'users' | 'pageviews'>('sessions')

  // Check for ?ga4=ok after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('ga4') === 'ok') {
      window.history.replaceState({}, '', window.location.pathname + '?tab=analytics')
    }
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const s = await get('/api/ga4/status')
      setStatus(s)
      if (s.connected) loadProperties()
    } catch {
      setStatus({ connected: false })
    }
  }

  async function loadProperties() {
    setPropsLoading(true)
    setError('')
    try {
      const r = await get('/api/ga4/properties')
      const props = r.properties || []
      setProperties(props)
      if (props.length > 0) setSelectedProperty(props[0].id)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPropsLoading(false)
    }
  }

  async function connect() {
    try {
      const r = await get('/api/ga4/auth-url')
      window.location.href = r.url
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function disconnect() {
    if (!confirm('¿Desconectar Google Analytics 4?')) return
    try {
      await apiDel('/api/ga4/disconnect')
      setStatus({ connected: false })
      setProperties([])
      setSelectedProperty('')
      setData(null)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function loadReport(propId?: string, d?: number) {
    const pid = propId ?? selectedProperty
    const period = d ?? days
    if (!pid) return
    setLoading(true)
    setError('')
    setData(null)
    try {
      const r = await get(`/api/ga4/report?property_id=${encodeURIComponent(pid)}&days=${period}`)
      setData(r)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-load report when property or days change
  useEffect(() => {
    if (selectedProperty) loadReport(selectedProperty, days)
  }, [selectedProperty, days])

  if (!status) return <Loader />

  // ── Not connected ────────────────────────────────────────────────────────────
  if (!status.connected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}>
        <Card style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
            Conectar Google Analytics 4
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 28, lineHeight: 1.6 }}>
            Ve las sesiones reales, usuarios, pageviews, tasa de rebote y duración de sesión
            directamente desde tu cuenta de GA4.
          </div>
          {error && <ErrorBox msg={error} />}
          <div style={{ marginTop: error ? 16 : 0 }}>
            <Btn onClick={connect} full>
              <span style={{ fontSize: 16 }}>G</span> Conectar Google Analytics 4
            </Btn>
          </div>
        </Card>

        <Card style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', marginBottom: 10 }}>
            ¿Qué verás al conectar?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Sesiones, usuarios únicos y pageviews del período',
              'Tasa de rebote y duración media de sesión',
              'Gráfico de tráfico diario con barras SVG',
              'Top 20 páginas más visitadas con métricas',
              'Selector de período: 7, 28 o 90 días',
            ].map((t, i) => (
              <div key={i} style={{ fontSize: 13, color: C.text, display: 'flex', gap: 8 }}>
                <span style={{ color: C.accent, flexShrink: 0 }}>›</span>
                {t}
              </div>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  // ── Connected ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header card: status + selectors */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0,
              boxShadow: '0 0 6px #10b981',
            }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>GA4 conectado</div>
              <div style={{ fontSize: 11, color: C.muted }}>{properties.length} propiedad(es)</div>
            </div>
          </div>

          {/* Property selector */}
          {propsLoading ? (
            <div style={{ fontSize: 12, color: C.muted }}>Cargando propiedades...</div>
          ) : properties.length > 0 ? (
            <select
              value={selectedProperty}
              onChange={e => setSelectedProperty(e.target.value)}
              style={{
                background: '#0d1117', border: `1px solid ${C.border}`, borderRadius: 8,
                color: '#fff', padding: '8px 12px', fontSize: 13, cursor: 'pointer', maxWidth: 320,
              }}
            >
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.account})</option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: 12, color: '#f59e0b' }}>No se encontraron propiedades GA4</div>
          )}

          {/* Period selector */}
          <div style={{ display: 'flex', gap: 4 }}>
            {([7, 28, 90] as const).map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: days === d ? 'rgba(99,102,241,0.2)' : 'transparent',
                  color: days === d ? '#818cf8' : C.muted,
                  outline: days === d ? '1px solid rgba(99,102,241,0.35)' : 'none',
                }}
              >
                {d}d
              </button>
            ))}
          </div>

          <Btn onClick={disconnect} variant="ghost" small>Desconectar</Btn>
        </div>
      </Card>

      {error && <ErrorBox msg={error} />}
      {loading && <Loader />}

      {data && (
        <>
          {/* Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <MetricCard
              label="Sesiones"
              value={fmtNum(data.totals.sessions)}
              sub={`${data.period.days} días`}
              color="#6366f1"
            />
            <MetricCard
              label="Usuarios"
              value={fmtNum(data.totals.users)}
              color="#3b82f6"
            />
            <MetricCard
              label="Pageviews"
              value={fmtNum(data.totals.pageviews)}
              color="#8b5cf6"
            />
            <MetricCard
              label="Bounce Rate"
              value={`${data.totals.bounceRate}%`}
              color={
                data.totals.bounceRate <= 40 ? '#10b981'
                : data.totals.bounceRate <= 65 ? '#f59e0b'
                : '#ef4444'
              }
            />
            <MetricCard
              label="Duración media"
              value={fmtDuration(data.totals.avgSessionDuration)}
              color="#10b981"
            />
          </div>

          {/* Traffic chart */}
          {data.daily.length > 0 && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  Tráfico diario — últimos {data.period.days} días
                </div>
                {/* Metric picker for chart */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {([
                    ['sessions', 'Sesiones', '#6366f1'],
                    ['users', 'Usuarios', '#3b82f6'],
                    ['pageviews', 'Pageviews', '#8b5cf6'],
                  ] as const).map(([m, label, color]) => (
                    <button
                      key={m}
                      onClick={() => setChartMetric(m)}
                      style={{
                        padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600,
                        background: chartMetric === m ? color + '22' : 'transparent',
                        color: chartMetric === m ? color : C.muted,
                        outline: chartMetric === m ? `1px solid ${color}44` : 'none',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <BarChart
                rows={data.daily}
                metric={chartMetric}
                color={chartMetric === 'sessions' ? '#6366f1' : chartMetric === 'users' ? '#3b82f6' : '#8b5cf6'}
              />

              {/* X-axis labels: show first, middle, last date */}
              {data.daily.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: C.muted }}>{data.daily[0]?.date}</span>
                  {data.daily.length > 2 && (
                    <span style={{ fontSize: 10, color: C.muted }}>
                      {data.daily[Math.floor(data.daily.length / 2)]?.date}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: C.muted }}>{data.daily[data.daily.length - 1]?.date}</span>
                </div>
              )}

              {/* Quick summary row */}
              <div style={{
                display: 'flex', gap: 24, marginTop: 16, paddingTop: 16,
                borderTop: `1px solid ${C.border}`, flexWrap: 'wrap',
              }}>
                {data.daily.length > 0 && (() => {
                  const last7 = data.daily.slice(-7)
                  const prev7 = data.daily.slice(-14, -7)
                  const sum = (arr: typeof data.daily) => arr.reduce((a: number, r: any) => a + r[chartMetric], 0)
                  const curr = sum(last7)
                  const prev = sum(prev7)
                  const delta = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null
                  return (
                    <>
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Últimos 7 días</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                          {fmtNum(curr)}
                          {delta !== null && (
                            <span style={{ fontSize: 12, marginLeft: 8, color: delta >= 0 ? '#10b981' : '#ef4444' }}>
                              {delta >= 0 ? '+' : ''}{delta}%
                            </span>
                          )}
                        </div>
                      </div>
                      {prev > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>7 días anteriores</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: C.muted }}>{fmtNum(prev)}</div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </Card>
          )}

          {/* Top pages */}
          {data.top_pages.length > 0 && (
            <Card>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                Top Páginas — últimos {data.period.days} días
              </div>
              <PagesTable pages={data.top_pages} />
            </Card>
          )}

          <div style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>
            Datos del {data.period.start} al {data.period.end} · Propiedad GA4: {data.property_id}
          </div>
        </>
      )}
    </div>
  )
}
