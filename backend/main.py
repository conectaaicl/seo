from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from urllib.parse import urlparse
import httpx, re, os, json, hashlib, time, contextvars

from bs4 import BeautifulSoup
from sqlalchemy import text
from database import Base, engine, SessionLocal, Setting, User, Tenant, CrawlJob
from auth_helpers import hash_password, decode_token
from auth_router import router as auth_router
from admin_router import router as admin_router
from google_router import router as google_router
from rank_router import router as rank_router
from crawler_router import router as crawler_router
from analytics_router import router as analytics_router

# Per-request effective API keys (set by auth middleware based on tenant config)
_ctx_groq_key: contextvars.ContextVar[str] = contextvars.ContextVar('groq_key', default='')
_ctx_pagespeed_key: contextvars.ContextVar[str] = contextvars.ContextVar('pagespeed_key', default='')

app = FastAPI(title="SEO/SEM UltraPRO API", version="3.0.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    # Public paths
    if (request.method == "OPTIONS"
            or path.startswith("/auth/")
            or path == "/api/health"
            or path == "/docs"
            or path == "/openapi.json"
            or path == "/redoc"):
        return await call_next(request)
    # Protected paths
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return JSONResponse({"detail": "No autenticado"}, status_code=401)
    try:
        payload = decode_token(auth[7:])
        user_id = payload.get("sub", "")
        # Resolve effective API keys: tenant-own → global fallback
        db = SessionLocal()
        try:
            tenant = db.query(Tenant).filter(Tenant.user_id == user_id).first()
            _ctx_groq_key.set(
                (tenant.groq_api_key if tenant and tenant.groq_api_key else None)
                or os.getenv("GROQ_API_KEY", "")
            )
            _ctx_pagespeed_key.set(
                (tenant.pagespeed_api_key if tenant and tenant.pagespeed_api_key else None)
                or os.getenv("PAGESPEED_API_KEY", "")
            )
        finally:
            db.close()
    except Exception:
        return JSONResponse({"detail": "Token inválido o expirado"}, status_code=401)
    return await call_next(request)


@app.on_event("startup")
async def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # SQLite migrations FIRST — add new columns safely
        for stmt in [
            "ALTER TABLE tenants ADD COLUMN groq_api_key TEXT DEFAULT ''",
            "ALTER TABLE tenants ADD COLUMN pagespeed_api_key TEXT DEFAULT ''",
            "ALTER TABLE tenants ADD COLUMN google_refresh_token TEXT DEFAULT ''",
            "ALTER TABLE users ADD COLUMN google_refresh_token TEXT DEFAULT ''",
            "ALTER TABLE users ADD COLUMN ga4_refresh_token TEXT DEFAULT ''",
        ]:
            try:
                db.execute(text(stmt)); db.commit()
            except Exception:
                db.rollback()
        # Create default admin
        if db.query(User).count() == 0:
            db.add(User(
                email="corp.conectaai@cmail.com",
                name="Admin ConectaAI",
                password_hash=hash_password("ConectaAI2026"),
                role="admin",
            ))
            db.commit()
        # Load settings from DB into env
        for s in db.query(Setting).all():
            if s.value:
                os.environ[s.key] = s.value
    finally:
        db.close()


app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(google_router)
app.include_router(rank_router)
app.include_router(crawler_router)
app.include_router(analytics_router)

GROQ_MODEL = "llama-3.1-8b-instant"

# Simple in-memory cache (resets on restart)
_cache: dict = {}

def cache_get(key: str):
    v = _cache.get(key)
    if v and time.time() - v["ts"] < 3600:
        return v["data"]
    return None

def cache_set(key: str, data):
    _cache[key] = {"ts": time.time(), "data": data}


async def groq(prompt: str, system: str = "Eres un arquitecto senior de SEO y SEM con 15 anos de experiencia en Google, Meta Ads y marketing digital para Latinoamerica. Responde siempre en espanol.", max_tokens: int = 2000) -> str:
    key = _ctx_groq_key.get() or os.getenv("GROQ_API_KEY", "")
    if not key:
        raise HTTPException(400, "GROQ_API_KEY no configurada. Agrega tu clave en Panel Admin → Configuración.")
    async with httpx.AsyncClient(timeout=40) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": GROQ_MODEL, "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ], "max_tokens": max_tokens, "temperature": 0.7}
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


def xjson(text: str):
    for pattern in [r'\{[\s\S]+\}', r'\[[\s\S]+\]']:
        m = re.search(pattern, text)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return None


# ── Models ──────────────────────────────────────────────────────────────────
class URLReq(BaseModel):
    url: str

class KeywordReq(BaseModel):
    topic: str
    industry: str = ""
    location: str = "Chile"
    count: int = 20

class MetaReq(BaseModel):
    topic: str
    keyword: str
    business: str = ""
    tone: str = "profesional"

class BlogReq(BaseModel):
    topic: str
    keyword: str
    business: str = ""
    length: str = "medium"
    tone: str = "informativo"

class AdsReq(BaseModel):
    product: str
    keyword: str
    url: str = ""
    business: str = ""
    budget: str = ""
    objective: str = "conversiones"

class FichaReq(BaseModel):
    producto: str
    keyword: str
    business: str
    descripcion: str = ""
    precio: str = ""

class LandingReq(BaseModel):
    business: str
    keyword: str
    product: str
    cta: str = "Cotiza gratis"
    color: str = "#2563eb"

class SchemaReq(BaseModel):
    type: str  # product, article, faq, localbusiness, service
    data: dict

class CalendarReq(BaseModel):
    business: str
    industry: str
    months: int = 1
    posts_per_week: int = 2

class ReportReq(BaseModel):
    audit_url: str
    business: str
    include_keywords: bool = True
    include_competitors: List[str] = []


# ── SEO AUDIT (Ultra) ─────────────────────────────────────────────────────────
@app.post("/api/audit")
async def audit_url(req: URLReq):
    url = req.url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    cache_key = f"audit_{hashlib.md5(url.encode()).hexdigest()}"
    if c := cache_get(cache_key):
        return c

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True,
                                     headers={"User-Agent": "Mozilla/5.0 (compatible; SEOBot/2.0)"}) as client:
            r = await client.get(url)
            html = r.text
            status = r.status_code
            headers = dict(r.headers)
    except Exception as e:
        raise HTTPException(400, f"No se pudo acceder a la URL: {e}")

    soup = BeautifulSoup(html, "html.parser")
    issues = []
    score = 100

    def add(t, field, msg):
        issues.append({"type": t, "field": field, "msg": msg})

    # --- Title ---
    title_tag = soup.find("title")
    title = title_tag.text.strip() if title_tag else ""
    if not title:
        add("error", "Titulo", "Sin etiqueta <title>"); score -= 15
    elif len(title) < 30:
        add("warning", "Titulo", f"Titulo corto ({len(title)} chars, ideal 50-60)"); score -= 5
    elif len(title) > 65:
        add("warning", "Titulo", f"Titulo muy largo ({len(title)} chars, max 60)"); score -= 5
    else:
        add("ok", "Titulo", f"OK ({len(title)} chars): \"{title[:50]}\"")

    # --- Meta desc ---
    meta_desc_tag = soup.find("meta", attrs={"name": "description"})
    desc = meta_desc_tag["content"].strip() if meta_desc_tag and meta_desc_tag.get("content") else ""
    if not desc:
        add("error", "Meta descripcion", "Sin meta descripcion"); score -= 15
    elif len(desc) < 70:
        add("warning", "Meta descripcion", f"Muy corta ({len(desc)} chars)"); score -= 5
    elif len(desc) > 165:
        add("warning", "Meta descripcion", f"Muy larga ({len(desc)} chars, max 160)"); score -= 3
    else:
        add("ok", "Meta descripcion", f"OK ({len(desc)} chars)")

    # --- H1 ---
    h1s = soup.find_all("h1")
    if not h1s:
        add("error", "H1", "Sin etiqueta H1"); score -= 10
    elif len(h1s) > 1:
        add("warning", "H1", f"Multiples H1 ({len(h1s)}) — solo debe haber 1"); score -= 5
    else:
        add("ok", "H1", f"\"{h1s[0].text.strip()[:60]}\"")

    # --- H2/H3 ---
    h2s = soup.find_all("h2")
    h3s = soup.find_all("h3")
    if len(h2s) == 0:
        add("warning", "Estructura de encabezados", "Sin H2 — Google premia buena estructura"); score -= 5
    else:
        add("ok", "Estructura de encabezados", f"{len(h1s)} H1 / {len(h2s)} H2 / {len(h3s)} H3")

    # --- Images ---
    imgs = soup.find_all("img")
    no_alt = [i for i in imgs if not i.get("alt")]
    if no_alt:
        add("warning", "Imagenes alt", f"{len(no_alt)}/{len(imgs)} imagenes sin atributo alt"); score -= min(10, len(no_alt) * 2)
    elif imgs:
        add("ok", "Imagenes alt", f"Todas las imagenes tienen alt ({len(imgs)})")
    else:
        add("warning", "Imagenes alt", "Sin imagenes en la pagina")

    # --- Canonical ---
    canonical = soup.find("link", attrs={"rel": "canonical"})
    if canonical:
        add("ok", "Canonical", f"Configurado: {canonical.get('href', '')[:60]}")
    else:
        add("warning", "Canonical", "Sin canonical — puede causar contenido duplicado"); score -= 5

    # --- OG Tags ---
    og = {k: soup.find("meta", attrs={"property": f"og:{k}"}) for k in ["title", "description", "image", "type"]}
    og_ok = sum(1 for v in og.values() if v)
    if og_ok == 4:
        add("ok", "Open Graph", "OG completo — perfecto para compartir en redes")
    elif og_ok > 0:
        add("warning", "Open Graph", f"OG incompleto ({og_ok}/4 tags)"); score -= 5
    else:
        add("warning", "Open Graph", "Sin tags Open Graph"); score -= 8

    # --- Twitter Cards ---
    tw = soup.find("meta", attrs={"name": "twitter:card"})
    if tw:
        add("ok", "Twitter/X Cards", f"Card: {tw.get('content', '')}")
    else:
        add("warning", "Twitter/X Cards", "Sin Twitter Cards")

    # --- Schema.org ---
    schema_tags = soup.find_all("script", attrs={"type": "application/ld+json"})
    if schema_tags:
        types = []
        for s in schema_tags:
            try:
                d = json.loads(s.string or "")
                types.append(d.get("@type", "?"))
            except Exception:
                pass
        add("ok", "Schema.org", f"Datos estructurados: {', '.join(types)}")
    else:
        add("warning", "Schema.org", "Sin Schema.org — perdiendo rich snippets en Google"); score -= 8

    # --- Content ---
    text = soup.get_text(separator=" ", strip=True)
    words = len(re.findall(r"\w+", text))
    if words < 300:
        add("warning", "Contenido", f"Muy escaso ({words} palabras, min 300)"); score -= 8
    elif words > 1500:
        add("ok", "Contenido", f"Contenido rico ({words} palabras) — excelente para SEO")
    else:
        add("ok", "Contenido", f"{words} palabras")

    # --- HTTPS ---
    if url.startswith("https://"):
        add("ok", "HTTPS", "HTTPS activo — factor de ranking de Google")
    else:
        add("error", "HTTPS", "Sin HTTPS — Google penaliza sitios sin SSL"); score -= 10

    # --- Links ---
    links = soup.find_all("a", href=True)
    ext_links = [l for l in links if l["href"].startswith("http") and urlparse(l["href"]).netloc != urlparse(url).netloc]
    int_links = [l for l in links if not l["href"].startswith("http") or urlparse(l["href"]).netloc == urlparse(url).netloc]
    add("ok", "Enlazado interno", f"{len(int_links)} internos / {len(ext_links)} externos")

    # --- Viewport ---
    vp = soup.find("meta", attrs={"name": "viewport"})
    if vp:
        add("ok", "Mobile/Viewport", "Viewport configurado para movil")
    else:
        add("error", "Mobile/Viewport", "Sin viewport — el sitio no es mobile-friendly"); score -= 10

    # --- Content-Security headers ---
    x_frame = headers.get("x-frame-options", "")
    if x_frame:
        add("ok", "Seguridad HTTP", f"X-Frame-Options: {x_frame}")
    else:
        add("warning", "Seguridad HTTP", "Sin headers de seguridad (X-Frame-Options)")

    score = max(0, min(100, score))

    # Grade
    if score >= 90:
        grade, grade_color = "A", "#22c55e"
    elif score >= 75:
        grade, grade_color = "B", "#84cc16"
    elif score >= 60:
        grade, grade_color = "C", "#eab308"
    elif score >= 45:
        grade, grade_color = "D", "#f97316"
    else:
        grade, grade_color = "F", "#ef4444"

    result = {
        "url": url, "status": status, "score": score, "grade": grade, "grade_color": grade_color,
        "title": title, "meta_desc": desc,
        "h1": h1s[0].text.strip() if h1s else "",
        "h2_count": len(h2s), "h3_count": len(h3s),
        "word_count": words, "img_count": len(imgs),
        "int_links": len(int_links), "ext_links": len(ext_links),
        "has_schema": bool(schema_tags), "has_canonical": bool(canonical),
        "has_og": og_ok > 0, "is_https": url.startswith("https://"),
        "issues": issues,
        "errors": len([i for i in issues if i["type"] == "error"]),
        "warnings": len([i for i in issues if i["type"] == "warning"]),
        "passed": len([i for i in issues if i["type"] == "ok"]),
    }
    cache_set(cache_key, result)
    return result


# ── PageSpeed / Core Web Vitals ───────────────────────────────────────────────
@app.post("/api/pagespeed")
async def pagespeed(req: URLReq):
    url = req.url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    key = _ctx_pagespeed_key.get() or os.getenv("PAGESPEED_API_KEY", "")
    api_url = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={url}&strategy=mobile"
    if key:
        api_url += f"&key={key}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(api_url)
            data = r.json()
    except Exception as e:
        raise HTTPException(400, f"Error PageSpeed: {e}")

    if "error" in data:
        code = data["error"].get("code", 0)
        msg = data["error"].get("message", "Error desconocido")
        if code == 429:
            raise HTTPException(429, "Cuota de Google PageSpeed agotada. Configura una API Key propia en Panel Admin → Configuración → API Keys (console.cloud.google.com → PageSpeed Insights API)")
        raise HTTPException(400, f"Google PageSpeed: {msg}")

    cats = data.get("lighthouseResult", {}).get("categories", {})
    audits = data.get("lighthouseResult", {}).get("audits", {})

    def score(key):
        v = cats.get(key, {}).get("score")
        return round(v * 100) if v is not None else None

    def audit_val(key):
        a = audits.get(key, {})
        return {
            "title": a.get("title", ""),
            "score": round(a.get("score", 0) * 100) if a.get("score") is not None else None,
            "displayValue": a.get("displayValue", ""),
        }

    return {
        "url": url,
        "scores": {
            "performance": score("performance"),
            "accessibility": score("accessibility"),
            "best_practices": score("best-practices"),
            "seo": score("seo"),
        },
        "metrics": {
            "fcp": audit_val("first-contentful-paint"),
            "lcp": audit_val("largest-contentful-paint"),
            "tbt": audit_val("total-blocking-time"),
            "cls": audit_val("cumulative-layout-shift"),
            "si": audit_val("speed-index"),
            "tti": audit_val("interactive"),
        },
        "opportunities": [
            {"title": audits[k]["title"], "savings": audits[k].get("displayValue", "")}
            for k in ["render-blocking-resources", "uses-optimized-images",
                      "uses-text-compression", "uses-long-cache-ttl",
                      "efficient-animated-content", "unused-javascript",
                      "unused-css-rules"]
            if k in audits and audits[k].get("score", 1) < 0.9
        ]
    }


# ── Keyword Research ──────────────────────────────────────────────────────────
@app.post("/api/keywords")
async def keyword_research(req: KeywordReq):
    prompt = f"""Eres el mejor especialista en keyword research de Google para {req.location}.
Tema: "{req.topic}" | Industria: {req.industry or "General"}

Devuelve SOLO JSON valido:
{{
  "primary": [{{"keyword":"...", "volume":1200, "difficulty":35, "intent":"Comercial", "cpc":"0.80", "trend":"up"}}],
  "secondary": [{{"keyword":"...", "volume":450, "difficulty":22, "intent":"Informacional", "cpc":"0.40", "trend":"stable"}}],
  "longtail": [{{"keyword":"...", "volume":90, "difficulty":12, "intent":"Transaccional", "cpc":"1.20", "trend":"up"}}],
  "questions": [{{"question":"...", "volume":300, "intent":"Informacional"}}],
  "negative": ["palabra1", "palabra2"],
  "insights": "Analisis breve del mercado y oportunidades SEO"
}}
primary: 5 | secondary: 8 | longtail: 6 | questions: 5 | negative: 5
volume=mensual estimado, difficulty=0-100, trend=up/stable/down, cpc=USD"""

    result = await groq(prompt, max_tokens=2500)
    data = xjson(result)
    return data if data else {"raw": result}


# ── Meta Tags Generator ───────────────────────────────────────────────────────
@app.post("/api/generate/meta")
async def generate_meta(req: MetaReq):
    prompt = f"""Genera 3 variaciones de titulo SEO + meta descripcion + slug para:
Tema: {req.topic} | Keyword: {req.keyword} | Negocio: {req.business or "empresa chilena"} | Tono: {req.tone}

SOLO JSON:
{{
  "variations": [
    {{"title":"...", "meta":"...", "slug":"url-amigable", "focus":"...explicacion breve de la estrategia"}},
    {{"title":"...", "meta":"...", "slug":"...", "focus":"..."}},
    {{"title":"...", "meta":"...", "slug":"...", "focus":"..."}}
  ],
  "tips": ["consejo SEO 1", "consejo SEO 2"]
}}
Titulo: max 60 chars con keyword al inicio
Meta: 150-160 chars con keyword + CTA + location si aplica
Slug: en minusculas con guiones"""

    result = await groq(prompt)
    data = xjson(result)
    if data and "variations" in data:
        for v in data["variations"]:
            v["chars_title"] = len(v.get("title", ""))
            v["chars_meta"] = len(v.get("meta", ""))
        return data
    return {"raw": result}


# ── Blog Post Generator ───────────────────────────────────────────────────────
@app.post("/api/generate/blog")
async def generate_blog(req: BlogReq):
    length_map = {"short": "600-800", "medium": "1000-1400", "long": "1800-2400"}
    words_target = length_map.get(req.length, "1000-1400")
    prompt = f"""Escribe articulo de blog SEO-optimizado para {req.business or "empresa chilena"}:
Tema: {req.topic} | Keyword principal: {req.keyword} | Largo: {words_target} palabras | Tono: {req.tone}

SOLO JSON:
{{
  "title": "titulo H1 con keyword al inicio",
  "meta": "meta descripcion 150-160 chars",
  "slug": "url-amigable",
  "reading_time": "X min",
  "content": "contenido completo en markdown",
  "keywords_used": ["keyword1", "keyword2"],
  "internal_link_suggestions": ["tema para enlazar 1", "tema para enlazar 2"],
  "cta": "llamada a accion sugerida"
}}

Estructura del content:
# [H1 con keyword]
[Intro 100-150 palabras, hook + keyword natural]
## [H2 - primera seccion]
[contenido...]
## [H2 - segunda seccion]
...
## Preguntas Frecuentes
[FAQ section]
## Conclusion
[CTA claro]"""

    result = await groq(prompt, max_tokens=3000)
    data = xjson(result)
    if data:
        return data
    return {"title": req.topic, "meta": "", "slug": "", "content": result}


# ── Google Ads / SEM Generator ────────────────────────────────────────────────
@app.post("/api/generate/ads")
async def generate_ads(req: AdsReq):
    prompt = f"""Eres un experto certificado en Google Ads con 10 anos de experiencia.
Crea campana Search completa para:
Producto/Servicio: {req.product} | Keyword principal: {req.keyword}
URL: {req.url or "tuempresa.cl"} | Negocio: {req.business or "empresa Chile"}
Presupuesto: {req.budget or "flexible"} | Objetivo: {req.objective}

SOLO JSON:
{{
  "campaign_name": "...",
  "ad_groups": [
    {{
      "name": "Grupo 1 - nombre descriptivo",
      "keywords_exact": ["[keyword exacta]"],
      "keywords_phrase": ["\"keyword frase\""],
      "keywords_broad": ["+keyword +broad"],
      "ads": [
        {{
          "headline_1": "max 30 chars",
          "headline_2": "max 30 chars",
          "headline_3": "max 30 chars",
          "headline_4": "max 30 chars",
          "headline_5": "max 30 chars",
          "desc_1": "max 90 chars con CTA",
          "desc_2": "max 90 chars con beneficio clave",
          "display_url": "tuempresa.cl/producto",
          "final_url": "{req.url or 'tuempresa.cl'}"
        }}
      ]
    }},
    {{
      "name": "Grupo 2 - variacion",
      "keywords_exact": ["[variacion exacta]"],
      "keywords_phrase": ["\"variacion frase\""],
      "keywords_broad": ["+variacion"],
      "ads": [{{"headline_1":"...","headline_2":"...","headline_3":"...","headline_4":"...","headline_5":"...","desc_1":"...","desc_2":"...","display_url":"...","final_url":"{req.url or 'tuempresa.cl'}"}}]
    }}
  ],
  "extensions": {{
    "sitelinks": [{{"text":"max 25 chars","desc1":"max 35 chars","desc2":"max 35 chars","url":"..."}}],
    "callouts": ["max 25 chars cada uno"],
    "structured_snippets": [{{"header":"Servicios","values":["...","..."]}}],
    "call": "+56 9 XXXX XXXX"
  }},
  "negative_keywords": ["palabra negativa 1","palabra negativa 2"],
  "bid_strategy": "...",
  "estimated_cpc": "USD X.XX",
  "tips": ["consejo de optimizacion 1", "consejo 2"]
}}
CRITICO: respetar limites de Google Ads al pie de la letra"""

    result = await groq(prompt, max_tokens=3000)
    data = xjson(result)
    return data if data else {"raw": result}


# ── Meta Ads Generator ────────────────────────────────────────────────────────
@app.post("/api/generate/meta-ads")
async def generate_meta_ads(req: AdsReq):
    prompt = f"""Eres experto certificado en Meta Ads (Facebook + Instagram).
Crea campana completa para:
Producto: {req.product} | Negocio: {req.business or "empresa"} | Objetivo: {req.objective}
Keyword/tema: {req.keyword} | URL: {req.url or "tuempresa.cl"}

SOLO JSON:
{{
  "campaign": {{
    "name": "...",
    "objective": "{req.objective}",
    "budget_recommendation": "..."
  }},
  "audiences": [
    {{
      "name": "Audiencia Principal",
      "age": "25-45",
      "gender": "Todos",
      "interests": ["interes1", "interes2"],
      "behaviors": ["comportamiento1"],
      "location": "Chile",
      "custom_audience": "..."
    }},
    {{
      "name": "Lookalike / Retargeting",
      "type": "Lookalike 1%",
      "base": "...",
      "location": "Chile"
    }}
  ],
  "creatives": [
    {{
      "format": "imagen_unica",
      "headline": "max 40 chars",
      "primary_text": "texto principal hasta 125 chars",
      "description": "max 30 chars",
      "cta_button": "Cotizar Ahora",
      "copy_largo": "texto completo del anuncio...",
      "image_suggestion": "descripcion de imagen ideal"
    }},
    {{
      "format": "video_corto",
      "duracion": "15-30 segundos",
      "guion": "guion completo del video...",
      "hook": "primeros 3 segundos...",
      "headline": "...",
      "primary_text": "...",
      "cta_button": "Ver mas"
    }},
    {{
      "format": "carrusel",
      "cards": [
        {{"title":"...", "desc":"...", "url":"..."}},
        {{"title":"...", "desc":"...", "url":"..."}},
        {{"title":"...", "desc":"...", "url":"..."}}
      ],
      "primary_text": "..."
    }}
  ],
  "pixel_events": ["Lead", "Purchase", "ViewContent"],
  "tips": ["optimizacion 1", "optimizacion 2"]
}}"""

    result = await groq(prompt, max_tokens=3000)
    data = xjson(result)
    return data if data else {"raw": result}


# ── Product Ficha SEO ────────────────────────────────────────────────────────
@app.post("/api/generate/ficha")
async def generate_ficha(req: FichaReq):
    prompt = f"""Genera ficha SEO ultra-completa para producto/servicio:
Producto: {req.producto} | Keyword: {req.keyword}
Negocio: {req.business} | Descripcion: {req.descripcion or "producto premium"} | Precio ref: {req.precio or "a consultar"}

SOLO JSON:
{{
  "titulo_seo": "max 60 chars con keyword",
  "meta_descripcion": "150-160 chars con keyword y CTA",
  "h1": "titulo principal",
  "h2s": ["seccion 1", "seccion 2", "seccion 3"],
  "descripcion_corta": "100-150 chars para listados",
  "descripcion_larga": "600-800 palabras en markdown",
  "beneficios": ["beneficio 1", "beneficio 2", "beneficio 3", "beneficio 4", "beneficio 5"],
  "caracteristicas": [{{"nombre":"...", "valor":"..."}}],
  "keywords_secundarias": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "tags": ["tag1", "tag2"],
  "faq": [{{"pregunta":"...", "respuesta":"..."}}],
  "schema_product": {{
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "...",
    "description": "...",
    "brand": {{"@type": "Brand", "name": "{req.business}"}},
    "offers": {{"@type": "Offer", "priceCurrency": "CLP", "price": "0", "availability": "https://schema.org/InStock"}}
  }}
}}"""

    result = await groq(prompt, max_tokens=3000)
    data = xjson(result)
    return data if data else {"raw": result}


# ── Landing Page Generator ─────────────────────────────────────────────────────
@app.post("/api/generate/landing")
async def generate_landing(req: LandingReq):
    prompt = f"""Genera contenido completo para landing page de alta conversion:
Negocio: {req.business} | Keyword: {req.keyword} | Producto/Servicio: {req.product} | CTA: {req.cta}

SOLO JSON:
{{
  "hero": {{
    "headline": "titulo principal poderoso con keyword",
    "subheadline": "subtitulo que explica el valor",
    "cta_primary": "{req.cta}",
    "cta_secondary": "Ver ejemplos",
    "social_proof": "texto de prueba social"
  }},
  "problem": {{
    "heading": "...",
    "bullets": ["problema 1", "problema 2", "problema 3"]
  }},
  "solution": {{
    "heading": "...",
    "description": "...",
    "features": [{{"icon": "emoji", "title": "...", "desc": "..."}}]
  }},
  "benefits": [{{"title":"...", "desc":"...", "metric":"resultado medible"}}],
  "testimonials": [
    {{"name":"...", "role":"...", "text":"...", "rating":5}},
    {{"name":"...", "role":"...", "text":"...", "rating":5}}
  ],
  "faq": [{{"q":"...", "a":"..."}}],
  "cta_section": {{
    "heading": "...",
    "subtext": "...",
    "cta": "{req.cta}",
    "urgency": "texto de urgencia/escasez"
  }},
  "seo": {{
    "title": "...",
    "meta": "...",
    "h1": "..."
  }}
}}"""

    result = await groq(prompt, max_tokens=3000)
    data = xjson(result)
    return data if data else {"raw": result}


# ── Schema.org Generator ───────────────────────────────────────────────────────
@app.post("/api/generate/schema")
async def generate_schema(req: SchemaReq):
    schema_templates = {
        "localbusiness": {"@context": "https://schema.org", "@type": "LocalBusiness"},
        "product": {"@context": "https://schema.org", "@type": "Product"},
        "article": {"@context": "https://schema.org", "@type": "Article"},
        "faq": {"@context": "https://schema.org", "@type": "FAQPage"},
        "service": {"@context": "https://schema.org", "@type": "Service"},
        "review": {"@context": "https://schema.org", "@type": "Review"},
        "breadcrumb": {"@context": "https://schema.org", "@type": "BreadcrumbList"},
    }

    schema_type = req.type.lower()
    prompt = f"""Genera Schema.org JSON-LD completo tipo "{req.type}" para:
{json.dumps(req.data, ensure_ascii=False)}

Devuelve SOLO el JSON-LD valido de Schema.org, listo para pegar en <script type="application/ld+json">
Incluye todos los campos recomendados por Google para este tipo."""

    result = await groq(prompt)
    data = xjson(result)
    if data:
        return {"schema": data, "script_tag": f'<script type="application/ld+json">\n{json.dumps(data, indent=2, ensure_ascii=False)}\n</script>'}
    return {"raw": result}


# ── Content Calendar ───────────────────────────────────────────────────────────
@app.post("/api/generate/calendar")
async def generate_calendar(req: CalendarReq):
    total_posts = req.posts_per_week * 4 * req.months
    prompt = f"""Crea calendario editorial SEO para {req.months} mes(es):
Negocio: {req.business} | Industria: {req.industry} | Posts/semana: {req.posts_per_week} (total: {total_posts})

SOLO JSON:
{{
  "strategy": "descripcion breve de la estrategia de contenido",
  "monthly_themes": [{{"month": 1, "theme": "...", "focus_keyword": "..."}}],
  "posts": [
    {{
      "week": 1,
      "day": "Lunes",
      "title": "titulo del articulo",
      "keyword": "keyword principal",
      "intent": "Informacional|Comercial|Transaccional",
      "format": "articulo|guia|listado|comparativa|tutorial|caso_estudio",
      "word_count": 1200,
      "channels": ["blog", "linkedin", "instagram"],
      "priority": "alta|media|baja"
    }}
  ],
  "pillar_pages": ["pagina pilar 1", "pagina pilar 2"],
  "quick_wins": ["oportunidad rapida 1", "oportunidad rapida 2"]
}}
Genera exactamente {total_posts} posts variados en formato y tipo."""

    result = await groq(prompt, max_tokens=3000)
    data = xjson(result)
    return data if data else {"raw": result}


# ── Competitor Analysis ────────────────────────────────────────────────────────
@app.post("/api/competitor")
async def analyze_competitor(req: URLReq):
    url = req.url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True,
                                     headers={"User-Agent": "Mozilla/5.0 (compatible; SEOBot/2.0)"}) as client:
            r = await client.get(url)
            html = r.text
    except Exception as e:
        raise HTTPException(400, f"No se pudo acceder: {e}")

    soup = BeautifulSoup(html, "html.parser")
    title = soup.find("title")
    meta = soup.find("meta", attrs={"name": "description"})
    h1s = [h.text.strip() for h in soup.find_all("h1")][:3]
    h2s = [h.text.strip() for h in soup.find_all("h2")][:8]
    text = soup.get_text(separator=" ", strip=True)
    words = len(re.findall(r"\w+", text))
    links = len(soup.find_all("a", href=True))
    imgs = len(soup.find_all("img"))
    schema_count = len(soup.find_all("script", attrs={"type": "application/ld+json"}))

    prompt = f"""Analiza este competidor como experto SEO senior:
URL: {url}
Titulo: {title.text.strip() if title else "N/A"}
Meta: {meta["content"][:200] if meta and meta.get("content") else "N/A"}
H1: {", ".join(h1s) or "N/A"}
H2s: {", ".join(h2s[:5]) or "N/A"}
Palabras: {words} | Links: {links} | Imagenes: {imgs} | Schema: {schema_count}

SOLO JSON:
{{
  "score_estimado": 72,
  "fortalezas": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "debilidades": ["debilidad 1", "debilidad 2", "debilidad 3"],
  "oportunidades": ["oportunidad para superarlos 1", "oportunidad 2"],
  "keywords_detectadas": ["keyword 1", "keyword 2", "keyword 3"],
  "estrategia": "descripcion de su estrategia SEO aparente",
  "como_superarlos": ["accion concreta 1", "accion concreta 2", "accion concreta 3"],
  "tiempo_estimado": "3-6 meses"
}}"""

    analysis = await groq(prompt)
    ai_data = xjson(analysis) or {}

    return {
        "url": url,
        "title": title.text.strip() if title else "",
        "meta": meta["content"][:160] if meta and meta.get("content") else "",
        "h1s": h1s, "h2s": h2s,
        "word_count": words, "link_count": links,
        "img_count": imgs, "schema_count": schema_count,
        "has_https": url.startswith("https://"),
        **ai_data,
    }


# ── Full SEO Report ────────────────────────────────────────────────────────────
@app.post("/api/report")
async def generate_report(req: ReportReq):
    url = req.audit_url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    # Run audit
    audit_result = await audit_url(URLReq(url=url))

    # AI recommendations
    prompt = f"""Eres consultor SEO senior creando informe profesional para cliente.
Negocio: {req.business}
URL: {url}
Score SEO: {audit_result["score"]}/100 (Grade: {audit_result["grade"]})
Errores: {audit_result["errors"]} | Warnings: {audit_result["warnings"]} | OK: {audit_result["passed"]}
Titulo actual: {audit_result["title"]}
Meta actual: {audit_result["meta_desc"]}

SOLO JSON:
{{
  "executive_summary": "resumen ejecutivo de 2-3 parrafos",
  "priority_actions": [
    {{"priority": "ALTA", "action": "...", "impact": "...", "timeframe": "1-2 semanas"}},
    {{"priority": "MEDIA", "action": "...", "impact": "...", "timeframe": "1 mes"}},
    {{"priority": "BAJA", "action": "...", "impact": "...", "timeframe": "3 meses"}}
  ],
  "quick_wins": ["victoria rapida 1", "victoria rapida 2"],
  "monthly_roadmap": [
    {{"month": "Mes 1", "focus": "...", "tasks": ["tarea 1", "tarea 2"]}},
    {{"month": "Mes 2", "focus": "...", "tasks": ["tarea 1", "tarea 2"]}},
    {{"month": "Mes 3", "focus": "...", "tasks": ["tarea 1", "tarea 2"]}}
  ],
  "expected_results": "resultados esperados en 90 dias"
}}"""

    ai_result = await groq(prompt)
    recommendations = xjson(ai_result) or {}

    return {
        "business": req.business,
        "generated_at": time.strftime("%Y-%m-%d %H:%M"),
        "audit": audit_result,
        "recommendations": recommendations,
    }


# ── Audit Fix Suggestions ──────────────────────────────────────────────────────
class AuditFixReq(BaseModel):
    url: str
    score: int
    issues: list

@app.post("/api/audit/fix")
async def audit_fix(req: AuditFixReq):
    errors   = [i for i in req.issues if i.get("type") == "error"]
    warnings = [i for i in req.issues if i.get("type") == "warning"]
    issues_text = "\n".join(
        [f"❌ ERROR — {i['field']}: {i['msg']}" for i in errors] +
        [f"⚠ ADVERTENCIA — {i['field']}: {i['msg']}" for i in warnings]
    )
    prompt = f"""Eres consultor SEO técnico experto. El sitio {req.url} tiene score {req.score}/100.

PROBLEMAS DETECTADOS:
{issues_text}

Crea un plan de reparación concreto. SOLO JSON:
{{
  "summary": "resumen ejecutivo en 2 oraciones con el estado actual y potencial de mejora",
  "score_potencial": 92,
  "fixes": [
    {{
      "titulo": "nombre corto del problema",
      "prioridad": "ALTA",
      "campo": "nombre del campo afectado",
      "problema": "descripcion breve del problema",
      "solucion": "como solucionarlo en términos concretos",
      "pasos": ["paso 1 especifico", "paso 2 especifico", "paso 3 si aplica"],
      "impacto": "que mejora cuando se arregla esto",
      "tiempo": "15 minutos"
    }}
  ],
  "herramientas": ["herramienta util 1", "herramienta 2"],
  "consejo_final": "consejo estrategico extra"
}}
prioridad: ALTA (errores criticos), MEDIA (advertencias importantes), BAJA (mejoras opcionales)
Genera un fix por cada error/advertencia detectado. Sé MUY concreto en los pasos."""

    result = await groq(prompt, max_tokens=2500)
    data = xjson(result)
    return data if data else {"raw": result}


# ── Tenant own API keys (self-service) ─────────────────────────────────────────
class TenantKeysReq(BaseModel):
    groq_api_key: Optional[str] = ""
    pagespeed_api_key: Optional[str] = ""

@app.get("/api/my-keys")
def get_my_keys(request: Request):
    payload = decode_token(request.headers.get("Authorization", "")[7:])
    user_id = payload.get("sub", "")
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.user_id == user_id).first()
        if not tenant:
            return {"groq_api_key": "", "pagespeed_api_key": "", "has_tenant": False}
        gk = tenant.groq_api_key or ""
        pk = tenant.pagespeed_api_key or ""
        return {
            "has_tenant": True,
            "groq_api_key_set": bool(gk),
            "pagespeed_api_key_set": bool(pk),
            "groq_api_key_masked": (gk[:6] + "•" * (len(gk)-6)) if len(gk) > 6 else "•" * len(gk),
            "pagespeed_api_key_masked": (pk[:6] + "•" * (len(pk)-6)) if len(pk) > 6 else "•" * len(pk),
        }
    finally:
        db.close()

@app.put("/api/my-keys")
def update_my_keys(req: TenantKeysReq, request: Request):
    payload = decode_token(request.headers.get("Authorization", "")[7:])
    user_id = payload.get("sub", "")
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.user_id == user_id).first()
        if not tenant:
            raise HTTPException(404, "No tienes un perfil de tenant asociado")
        if req.groq_api_key is not None:
            tenant.groq_api_key = req.groq_api_key
        if req.pagespeed_api_key is not None:
            tenant.pagespeed_api_key = req.pagespeed_api_key
        db.commit()
        return {"ok": True}
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "groq": bool(os.getenv("GROQ_API_KEY")), "pagespeed": bool(os.getenv("PAGESPEED_API_KEY"))}
