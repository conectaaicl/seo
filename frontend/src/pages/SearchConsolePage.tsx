import { useState, useEffect } from 'react'
import { get, del as apiDel } from '../api'
import { Card, Btn, Loader, ErrorBox, C } from '../components/UI'

const API_BASE = import.meta.env.VITE_API_URL || ''

function MetricBox({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card style={{ padding: '20px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: color || '#fff' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </Card>
  )
}

function QueryTable({ rows, type }: { rows: any[]; type: 'query' | 'page' }) {
  if (!rows.length) return null
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {[type === 'query' ? 'Keyword' : 'Página', 'Clics', 'Impresiones', 'CTR', 'Posición'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: h === (type === 'query' ? 'Keyword' : 'Página') ? 'left' : 'right', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}20` }}>
              <td style={{ padding: '10px 12px', color: '#93c5fd', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {type === 'page' ? (
                  <span title={r.key} style={{ fontSize: 12 }}>{r.key.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                ) : r.key}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fff', fontWeight: 600 }}>{r.clicks.toLocaleString()}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: C.text }}>{r.impressions.toLocaleString()}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: r.ctr >= 5 ? '#10b981' : r.ctr >= 2 ? '#f59e0b' : C.muted }}>{r.ctr}%</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: r.position <= 3 ? '#10b981' : r.position <= 10 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>#{r.position}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SearchConsolePage() {
  const [status, setStatus] = useState<{ connected: boolean } | null>(null)
  const [sites, setSites] = useState<string[]>([])
  const [selectedSite, setSelectedSite] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [siteLoading, setSiteLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Check for gsc=ok/error in URL params after OAuth redirect
    const params = new URLSearchParams(window.location.search)
    if (params.get('gsc') === 'ok') {
      window.history.replaceState({}, '', window.location.pathname)
    }
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const s = await get('/api/gsc/status')
      setStatus(s)
      if (s.connected) loadSites()
    } catch { setStatus({ connected: false }) }
  }

  async function loadSites() {
    setSiteLoading(true)
    try {
      const r = await get('/api/gsc/sites')
      setSites(r.sites || [])
      if (r.sites?.length > 0) {
        setSelectedSite(r.sites[0])
      }
    } catch (e: any) { setError(e.message) }
    finally { setSiteLoading(false) }
  }

  async function connect() {
    try {
      const r = await get('/api/gsc/auth-url')
      window.location.href = r.url
    } catch (e: any) { setError(e.message) }
  }

  async function disconnect() {
    if (!confirm('¿Desconectar Google Search Console?')) return
    await apiDel('/api/gsc/disconnect')
    setStatus({ connected: false })
    setSites([])
    setSelectedSite('')
    setData(null)
  }

  async function loadAnalytics(site?: string) {
    const s = site || selectedSite
    if (!s) return
    setLoading(true); setError(''); setData(null)
    try {
      const r = await get(`/api/gsc/analytics?site_url=${encodeURIComponent(s)}`)
      setData(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (selectedSite) loadAnalytics(selectedSite)
  }, [selectedSite])

  if (!status) return <Loader />

  // Not connected
  if (!status.connected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}>
        <Card style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
            Conecta Google Search Console
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 28, lineHeight: 1.6 }}>
            Ve tus keywords reales, clics, impresiones y posiciones directamente desde Google.
          </div>
          {error && <ErrorBox msg={error} />}
          <Btn onClick={connect} full>
            <span style={{ fontSize: 16 }}>G</span> Conectar con Google
          </Btn>
        </Card>

        <Card style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', marginBottom: 10 }}>¿Qué verás al conectar?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              '📈 Top 25 keywords con clics, impresiones, CTR y posición',
              '📄 Top 10 páginas más visitadas desde Google',
              '📊 Totales del período: clics, impresiones, CTR promedio',
              '🔍 Datos de los últimos 28 días directamente de Google',
            ].map((t, i) => (
              <div key={i} style={{ fontSize: 13, color: C.text }}>{t}</div>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  // Connected — show data
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Site selector */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>Search Console conectado</div>
              <div style={{ fontSize: 11, color: C.muted }}>{sites.length} sitio(s) verificado(s)</div>
            </div>
          </div>
          {siteLoading ? (
            <div style={{ fontSize: 12, color: C.muted }}>Cargando sitios...</div>
          ) : sites.length > 0 ? (
            <select
              value={selectedSite}
              onChange={e => setSelectedSite(e.target.value)}
              style={{
                background: '#0d1117', border: `1px solid ${C.border}`, borderRadius: 8,
                color: '#fff', padding: '8px 12px', fontSize: 13, cursor: 'pointer',
              }}
            >
              {sites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <div style={{ fontSize: 12, color: '#f59e0b' }}>No hay sitios verificados en esta cuenta</div>
          )}
          <Btn onClick={disconnect} variant="ghost" small>Desconectar</Btn>
        </div>
      </Card>

      {error && <ErrorBox msg={error} />}
      {loading && <Loader />}

      {data && (
        <>
          {/* Totals */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <MetricBox label="Clics totales" value={data.totals.clicks.toLocaleString()} sub={`${data.period.days} días`} color="#10b981" />
            <MetricBox label="Impresiones" value={data.totals.impressions.toLocaleString()} />
            <MetricBox label="CTR promedio" value={`${data.totals.ctr}%`} color={data.totals.ctr >= 3 ? '#10b981' : '#f59e0b'} />
            <MetricBox label="Posición media" value={`#${data.totals.position}`} color={data.totals.position <= 10 ? '#10b981' : '#f59e0b'} />
          </div>

          {/* Top queries */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
              Top Keywords — últimos {data.period.days} días
            </div>
            <QueryTable rows={data.top_queries} type="query" />
          </Card>

          {/* Top pages */}
          {data.top_pages.length > 0 && (
            <Card>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                Top Páginas por clics
              </div>
              <QueryTable rows={data.top_pages} type="page" />
            </Card>
          )}

          <div style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>
            Datos del {data.period.start} al {data.period.end} · {data.site}
          </div>
        </>
      )}
    </div>
  )
}
