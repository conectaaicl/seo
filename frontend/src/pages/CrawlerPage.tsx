import { useState, useEffect, useRef } from 'react'
import { post, get } from '../api'
import { Card, Btn, Field, ErrorBox, Loader, C } from '../components/UI'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Issue {
  type: 'ok' | 'warning' | 'error'
  field: string
  msg: string
}

interface PageResult {
  url: string
  status: number
  title: string
  title_len: number
  meta_desc: string
  meta_len: number
  h1: string
  canonical: string
  noindex: boolean
  issues: Issue[]
}

interface CrawlResult {
  job_id: string
  site_url: string
  status: 'running' | 'done' | 'error'
  pages_crawled: number
  created_at: string
  issues_summary: { errors: number; warnings: number; ok: number }
  results: PageResult[]
}

interface HistoryItem {
  job_id: string
  site_url: string
  status: string
  pages_crawled: number
  errors: number
  warnings: number
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(code: number) {
  if (code === 0) return C.muted
  if (code < 300) return C.green
  if (code < 400) return C.orange
  return C.red
}

function statusLabel(code: number) {
  if (code === 0) return 'Timeout'
  if (code < 300) return String(code)
  if (code < 400) return String(code)
  return String(code)
}

function issueColor(type: string) {
  if (type === 'ok') return C.green
  if (type === 'error') return C.red
  return C.orange
}

function issueIcon(type: string) {
  if (type === 'ok') return '✓'
  if (type === 'error') return '✗'
  return '⚠'
}

function pageScore(page: PageResult): 'ok' | 'warning' | 'error' {
  const errors = page.issues.filter(i => i.type === 'error').length
  if (errors > 0) return 'error'
  const warns = page.issues.filter(i => i.type === 'warning').length
  if (warns > 0) return 'warning'
  return 'ok'
}

function truncate(str: string, max: number) {
  if (!str) return '—'
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  icon, label, value, color,
}: {
  icon: string; label: string; value: number | string; color: string
}) {
  return (
    <div style={{
      flex: 1, minWidth: 120,
      background: C.card,
      border: `1px solid ${color}30`,
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}

function IssueList({ issues }: { issues: Issue[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {issues.map((issue, i) => {
        const color = issueColor(issue.type)
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '8px 12px', borderRadius: 8,
            background: color + '10', border: `1px solid ${color}25`,
          }}>
            <span style={{ color, fontWeight: 700, fontSize: 12, flexShrink: 0, marginTop: 1 }}>
              {issueIcon(issue.type)}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, flexShrink: 0 }}>
                {issue.field}
              </span>
              <span style={{ fontSize: 12, color: C.text }}>{issue.msg}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PageRow({ page, index }: { page: PageResult; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const score = pageScore(page)
  const scoreColor = score === 'ok' ? C.green : score === 'error' ? C.red : C.orange
  const errorCount = page.issues.filter(i => i.type === 'error').length
  const warnCount = page.issues.filter(i => i.type === 'warning').length

  return (
    <>
      <tr
        onClick={() => setExpanded(e => !e)}
        style={{
          cursor: 'pointer',
          background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
          borderBottom: `1px solid ${C.border}`,
          transition: 'background 0.1s',
        }}
      >
        {/* Score indicator */}
        <td style={{ padding: '10px 12px', width: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: scoreColor, flexShrink: 0,
          }} />
        </td>
        {/* URL */}
        <td style={{ padding: '10px 12px', maxWidth: 280 }}>
          <div style={{
            fontSize: 12, color: C.text, fontFamily: "'JetBrains Mono', monospace",
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 280,
          }} title={page.url}>
            {truncate(page.url.replace(/^https?:\/\/[^/]+/, ''), 55) || '/'}
          </div>
        </td>
        {/* Status */}
        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: statusColor(page.status),
            background: statusColor(page.status) + '18',
            padding: '3px 8px', borderRadius: 6,
          }}>
            {statusLabel(page.status)}
          </span>
        </td>
        {/* Title len */}
        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
          <span style={{
            fontSize: 12, color: page.title_len === 0 ? C.red
              : page.title_len < 30 || page.title_len > 60 ? C.orange : C.green,
            fontWeight: 600,
          }}>
            {page.title_len === 0 ? '—' : page.title_len}
          </span>
        </td>
        {/* Meta len */}
        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
          <span style={{
            fontSize: 12, color: page.meta_len === 0 ? C.red
              : page.meta_len < 70 || page.meta_len > 160 ? C.orange : C.green,
            fontWeight: 600,
          }}>
            {page.meta_len === 0 ? '—' : page.meta_len}
          </span>
        </td>
        {/* H1 */}
        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
          <span style={{ fontSize: 14 }}>{page.h1 ? '✓' : '✗'}</span>
        </td>
        {/* Noindex */}
        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
          {page.noindex
            ? <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>noindex</span>
            : <span style={{ fontSize: 11, color: C.green }}>ok</span>}
        </td>
        {/* Issues */}
        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', alignItems: 'center' }}>
            {errorCount > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: C.red,
                background: C.red + '18', padding: '2px 7px', borderRadius: 5,
              }}>
                {errorCount}E
              </span>
            )}
            {warnCount > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: C.orange,
                background: C.orange + '18', padding: '2px 7px', borderRadius: 5,
              }}>
                {warnCount}W
              </span>
            )}
            {errorCount === 0 && warnCount === 0 && (
              <span style={{ fontSize: 11, color: C.green }}>✓</span>
            )}
          </div>
        </td>
        {/* Expand toggle */}
        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: C.muted }}>{expanded ? '▲' : '▼'}</span>
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: C.surface + '80' }}>
          <td colSpan={9} style={{ padding: '0 16px 16px 16px' }}>
            <div style={{ paddingTop: 12 }}>
              {/* Page details header */}
              <div style={{
                marginBottom: 12, padding: '10px 14px', borderRadius: 9,
                background: C.card, border: `1px solid ${C.border}`,
                display: 'flex', flexWrap: 'wrap', gap: 16,
              }}>
                <div>
                  <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>URL completa</div>
                  <a href={page.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#818cf8', fontFamily: 'monospace' }}>
                    {page.url}
                  </a>
                </div>
                {page.title && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Title</div>
                    <div style={{ fontSize: 12, color: C.text }}>{page.title}</div>
                  </div>
                )}
                {page.h1 && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>H1</div>
                    <div style={{ fontSize: 12, color: C.text }}>{page.h1}</div>
                  </div>
                )}
                {page.canonical && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Canonical</div>
                    <div style={{ fontSize: 12, color: C.text, fontFamily: 'monospace' }}>{page.canonical}</div>
                  </div>
                )}
              </div>
              <IssueList issues={page.issues} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function ResultsTable({ results }: { results: PageResult[] }) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'ok'>('all')
  const [sortBy, setSortBy] = useState<'url' | 'status' | 'issues'>('issues')

  const filtered = results.filter(p => {
    if (filter === 'all') return true
    return pageScore(p) === filter
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'status') return b.status - a.status
    if (sortBy === 'issues') {
      const ae = a.issues.filter(i => i.type === 'error').length
      const be = b.issues.filter(i => i.type === 'error').length
      if (be !== ae) return be - ae
      return b.issues.filter(i => i.type === 'warning').length - a.issues.filter(i => i.type === 'warning').length
    }
    return a.url.localeCompare(b.url)
  })

  const btnStyle = (active: boolean, color: string): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 7, border: `1px solid ${active ? color : C.border}`,
    background: active ? color + '20' : 'transparent',
    color: active ? color : C.muted,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  })

  const thStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 11, color: C.muted, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
  }

  return (
    <div>
      {/* Filter + sort bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btnStyle(filter === 'all', C.accent)} onClick={() => setFilter('all')}>
          Todas ({results.length})
        </button>
        <button style={btnStyle(filter === 'error', C.red)} onClick={() => setFilter('error')}>
          Errores ({results.filter(p => pageScore(p) === 'error').length})
        </button>
        <button style={btnStyle(filter === 'warning', C.orange)} onClick={() => setFilter('warning')}>
          Avisos ({results.filter(p => pageScore(p) === 'warning').length})
        </button>
        <button style={btnStyle(filter === 'ok', C.green)} onClick={() => setFilter('ok')}>
          OK ({results.filter(p => pageScore(p) === 'ok').length})
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.muted }}>Ordenar:</span>
          {(['issues', 'url', 'status'] as const).map(s => (
            <button key={s} style={btnStyle(sortBy === s, C.accent)} onClick={() => setSortBy(s)}>
              {s === 'issues' ? 'Problemas' : s === 'url' ? 'URL' : 'Estado'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${C.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: C.surface }}>
              <th style={{ ...thStyle, width: 18 }}></th>
              <th style={thStyle}>URL</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Title</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Meta</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>H1</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Index</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Issues</th>
              <th style={{ ...thStyle, width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
                  No hay páginas con ese filtro
                </td>
              </tr>
            ) : (
              sorted.map((page, i) => <PageRow key={page.url} page={page} index={i} />)
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
        Mostrando {sorted.length} de {results.length} páginas • Haz clic en una fila para ver detalle
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CrawlerPage() {
  const [siteUrl, setSiteUrl] = useState('')
  const [maxPages, setMaxPages] = useState('50')
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [result, setResult] = useState<CrawlResult | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load history on mount
  useEffect(() => {
    loadHistory()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const data = await get('/api/crawler/history')
      setHistory(data)
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false)
    }
  }

  async function pollResult(id: string) {
    try {
      const data: CrawlResult = await get(`/api/crawler/results/${id}`)
      setResult(data)
      if (data.status === 'done' || data.status === 'error') {
        setPolling(false)
        if (pollRef.current) clearInterval(pollRef.current)
        loadHistory()
      }
    } catch (e: any) {
      // keep polling
    }
  }

  async function handleCrawl() {
    if (!siteUrl.trim()) {
      setError('Ingresa una URL de sitio web')
      return
    }
    setError('')
    setLoading(true)
    setResult(null)
    setJobId(null)

    try {
      const data = await post('/api/crawler/start', {
        site_url: siteUrl.trim(),
        max_pages: parseInt(maxPages, 10) || 50,
      })
      const id = data.job_id
      setJobId(id)
      setPolling(true)
      setLoading(false)

      // Start polling
      if (pollRef.current) clearInterval(pollRef.current)
      await pollResult(id)
      pollRef.current = setInterval(() => pollResult(id), 2500)
    } catch (e: any) {
      setError(e.message || 'Error al iniciar el crawl')
      setLoading(false)
    }
  }

  async function loadHistoricResult(id: string) {
    setError('')
    setResult(null)
    setJobId(id)
    try {
      const data: CrawlResult = await get(`/api/crawler/results/${id}`)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Error al cargar resultado')
    }
  }

  const isCrawling = loading || polling

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header card: URL input ─────────────────────────────────────────── */}
      <Card>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            Crawlear sitio web
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>
            Analiza todas las páginas de tu sitio y detecta problemas SEO de forma masiva
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Field
              label="URL del sitio"
              value={siteUrl}
              onChange={setSiteUrl}
              placeholder="https://tudominio.com"
            />
          </div>
          <div style={{ width: 120 }}>
            <Field
              label="Máx. páginas"
              value={maxPages}
              onChange={setMaxPages}
              placeholder="50"
              type="number"
            />
          </div>
          <Btn
            onClick={handleCrawl}
            disabled={isCrawling}
            loading={isCrawling}
          >
            {isCrawling ? 'Crawleando…' : 'Crawlear sitio'}
          </Btn>
        </div>

        {error && <div style={{ marginTop: 12 }}><ErrorBox msg={error} /></div>}

        {/* Crawling progress */}
        {polling && result && result.status === 'running' && (
          <div style={{
            marginTop: 16, padding: '14px 18px', borderRadius: 10,
            background: C.accent + '12', border: `1px solid ${C.accent}30`,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 18, height: 18, border: `3px solid ${C.border}`,
              borderTopColor: C.accent, borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', flexShrink: 0,
            }} />
            <div>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
                Crawleando {result.site_url}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {result.pages_crawled} página(s) rastreadas hasta ahora…
              </div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
      </Card>

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      {result && result.status === 'done' && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <SummaryCard
              icon="🌐"
              label="Páginas crawleadas"
              value={result.pages_crawled}
              color={C.accent}
            />
            <SummaryCard
              icon="✗"
              label="Errores"
              value={result.issues_summary.errors}
              color={result.issues_summary.errors > 0 ? C.red : C.green}
            />
            <SummaryCard
              icon="⚠"
              label="Avisos"
              value={result.issues_summary.warnings}
              color={result.issues_summary.warnings > 0 ? C.orange : C.green}
            />
            <SummaryCard
              icon="✓"
              label="Checks OK"
              value={result.issues_summary.ok}
              color={C.green}
            />
          </div>

          {/* Results table */}
          <Card>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
              paddingBottom: 16, borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                Resultados del crawl
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>
                {result.site_url} &bull; {result.created_at}
              </div>
            </div>
            <ResultsTable results={result.results} />
          </Card>
        </>
      )}

      {/* Loading placeholder while first results come in */}
      {polling && (!result || result.status === 'running') && result?.pages_crawled === 0 && (
        <Loader />
      )}

      {/* ── History ──────────────────────────────────────────────────────────── */}
      <Card>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          paddingBottom: 14, borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
            Historial de crawls
          </div>
          <Btn small variant="ghost" onClick={loadHistory}>
            Actualizar
          </Btn>
        </div>

        {historyLoading ? (
          <div style={{ color: C.muted, fontSize: 13, padding: '12px 0' }}>Cargando historial…</div>
        ) : history.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13, padding: '12px 0' }}>
            Aún no hay crawls. Empieza rastreando tu primer sitio.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(item => {
              const isActive = item.job_id === jobId
              return (
                <div
                  key={item.job_id}
                  onClick={() => loadHistoricResult(item.job_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                    background: isActive ? C.accent + '12' : C.surface,
                    border: `1px solid ${isActive ? C.accent + '40' : C.border}`,
                    transition: 'background 0.15s',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Status dot */}
                  <div style={{
                    width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                    background: item.status === 'done'
                      ? (item.errors > 0 ? C.red : C.green)
                      : item.status === 'running' ? C.orange : C.muted,
                  }} />

                  {/* URL */}
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{item.site_url}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.created_at}</div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: C.muted }}>
                      {item.pages_crawled} páginas
                    </span>
                    {item.errors > 0 && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: C.red,
                        background: C.red + '18', padding: '2px 8px', borderRadius: 5,
                      }}>
                        {item.errors} errores
                      </span>
                    )}
                    {item.warnings > 0 && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: C.orange,
                        background: C.orange + '18', padding: '2px 8px', borderRadius: 5,
                      }}>
                        {item.warnings} avisos
                      </span>
                    )}
                    {item.errors === 0 && item.warnings === 0 && item.status === 'done' && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: C.green,
                        background: C.green + '18', padding: '2px 8px', borderRadius: 5,
                      }}>
                        Todo OK
                      </span>
                    )}
                    {item.status === 'running' && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: C.orange,
                        background: C.orange + '18', padding: '2px 8px', borderRadius: 5,
                      }}>
                        En curso
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 11, color: C.muted }}>Ver →</div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

    </div>
  )
}
