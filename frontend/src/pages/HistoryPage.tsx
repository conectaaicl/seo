import { useState, useEffect } from 'react'
import { get } from '../api'

const C = {
  bg: '#080b10', card: '#131920', border: 'rgba(255,255,255,0.06)',
  accent: '#6366f1', green: '#10b981', text: '#e2e8f0', muted: '#64748b',
  orange: '#f59e0b', red: '#ef4444', blue: '#3b82f6',
}

function gradeColor(grade: string) {
  if (grade === 'A' || grade === 'A+') return C.green
  if (grade === 'B') return '#22d3ee'
  if (grade === 'C') return C.orange
  return C.red
}

function scoreColor(score: number) {
  if (score >= 80) return C.green
  if (score >= 60) return C.orange
  return C.red
}

function Delta({ v }: { v: number | null }) {
  if (v === null || v === undefined) return <span style={{ color: C.muted }}>—</span>
  if (v > 0) return <span style={{ color: C.green, fontWeight: 700 }}>+{v}</span>
  if (v < 0) return <span style={{ color: C.red, fontWeight: 700 }}>{v}</span>
  return <span style={{ color: C.muted }}>0</span>
}

function ScoreBadge({ score, size = 40 }: { score: number; size?: number }) {
  const r = (size / 2) - 4
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, score)) / 100
  const color = scoreColor(score)
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2+5} textAnchor="middle" fill={color}
        fontSize={size === 40 ? 12 : 10} fontWeight={700}>{score}</text>
    </svg>
  )
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateShort(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

function Sparkline({ data, color = C.accent }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return <span style={{ color: C.muted, fontSize: 11 }}>–</span>
  const w = 80, h = 30
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  const last = pts.split(' ').pop()!
  const [lx, ly] = last.split(',').map(Number)
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={lx} cy={ly} r={3} fill={color}/>
    </svg>
  )
}

// ── URL list view ─────────────────────────────────────────────────────────────
function UrlListView({ onSelect }: { onSelect: (url: string) => void }) {
  const [urls, setUrls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    get('/api/snapshots/urls')
      .then(setUrls)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = urls.filter(u => u.url.toLowerCase().includes(search.toLowerCase()))

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <div style={{ color: C.muted }}>Cargando historial...</div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'URLs analizadas', value: urls.length, icon: '🌐' },
          { label: 'Total snapshots', value: urls.reduce((a, u) => a + u.total_snapshots, 0), icon: '📸' },
          { label: 'Última auditoría', value: urls[0] ? formatDateShort(urls[0].last_snapshot) : '—', icon: '🕐' },
        ].map(s => (
          <div key={s.label} style={{
            background: C.card, borderRadius: 12, padding: '16px 20px',
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrar por URL..."
          style={{
            width: '100%', padding: '10px 16px', borderRadius: 10,
            background: C.card, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{
          background: C.card, borderRadius: 12, padding: '48px 32px',
          border: `1px solid ${C.border}`, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ color: C.text, fontWeight: 600, marginBottom: 6 }}>No hay historial aún</div>
          <div style={{ color: C.muted, fontSize: 14 }}>
            Cada vez que analices una URL en Auditoría SEO o Core Web Vitals quedará guardada aquí.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(u => (
            <button
              key={u.url}
              onClick={() => onSelect(u.url)}
              style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: '16px 20px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 16,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
            >
              <ScoreBadge score={u.latest_seo_score || 0} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.url}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: C.muted }}>
                  <span>📸 {u.total_snapshots} análisis</span>
                  <span>🕐 {formatDate(u.last_snapshot)}</span>
                  {u.latest_ps_performance != null && (
                    <span>⚡ Perf: {u.latest_ps_performance}</span>
                  )}
                </div>
              </div>
              <span style={{ color: C.muted, fontSize: 18 }}>›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Snapshots for one URL ─────────────────────────────────────────────────────
function UrlSnapshotsView({
  url,
  onBack,
  onCompare,
}: {
  url: string
  onBack: () => void
  onCompare: (ids: [string, string]) => void
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [trend, setTrend] = useState<any[]>([])

  useEffect(() => {
    get(`/api/snapshots?url=${encodeURIComponent(url)}&limit=50`)
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
    get(`/api/snapshots/trend/series?url=${encodeURIComponent(url)}&days=90`)
      .then(d => setTrend(d.series || []))
      .catch(() => {})
  }, [url])

  function toggleSelect(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  const snaps = data?.snapshots || []
  const auditSnaps = snaps.filter((s: any) => s.snapshot_type === 'audit')
  const scores = auditSnaps.map((s: any) => s.seo_score).filter(Boolean)
  const trendScores = trend.filter(t => t.seo_score).map(t => t.seo_score)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <div style={{ color: C.muted }}>Cargando snapshots...</div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '6px 14px', color: C.muted, cursor: 'pointer', fontSize: 13,
        }}>← Volver</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {url}
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>{data?.total || 0} snapshots guardados</div>
        </div>
        {selected.length === 2 && (
          <button onClick={() => onCompare([selected[0], selected[1]])} style={{
            background: C.accent, border: 'none', borderRadius: 8,
            padding: '8px 18px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            Comparar seleccionados
          </button>
        )}
      </div>

      {trendScores.length >= 2 && (
        <div style={{
          background: C.card, borderRadius: 12, padding: '16px 20px',
          border: `1px solid ${C.border}`, marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Tendencia SEO Score (90 días)</div>
            <Sparkline data={trendScores} color={scoreColor(trendScores[trendScores.length - 1])} />
          </div>
          {scores.length > 0 && (
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted }}>Mejor</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{Math.max(...scores)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted }}>Actual</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(scores[0]) }}>{scores[0]}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted }}>Variación</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  <Delta v={scores.length >= 2 ? scores[0] - scores[scores.length - 1] : null} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {snaps.length >= 2 && (
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
          Selecciona 2 snapshots para comparar → {selected.length}/2 seleccionados
        </div>
      )}

      {snaps.length === 0 ? (
        <div style={{ background: C.card, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, textAlign: 'center', color: C.muted }}>
          No hay snapshots para esta URL
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {snaps.map((snap: any, idx: number) => {
            const isSelected = selected.includes(snap.id)
            const isAudit = snap.snapshot_type === 'audit'
            return (
              <div
                key={snap.id}
                onClick={() => toggleSelect(snap.id)}
                style={{
                  background: C.card, borderRadius: 10, padding: '14px 18px',
                  border: `1px solid ${isSelected ? C.accent : C.border}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                  transition: 'border-color 0.15s',
                  boxShadow: isSelected ? `0 0 0 1px ${C.accent}33` : 'none',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${isSelected ? C.accent : C.border}`,
                  background: isSelected ? C.accent : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                </div>

                <div style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                  background: isAudit ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)',
                  color: isAudit ? '#818cf8' : C.green,
                }}>
                  {isAudit ? 'SEO' : 'PageSpeed'}
                </div>

                {isAudit && snap.seo_score > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ScoreBadge score={snap.seo_score} size={36} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: gradeColor(snap.seo_grade) }}>
                      {snap.seo_grade}
                    </div>
                  </div>
                )}
                {!isAudit && snap.ps_performance > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ScoreBadge score={snap.ps_performance} size={36} />
                    <div style={{ fontSize: 11, color: C.muted }}>Perf</div>
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  {isAudit && (
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.muted }}>
                      <span style={{ color: C.red }}>✗ {snap.seo_errors} errores</span>
                      <span style={{ color: C.orange }}>⚠ {snap.seo_warnings} avisos</span>
                      <span style={{ color: C.green }}>✓ {snap.seo_passed} OK</span>
                    </div>
                  )}
                  {!isAudit && (
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.muted }}>
                      {snap.ps_seo > 0 && <span>SEO: {snap.ps_seo}</span>}
                      {snap.ps_accessibility > 0 && <span>Acc: {snap.ps_accessibility}</span>}
                      {snap.ps_fcp && <span>FCP: {snap.ps_fcp}</span>}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: C.text }}>{formatDate(snap.created_at)}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                    {idx === 0 ? '🔵 Último' : ''}{snap.source === 'auto' ? ' ⚙ auto' : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Compare view ──────────────────────────────────────────────────────────────
function CompareView({ id1, id2, onBack }: { id1: string; id2: string; onBack: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    get(`/api/snapshots/compare/diff?id1=${id1}&id2=${id2}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id1, id2])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <div style={{ color: C.muted }}>Comparando snapshots...</div>
    </div>
  )
  if (error) return (
    <div style={{ background: C.card, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, color: C.red }}>
      Error: {error}
    </div>
  )

  const { snapshot_older: s1, snapshot_newer: s2, deltas, summary } = data
  const isAudit = s1.snapshot_type === 'audit' || s2.snapshot_type === 'audit'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '6px 14px', color: C.muted, cursor: 'pointer', fontSize: 13,
        }}>← Volver</button>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Comparativa de snapshots</div>
      </div>

      <div style={{
        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 10, padding: '12px 18px', marginBottom: 24, fontSize: 13, color: '#818cf8',
      }}>
        {summary}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {[s1, s2].map((s: any, i: number) => (
          <div key={s.id} style={{
            background: C.card, borderRadius: 12, padding: '18px 20px',
            border: `1px solid ${i === 1 ? 'rgba(99,102,241,0.4)' : C.border}`,
          }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>
              {i === 0 ? '📅 Más antiguo' : '🔵 Más reciente'}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>{formatDate(s.created_at)}</div>
            {isAudit && s.seo_score > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ScoreBadge score={s.seo_score} size={56} />
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: gradeColor(s.seo_grade) }}>{s.seo_grade}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    ✗ {s.seo_errors} · ⚠ {s.seo_warnings} · ✓ {s.seo_passed}
                  </div>
                </div>
              </div>
            )}
            {!isAudit && s.ps_performance > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ScoreBadge score={s.ps_performance} size={56} />
                <div style={{ fontSize: 13, color: C.muted }}>
                  <div>SEO: {s.ps_seo}</div>
                  <div>Acc: {s.ps_accessibility}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: '#fff' }}>
          Diferencias
        </div>
        {(isAudit
          ? [
              { label: 'SEO Score', key: 'seo_score', nv: s2.seo_score, ov: s1.seo_score, inv: false },
              { label: 'Errores', key: 'seo_errors', nv: s2.seo_errors, ov: s1.seo_errors, inv: true },
              { label: 'Avisos', key: 'seo_warnings', nv: s2.seo_warnings, ov: s1.seo_warnings, inv: true },
              { label: 'Pasados', key: 'seo_passed', nv: s2.seo_passed, ov: s1.seo_passed, inv: false },
            ]
          : [
              { label: 'Performance', key: 'ps_performance', nv: s2.ps_performance, ov: s1.ps_performance, inv: false },
              { label: 'SEO', key: 'ps_seo', nv: s2.ps_seo, ov: s1.ps_seo, inv: false },
              { label: 'Accesibilidad', key: 'ps_accessibility', nv: s2.ps_accessibility, ov: s1.ps_accessibility, inv: false },
              { label: 'Best Practices', key: 'ps_best_practices', nv: s2.ps_best_practices, ov: s1.ps_best_practices, inv: false },
            ]
        ).map((row: any) => {
          const d = deltas[row.key]
          const dispDelta = row.inv && d !== null ? -d : d
          return (
            <div key={row.key} style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
              padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, color: C.text }}>{row.label}</span>
              <span style={{ fontSize: 13, color: C.muted, textAlign: 'center' }}>{row.ov ?? '—'}</span>
              <span style={{ fontSize: 13, color: '#fff', textAlign: 'center', fontWeight: 600 }}>{row.nv ?? '—'}</span>
              <span style={{ textAlign: 'center' }}><Delta v={dispDelta} /></span>
            </div>
          )
        })}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
          padding: '8px 20px', fontSize: 11, color: C.muted,
        }}>
          <span></span>
          <span style={{ textAlign: 'center' }}>Anterior</span>
          <span style={{ textAlign: 'center' }}>Actual</span>
          <span style={{ textAlign: 'center' }}>Δ</span>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
type View =
  | { type: 'list' }
  | { type: 'url'; url: string }
  | { type: 'compare'; id1: string; id2: string; url: string }

export default function HistoryPage() {
  const [view, setView] = useState<View>({ type: 'list' })

  return (
    <div>
      {view.type === 'list' && (
        <UrlListView onSelect={url => setView({ type: 'url', url })} />
      )}
      {view.type === 'url' && (
        <UrlSnapshotsView
          url={view.url}
          onBack={() => setView({ type: 'list' })}
          onCompare={([id1, id2]) => setView({ type: 'compare', id1, id2, url: view.url })}
        />
      )}
      {view.type === 'compare' && (
        <CompareView
          id1={view.id1}
          id2={view.id2}
          onBack={() => setView({ type: 'url', url: (view as any).url })}
        />
      )}
    </div>
  )
}
