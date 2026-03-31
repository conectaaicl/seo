import { useState } from 'react'
import { post } from '../api'
import { Card, Btn, Field, Select, ErrorBox, Loader, C, CopyBtn, Badge } from '../components/UI'

function AdPreview({ ad }: { ad: any }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: '#202124', marginBottom: 2 }}>{ad.display_url || 'tuempresa.cl'}</div>
      <div style={{ fontSize: 17, color: '#1a0dab', fontWeight: 400, marginBottom: 4, lineHeight: 1.3 }}>
        {[ad.headline_1, ad.headline_2, ad.headline_3].filter(Boolean).join(' | ')}
      </div>
      <div style={{ fontSize: 13, color: '#4d5156', lineHeight: 1.5 }}>{ad.desc_1}</div>
      <div style={{ fontSize: 13, color: '#4d5156', lineHeight: 1.5 }}>{ad.desc_2}</div>
    </div>
  )
}

function CharCount({ text, max }: { text: string; max: number }) {
  const n = (text || '').length
  const color = n > max ? '#ef4444' : n > max * 0.85 ? '#f59e0b' : C.green
  return <span style={{ fontSize: 10, color }}>{n}/{max}</span>
}

export default function AdsPage() {
  const [platform, setPlatform] = useState<'google' | 'meta'>('google')
  const [form, setForm] = useState({
    product: '', keyword: '', url: '', business: '', budget: '', objective: 'conversiones'
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  async function run() {
    if (!form.product.trim() || !form.keyword.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const endpoint = platform === 'google' ? '/api/generate/ads' : '/api/generate/meta-ads'
      const r = await post(endpoint, form)
      setResult(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
          Generador de Campañas con IA
        </div>

        {/* Platform toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {([['google', '🔍 Google Ads'], ['meta', '📘 Meta Ads']] as const).map(([id, label]) => (
            <button key={id} onClick={() => { setPlatform(id); setResult(null) }} style={{
              padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: platform === id ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : C.surface,
              color: platform === id ? '#fff' : C.muted,
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Producto / Servicio *" value={form.product} onChange={set('product')} placeholder="Cortinas Roller Premium" />
          <Field label="Keyword principal *" value={form.keyword} onChange={set('keyword')} placeholder="cortinas roller Santiago" />
          <Field label="URL destino" value={form.url} onChange={set('url')} placeholder="https://terrablinds.cl" mono />
          <Field label="Nombre del negocio" value={form.business} onChange={set('business')} placeholder="TerraBlinds SpA" />
          <Field label="Presupuesto diario" value={form.budget} onChange={set('budget')} placeholder="$5.000 - $15.000 CLP" />
          <Select label="Objetivo" value={form.objective} onChange={set('objective')} options={[
            { value: 'conversiones', label: 'Conversiones / Leads' },
            { value: 'trafico', label: 'Tráfico al sitio web' },
            { value: 'awareness', label: 'Reconocimiento de marca' },
            { value: 'ventas', label: 'Ventas online' },
          ]} />
        </div>
        <Btn onClick={run} disabled={!form.product.trim() || !form.keyword.trim() || loading} loading={loading}>
          📢 Generar campaña completa
        </Btn>
      </Card>

      {error && <ErrorBox msg={error} />}
      {loading && <Loader />}

      {/* Google Ads result */}
      {result && platform === 'google' && (
        <>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{result.campaign_name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  Estrategia: {result.bid_strategy} · CPC estimado: <span style={{ color: C.orange }}>{result.estimated_cpc}</span>
                </div>
              </div>
            </div>
          </Card>

          {result.ad_groups?.map((group: any, gi: number) => (
            <Card key={gi}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
                📁 {group.name}
              </div>

              {/* Keywords */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Exacta [...]', kws: group.keywords_exact, color: C.green },
                  { label: 'Frase "..."', kws: group.keywords_phrase, color: '#3b82f6' },
                  { label: 'Amplia +', kws: group.keywords_broad, color: C.orange },
                ].map(({ label, kws, color }) => (
                  <div key={label} style={{ background: C.surface, borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
                    {kws?.map((kw: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: C.text, padding: '3px 0', borderBottom: `1px solid ${C.border}` }}>
                        {kw}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Ads */}
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, fontWeight: 600 }}>VISTA PREVIA GOOGLE</div>
              {group.ads?.map((ad: any, ai: number) => (
                <div key={ai}>
                  <AdPreview ad={ad} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 16 }}>
                    {[
                      { label: 'H1', text: ad.headline_1, max: 30 },
                      { label: 'H2', text: ad.headline_2, max: 30 },
                      { label: 'H3', text: ad.headline_3, max: 30 },
                      { label: 'H4', text: ad.headline_4, max: 30 },
                      { label: 'H5', text: ad.headline_5, max: 30 },
                    ].map(({ label, text, max }) => text ? (
                      <div key={label} style={{ background: C.surface, borderRadius: 7, padding: '8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: C.muted }}>{label}</span>
                          <CharCount text={text} max={max} />
                        </div>
                        <div style={{ fontSize: 11, color: C.text }}>{text}</div>
                        <CopyBtn text={text} small />
                      </div>
                    ) : null)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    {[{ label: 'Desc 1', text: ad.desc_1, max: 90 }, { label: 'Desc 2', text: ad.desc_2, max: 90 }].map(({ label, text, max }) => text ? (
                      <div key={label} style={{ background: C.surface, borderRadius: 7, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: C.muted }}>{label}</span>
                          <CharCount text={text} max={max} />
                        </div>
                        <div style={{ fontSize: 12, color: C.text, marginBottom: 6 }}>{text}</div>
                        <CopyBtn text={text} small />
                      </div>
                    ) : null)}
                  </div>
                </div>
              ))}
            </Card>
          ))}

          {/* Extensions */}
          {result.extensions && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>🔗 Extensiones de anuncio</div>
              {result.extensions.sitelinks?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 8 }}>SITELINKS</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                    {result.extensions.sitelinks.map((sl: any, i: number) => (
                      <div key={i} style={{ background: C.surface, borderRadius: 7, padding: '10px 12px' }}>
                        <div style={{ fontSize: 13, color: '#818cf8', fontWeight: 600 }}>{sl.text}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{sl.desc1}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{sl.desc2}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.extensions.callouts?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 8 }}>CALLOUTS</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {result.extensions.callouts.map((c: string, i: number) => (
                      <span key={i} style={{ padding: '4px 12px', borderRadius: 20, background: '#6366f118', color: '#818cf8', fontSize: 12, fontWeight: 600 }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Negatives + Tips */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {result.negative_keywords?.length > 0 && (
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>🚫 Keywords negativas</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {result.negative_keywords.map((kw: string, i: number) => (
                    <span key={i} style={{ padding: '4px 12px', borderRadius: 20, background: '#ef444418', color: '#fca5a5', fontSize: 12 }}>-{kw}</span>
                  ))}
                </div>
              </Card>
            )}
            {result.tips?.length > 0 && (
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>💡 Tips de optimización</div>
                {result.tips.map((t: string, i: number) => (
                  <div key={i} style={{ fontSize: 13, color: C.text, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                    → {t}
                  </div>
                ))}
              </Card>
            )}
          </div>
        </>
      )}

      {/* Meta Ads result */}
      {result && platform === 'meta' && (
        <>
          <Card>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{result.campaign?.name}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{result.campaign?.budget_recommendation}</div>
          </Card>

          {result.audiences?.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>👥 Audiencias</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {result.audiences.map((a: any, i: number) => (
                  <div key={i} style={{ background: C.surface, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', marginBottom: 8 }}>{a.name}</div>
                    {a.age && <div style={{ fontSize: 12, color: C.muted }}>Edad: {a.age} · {a.gender}</div>}
                    {a.location && <div style={{ fontSize: 12, color: C.muted }}>Ubicación: {a.location}</div>}
                    {a.interests?.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {a.interests.map((int: string, ii: number) => (
                          <span key={ii} style={{ padding: '2px 8px', borderRadius: 20, background: '#3b82f618', color: '#93c5fd', fontSize: 11 }}>{int}</span>
                        ))}
                      </div>
                    )}
                    {a.type && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{a.type} · Base: {a.base}</div>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {result.creatives?.map((cr: any, i: number) => (
            <Card key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Badge label={cr.format?.replace('_', ' ').toUpperCase()} color='#6366f1' />
                {cr.duracion && <span style={{ fontSize: 12, color: C.muted }}>{cr.duracion}</span>}
              </div>
              {cr.headline && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>HEADLINE</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{cr.headline}</div>
                </div>
              )}
              {cr.primary_text && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>TEXTO PRINCIPAL</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{cr.primary_text}</div>
                </div>
              )}
              {cr.copy_largo && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>COPY COMPLETO</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{cr.copy_largo}</div>
                  <CopyBtn text={cr.copy_largo} />
                </div>
              )}
              {cr.guion && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>GUION DE VIDEO</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: C.surface, padding: '12px 14px', borderRadius: 8 }}>{cr.guion}</div>
                </div>
              )}
              {cr.image_suggestion && (
                <div style={{ padding: '8px 12px', background: '#10b98118', borderRadius: 7 }}>
                  <span style={{ fontSize: 12, color: C.green }}>📸 {cr.image_suggestion}</span>
                </div>
              )}
              {cr.cards?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {cr.cards.map((card: any, ci: number) => (
                    <div key={ci} style={{ background: C.surface, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{card.title}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{card.desc}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: C.muted }}>CTA:</span>
                <Badge label={cr.cta_button || 'Ver más'} color={C.green} />
              </div>
            </Card>
          ))}

          {result.tips?.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>💡 Tips Meta Ads</div>
              {result.tips.map((t: string, i: number) => (
                <div key={i} style={{ fontSize: 13, color: C.text, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>→ {t}</div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
