import { useState } from 'react'
import { post } from '../api'
import { Card, Btn, Field, Select, ErrorBox, Loader, C, CopyBtn } from '../components/UI'

type Tab = 'meta' | 'blog' | 'ficha' | 'landing' | 'schema'

export default function GeneratorPage() {
  const [tab, setTab] = useState<Tab>('meta')
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'meta', label: 'Meta Tags', icon: '🏷' },
    { id: 'blog', label: 'Artículo Blog', icon: '✍' },
    { id: 'ficha', label: 'Ficha Producto', icon: '📦' },
    { id: 'landing', label: 'Landing Page', icon: '🎯' },
    { id: 'schema', label: 'Schema.org', icon: '🔧' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: tab === t.id ? 'rgba(99,102,241,0.2)' : C.surface,
            color: tab === t.id ? '#818cf8' : C.muted,
            outline: tab === t.id ? '1px solid rgba(99,102,241,0.4)' : `1px solid ${C.border}`,
          }}>{t.icon} {t.label}</button>
        ))}
      </div>
      {tab === 'meta' && <MetaGenerator />}
      {tab === 'blog' && <BlogGenerator />}
      {tab === 'ficha' && <FichaGenerator />}
      {tab === 'landing' && <LandingGenerator />}
      {tab === 'schema' && <SchemaGenerator />}
    </div>
  )
}

function MetaGenerator() {
  const [form, setForm] = useState({ topic: '', keyword: '', business: '', tone: 'profesional' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  async function run() {
    setLoading(true); setError(''); setResult(null)
    try { setResult(await post('/api/generate/meta', form)) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Generador de Meta Tags SEO</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Tema / Página *" value={form.topic} onChange={set('topic')} placeholder="Cortinas roller blackout en Chile" />
          <Field label="Keyword principal *" value={form.keyword} onChange={set('keyword')} placeholder="cortinas roller blackout" />
          <Field label="Negocio / Marca" value={form.business} onChange={set('business')} placeholder="TerraBlinds" />
          <Select label="Tono" value={form.tone} onChange={set('tone')} options={[
            { value: 'profesional', label: 'Profesional' }, { value: 'cercano', label: 'Cercano' },
            { value: 'urgente', label: 'Urgente / Oferta' }, { value: 'informativo', label: 'Informativo' },
          ]} />
        </div>
        <Btn onClick={run} loading={loading} disabled={!form.topic || !form.keyword}>✨ Generar variaciones</Btn>
      </Card>
      {error && <ErrorBox msg={error} />}
      {loading && <Loader />}
      {result?.variations && result.variations.map((v: any, i: number) => (
        <Card key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#818cf8' }}>Variación {i + 1}</span>
            {v.focus && <span style={{ fontSize: 11, color: C.muted }}>{v.focus}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Título</span>
                <span style={{ fontSize: 10, color: v.chars_title > 60 ? '#ef4444' : '#22c55e' }}>{v.chars_title}/60 chars</span>
              </div>
              <div style={{ padding: '10px 14px', background: C.surface, borderRadius: 8, fontSize: 13, color: '#93c5fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{v.title}</span><CopyBtn text={v.title} small />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Meta descripción</span>
                <span style={{ fontSize: 10, color: v.chars_meta > 160 ? '#ef4444' : '#22c55e' }}>{v.chars_meta}/160 chars</span>
              </div>
              <div style={{ padding: '10px 14px', background: C.surface, borderRadius: 8, fontSize: 13, color: C.text, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ flex: 1 }}>{v.meta}</span><CopyBtn text={v.meta} small />
              </div>
            </div>
            {v.slug && (
              <div>
                <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>URL slug: </span>
                <span style={{ fontSize: 12, color: '#a3e635', fontFamily: 'monospace' }}>/{v.slug}</span>
              </div>
            )}
          </div>
          {/* Google preview */}
          <div style={{ marginTop: 16, background: '#fff', borderRadius: 8, padding: '12px 16px', maxWidth: 560 }}>
            <div style={{ fontSize: 11, color: '#202124' }}>tudominio.cl</div>
            <div style={{ fontSize: 17, color: '#1a0dab', lineHeight: 1.3, margin: '3px 0' }}>{v.title}</div>
            <div style={{ fontSize: 12, color: '#4d5156', lineHeight: 1.5 }}>{v.meta}</div>
          </div>
        </Card>
      ))}
      {result?.tips && (
        <Card style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}>
          <div style={{ fontSize: 12, color: '#6ee7b7', fontWeight: 700, marginBottom: 10 }}>💡 Tips SEO</div>
          {result.tips.map((t: string, i: number) => (
            <div key={i} style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>• {t}</div>
          ))}
        </Card>
      )}
    </>
  )
}

function BlogGenerator() {
  const [form, setForm] = useState({ topic: '', keyword: '', business: '', length: 'medium', tone: 'informativo' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  async function run() {
    setLoading(true); setError(''); setResult(null)
    try { setResult(await post('/api/generate/blog', form)) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Generador de Artículos de Blog SEO</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Tema del artículo *" value={form.topic} onChange={set('topic')} placeholder="¿Cortinas blackout o sunscreen?" />
          <Field label="Keyword principal *" value={form.keyword} onChange={set('keyword')} placeholder="cortinas blackout Chile" />
          <Field label="Negocio / Marca" value={form.business} onChange={set('business')} placeholder="TerraBlinds" />
          <Select label="Tono" value={form.tone} onChange={set('tone')} options={[
            { value: 'informativo', label: 'Informativo' }, { value: 'conversacional', label: 'Conversacional' },
            { value: 'experto', label: 'Experto / Técnico' }, { value: 'ventas', label: 'Orientado a ventas' },
          ]} />
          <Select label="Largo" value={form.length} onChange={set('length')} options={[
            { value: 'short', label: 'Corto (600-800 palabras)' },
            { value: 'medium', label: 'Medio (1000-1400 palabras)' },
            { value: 'long', label: 'Largo (1800-2400 palabras)' },
          ]} />
        </div>
        <Btn onClick={run} loading={loading} disabled={!form.topic || !form.keyword}>✍ Generar artículo</Btn>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Genera artículo completo con H1, H2, H3, FAQ y CTA optimizados para Google</div>
      </Card>
      {error && <ErrorBox msg={error} />}
      {loading && <div style={{ padding: '40px 0' }}><Loader /></div>}
      {result && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{result.title}</div>
              {result.slug && <div style={{ fontSize: 12, color: '#a3e635', fontFamily: 'monospace', marginTop: 3 }}>/{result.slug}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {result.reading_time && <span style={{ fontSize: 11, color: C.muted }}>⏱ {result.reading_time}</span>}
              <CopyBtn text={result.content} />
            </div>
          </div>
          {result.meta && (
            <div style={{ padding: '10px 14px', background: '#3b82f620', borderRadius: 8, fontSize: 12, color: '#93c5fd', marginBottom: 16 }}>
              📋 <strong>Meta:</strong> {result.meta}
            </div>
          )}
          <pre style={{ background: C.surface, padding: 20, borderRadius: 10, fontSize: 12, color: C.text, lineHeight: 1.8, maxHeight: 600, overflowY: 'auto' }}>
            {result.content}
          </pre>
          {result.cta && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#10b98120', borderRadius: 8, fontSize: 12, color: '#6ee7b7' }}>
              📣 <strong>CTA sugerido:</strong> {result.cta}
            </div>
          )}
          {result.internal_link_suggestions?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>💡 SUGERENCIAS DE ENLACES INTERNOS</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {result.internal_link_suggestions.map((s: string, i: number) => (
                  <span key={i} style={{ padding: '4px 12px', borderRadius: 20, background: '#6366f120', color: '#818cf8', fontSize: 11 }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  )
}

function FichaGenerator() {
  const [form, setForm] = useState({ producto: '', keyword: '', business: '', descripcion: '', precio: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  async function run() {
    setLoading(true); setError(''); setResult(null)
    try { setResult(await post('/api/generate/ficha', form)) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Ficha SEO de Producto / Servicio</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Producto / Servicio *" value={form.producto} onChange={set('producto')} placeholder="Cortinas Roller Blackout" />
          <Field label="Keyword principal *" value={form.keyword} onChange={set('keyword')} placeholder="cortinas roller blackout a medida" />
          <Field label="Negocio *" value={form.business} onChange={set('business')} placeholder="TerraBlinds" />
          <Field label="Precio referencial" value={form.precio} onChange={set('precio')} placeholder="Desde $25.000 CLP" />
        </div>
        <Field label="Descripción base (opcional)" value={form.descripcion} onChange={set('descripcion')} placeholder="Descripción breve del producto..." rows={2} />
        <div style={{ marginTop: 12 }}>
          <Btn onClick={run} loading={loading} disabled={!form.producto || !form.keyword || !form.business}>📦 Generar ficha completa</Btn>
        </div>
      </Card>
      {error && <ErrorBox msg={error} />}
      {loading && <Loader />}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Meta datos</div>
            {[['Título SEO', result.titulo_seo], ['Meta descripción', result.meta_descripcion], ['H1', result.h1]].map(([label, value]) => value && (
              <div key={label as string} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
                <div style={{ padding: '10px 14px', background: C.surface, borderRadius: 8, fontSize: 13, color: C.text, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{value as string}</span><CopyBtn text={value as string} small />
                </div>
              </div>
            ))}
          </Card>
          {result.beneficios?.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Beneficios clave</div>
              {result.beneficios.map((b: string, i: number) => (
                <div key={i} style={{ padding: '8px 14px', background: '#10b98110', borderRadius: 7, marginBottom: 6, fontSize: 13, color: C.text, display: 'flex', gap: 8 }}>
                  <span style={{ color: '#10b981' }}>✓</span> {b}
                </div>
              ))}
            </Card>
          )}
          {result.faq?.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>FAQ (listo para Schema.org)</div>
              {result.faq.map((f: any, i: number) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#818cf8', marginBottom: 4 }}>❓ {f.pregunta}</div>
                  <div style={{ fontSize: 13, color: C.text, paddingLeft: 14, borderLeft: '2px solid #6366f140' }}>{f.respuesta}</div>
                </div>
              ))}
            </Card>
          )}
          {result.schema_product && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Schema.org Product (JSON-LD)</div>
                <CopyBtn text={`<script type="application/ld+json">\n${JSON.stringify(result.schema_product, null, 2)}\n</script>`} />
              </div>
              <pre style={{ background: C.surface, padding: 16, borderRadius: 8, fontSize: 11, color: '#a3e635', overflow: 'auto', maxHeight: 300 }}>
                {JSON.stringify(result.schema_product, null, 2)}
              </pre>
            </Card>
          )}
        </div>
      )}
    </>
  )
}

function LandingGenerator() {
  const [form, setForm] = useState({ business: '', keyword: '', product: '', cta: 'Cotiza gratis', color: '#6366f1' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  async function run() {
    setLoading(true); setError(''); setResult(null)
    try { setResult(await post('/api/generate/landing', form)) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Generador de Contenido Landing Page</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Negocio *" value={form.business} onChange={set('business')} placeholder="TerraBlinds" />
          <Field label="Keyword / Servicio *" value={form.keyword} onChange={set('keyword')} placeholder="cortinas roller Chile" />
          <Field label="Producto principal *" value={form.product} onChange={set('product')} placeholder="Cortinas roller a medida" />
          <Field label="CTA principal" value={form.cta} onChange={set('cta')} placeholder="Cotiza gratis" />
        </div>
        <Btn onClick={run} loading={loading} disabled={!form.business || !form.keyword || !form.product}>🎯 Generar landing completa</Btn>
      </Card>
      {error && <ErrorBox msg={error} />}
      {loading && <Loader />}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {result.hero && (
            <Card style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.3)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', marginBottom: 12 }}>🦸 HERO SECTION</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{result.hero.headline}</div>
              <div style={{ fontSize: 14, color: C.muted, marginBottom: 12 }}>{result.hero.subheadline}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ padding: '10px 20px', background: '#6366f1', color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>{result.hero.cta_primary}</span>
                <span style={{ padding: '10px 20px', border: '1px solid rgba(255,255,255,0.2)', color: C.text, borderRadius: 9, fontSize: 13 }}>{result.hero.cta_secondary}</span>
              </div>
              {result.hero.social_proof && <div style={{ marginTop: 12, fontSize: 12, color: '#a3e635' }}>✓ {result.hero.social_proof}</div>}
            </Card>
          )}
          {result.benefits?.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>💎 Beneficios / Propuesta de valor</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                {result.benefits.map((b: any, i: number) => (
                  <div key={i} style={{ padding: 16, background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{b.title}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{b.desc}</div>
                    {b.metric && <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>→ {b.metric}</div>}
                  </div>
                ))}
              </div>
            </Card>
          )}
          {result.testimonials?.length > 0 && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>⭐ Testimonios sugeridos</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {result.testimonials.map((t: any, i: number) => (
                  <div key={i} style={{ padding: 16, background: C.surface, borderRadius: 10 }}>
                    <div style={{ fontSize: 13, color: C.text, fontStyle: 'italic', marginBottom: 10 }}>"{t.text}"</div>
                    <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{t.role}</div>
                    <div style={{ color: '#f59e0b', marginTop: 4 }}>{'★'.repeat(t.rating || 5)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {result.cta_section && (
            <Card style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{result.cta_section.heading}</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{result.cta_section.subtext}</div>
              <div style={{ padding: '12px 32px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, display: 'inline-block' }}>
                {result.cta_section.cta}
              </div>
              {result.cta_section.urgency && <div style={{ marginTop: 10, fontSize: 12, color: '#f59e0b' }}>⚡ {result.cta_section.urgency}</div>}
            </Card>
          )}
        </div>
      )}
    </>
  )
}

function SchemaGenerator() {
  const [type, setType] = useState('localbusiness')
  const [fields, setFields] = useState({ name: '', description: '', url: '', address: '', phone: '', image: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const set = (k: string) => (v: string) => setFields(f => ({ ...f, [k]: v }))

  async function run() {
    setLoading(true); setError(''); setResult(null)
    try { setResult(await post('/api/generate/schema', { type, data: fields })) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Generador Schema.org (Rich Snippets Google)</div>
        <Select label="Tipo de Schema" value={type} onChange={setType} options={[
          { value: 'localbusiness', label: 'LocalBusiness — negocio local' },
          { value: 'product', label: 'Product — producto con precio' },
          { value: 'article', label: 'Article — artículo de blog' },
          { value: 'faq', label: 'FAQPage — preguntas frecuentes' },
          { value: 'service', label: 'Service — servicio profesional' },
          { value: 'review', label: 'Review — reseña' },
        ]} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <Field label="Nombre *" value={fields.name} onChange={set('name')} placeholder="TerraBlinds" />
          <Field label="URL" value={fields.url} onChange={set('url')} placeholder="https://terrablinds.cl" />
          <Field label="Teléfono" value={fields.phone} onChange={set('phone')} placeholder="+56912345678" />
          <Field label="Dirección" value={fields.address} onChange={set('address')} placeholder="Santiago, Chile" />
          <Field label="Imagen URL" value={fields.image} onChange={set('image')} placeholder="https://..." />
        </div>
        <Field label="Descripción" value={fields.description} onChange={set('description')} placeholder="Descripción del negocio..." rows={2} />
        <div style={{ marginTop: 12 }}>
          <Btn onClick={run} loading={loading} disabled={!fields.name}>🔧 Generar Schema</Btn>
        </div>
      </Card>
      {error && <ErrorBox msg={error} />}
      {loading && <Loader />}
      {result && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Schema.org JSON-LD — listo para pegar en tu web</div>
            <CopyBtn text={result.script_tag || JSON.stringify(result.schema, null, 2)} />
          </div>
          <pre style={{ background: C.surface, padding: 20, borderRadius: 10, fontSize: 12, color: '#a3e635', overflow: 'auto', maxHeight: 400 }}>
            {result.script_tag || JSON.stringify(result.schema, null, 2)}
          </pre>
        </Card>
      )}
    </>
  )
}
