from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from urllib.parse import urlparse, urljoin, urldefrag
from database import SessionLocal, CrawlJob
from auth_helpers import decode_token
import httpx, json, uuid, datetime
from bs4 import BeautifulSoup

router = APIRouter(prefix="/api/crawler", tags=["crawler"])

# ── Auth helper ───────────────────────────────────────────────────────────────

def _uid(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "No autenticado")
    return decode_token(auth[7:]).get("sub", "")


# ── Pydantic models ────────────────────────────────────────────────────────────

class StartCrawl(BaseModel):
    site_url: str
    max_pages: int = 50


# ── SEO analysis helpers ───────────────────────────────────────────────────────

def _analyse_page(url: str, status: int, html: str) -> dict:
    """Extract SEO signals from HTML and return a page result dict."""
    issues = []

    if status >= 400:
        issues.append({"type": "error", "field": "HTTP", "msg": f"Página devuelve error HTTP {status}"})
        return {
            "url": url, "status": status,
            "title": "", "title_len": 0,
            "meta_desc": "", "meta_len": 0,
            "h1": "", "canonical": "", "noindex": False,
            "issues": issues,
        }

    soup = BeautifulSoup(html, "lxml")

    # ── Title ──────────────────────────────────────────────────────────────────
    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else ""
    title_len = len(title)
    if not title:
        issues.append({"type": "error", "field": "Title", "msg": "Title ausente"})
    elif title_len < 30:
        issues.append({"type": "warning", "field": "Title", "msg": f"Title muy corto ({title_len} chars, mínimo 30)"})
    elif title_len > 60:
        issues.append({"type": "warning", "field": "Title", "msg": f"Title muy largo ({title_len} chars, máximo 60)"})
    else:
        issues.append({"type": "ok", "field": "Title", "msg": f"Title correcto ({title_len} chars)"})

    # ── Meta description ───────────────────────────────────────────────────────
    meta_tag = soup.find("meta", attrs={"name": "description"})
    meta_desc = meta_tag.get("content", "").strip() if meta_tag else ""
    meta_len = len(meta_desc)
    if not meta_desc:
        issues.append({"type": "error", "field": "Meta Desc", "msg": "Meta description ausente"})
    elif meta_len < 70:
        issues.append({"type": "warning", "field": "Meta Desc", "msg": f"Meta description corta ({meta_len} chars, mínimo 70)"})
    elif meta_len > 160:
        issues.append({"type": "warning", "field": "Meta Desc", "msg": f"Meta description larga ({meta_len} chars, máximo 160)"})
    else:
        issues.append({"type": "ok", "field": "Meta Desc", "msg": f"Meta description correcta ({meta_len} chars)"})

    # ── H1 ─────────────────────────────────────────────────────────────────────
    h1_tags = soup.find_all("h1")
    if not h1_tags:
        h1 = ""
        issues.append({"type": "error", "field": "H1", "msg": "No hay etiqueta H1"})
    elif len(h1_tags) > 1:
        h1 = h1_tags[0].get_text(strip=True)
        issues.append({"type": "warning", "field": "H1", "msg": f"Múltiples H1 ({len(h1_tags)}), debe haber solo uno"})
    else:
        h1 = h1_tags[0].get_text(strip=True)
        if not h1:
            issues.append({"type": "warning", "field": "H1", "msg": "H1 presente pero vacío"})
        else:
            issues.append({"type": "ok", "field": "H1", "msg": "H1 único y presente"})

    # ── Canonical ──────────────────────────────────────────────────────────────
    canonical_tag = soup.find("link", attrs={"rel": "canonical"})
    canonical = canonical_tag.get("href", "").strip() if canonical_tag else ""
    if not canonical:
        issues.append({"type": "warning", "field": "Canonical", "msg": "No se encontró URL canónica"})
    elif canonical != url and canonical.rstrip("/") != url.rstrip("/"):
        issues.append({"type": "warning", "field": "Canonical", "msg": f"Canonical apunta a URL diferente"})
    else:
        issues.append({"type": "ok", "field": "Canonical", "msg": "URL canónica correcta"})

    # ── Noindex ────────────────────────────────────────────────────────────────
    robots_meta = soup.find("meta", attrs={"name": "robots"})
    robots_content = robots_meta.get("content", "").lower() if robots_meta else ""
    noindex = "noindex" in robots_content
    if noindex:
        issues.append({"type": "error", "field": "Robots", "msg": "Página tiene noindex — no será indexada por Google"})
    else:
        issues.append({"type": "ok", "field": "Robots", "msg": "Indexable (sin noindex)"})

    # ── Images alt ─────────────────────────────────────────────────────────────
    imgs = soup.find_all("img")
    imgs_no_alt = [img for img in imgs if not img.get("alt", "").strip()]
    if imgs_no_alt:
        issues.append({
            "type": "warning", "field": "Imágenes",
            "msg": f"{len(imgs_no_alt)} imagen(es) sin atributo alt"
        })
    elif imgs:
        issues.append({"type": "ok", "field": "Imágenes", "msg": f"{len(imgs)} imagen(es) con alt correcto"})

    # ── H2/H3 structure ────────────────────────────────────────────────────────
    h2_count = len(soup.find_all("h2"))
    if h2_count == 0 and len(html) > 2000:
        issues.append({"type": "warning", "field": "Estructura", "msg": "Sin etiquetas H2 — estructura de contenido deficiente"})

    # ── Open Graph ─────────────────────────────────────────────────────────────
    og_title = soup.find("meta", property="og:title")
    og_desc = soup.find("meta", property="og:description")
    if not og_title or not og_desc:
        missing = []
        if not og_title: missing.append("og:title")
        if not og_desc: missing.append("og:description")
        issues.append({"type": "warning", "field": "Open Graph", "msg": f"Faltan tags OG: {', '.join(missing)}"})
    else:
        issues.append({"type": "ok", "field": "Open Graph", "msg": "og:title y og:description presentes"})

    return {
        "url": url,
        "status": status,
        "title": title,
        "title_len": title_len,
        "meta_desc": meta_desc,
        "meta_len": meta_len,
        "h1": h1,
        "canonical": canonical,
        "noindex": noindex,
        "issues": issues,
    }


def _extract_links(base_url: str, html: str, domain: str) -> list[str]:
    """Extract all same-domain links from HTML."""
    soup = BeautifulSoup(html, "lxml")
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        # Skip anchors, mailto, tel, javascript
        if (href.startswith("#") or href.startswith("mailto:")
                or href.startswith("tel:") or href.startswith("javascript:")):
            continue
        # Skip common non-HTML resources
        lower = href.lower()
        if any(lower.endswith(ext) for ext in (
            ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp",
            ".zip", ".rar", ".doc", ".docx", ".xls", ".xlsx",
            ".mp4", ".mp3", ".avi", ".mov", ".css", ".js", ".xml", ".json"
        )):
            continue
        abs_url = urljoin(base_url, href)
        # Remove fragment
        abs_url, _ = urldefrag(abs_url)
        # Remove trailing slashes for dedup but keep root slash
        parsed = urlparse(abs_url)
        if parsed.netloc != domain:
            continue
        if parsed.scheme not in ("http", "https"):
            continue
        links.append(abs_url)
    return links


# ── BFS Crawler ────────────────────────────────────────────────────────────────

async def _crawl(site_url: str, max_pages: int, job_id: str, uid: str):
    """Full BFS crawl, stores result in DB when done."""
    parsed_root = urlparse(site_url)
    domain = parsed_root.netloc

    visited: set[str] = set()
    queue: list[str] = [site_url]
    results: list[dict] = []

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; SEOUltraPROBot/1.0; "
            "+https://seo.conectaai.cl)"
        )
    }

    async with httpx.AsyncClient(
        timeout=8,
        follow_redirects=True,
        headers=headers,
        verify=False,
    ) as client:
        while queue and len(visited) < max_pages:
            url = queue.pop(0)
            # Normalise: remove trailing slash for dedup (except root)
            norm_url = url.rstrip("/") or url
            if norm_url in visited:
                continue
            visited.add(norm_url)

            try:
                resp = await client.get(url)
                status = resp.status_code
                content_type = resp.headers.get("content-type", "")
                html = ""
                if "text/html" in content_type:
                    html = resp.text
                    # Discover new links
                    if status < 400:
                        for link in _extract_links(url, html, domain):
                            nl = link.rstrip("/") or link
                            if nl not in visited and link not in queue:
                                queue.append(link)
                page_result = _analyse_page(url, status, html)
            except httpx.TimeoutException:
                page_result = {
                    "url": url, "status": 0,
                    "title": "", "title_len": 0,
                    "meta_desc": "", "meta_len": 0,
                    "h1": "", "canonical": "", "noindex": False,
                    "issues": [{"type": "error", "field": "Conexión", "msg": "Timeout — la página tardó más de 8 segundos"}],
                }
            except Exception as e:
                page_result = {
                    "url": url, "status": 0,
                    "title": "", "title_len": 0,
                    "meta_desc": "", "meta_len": 0,
                    "h1": "", "canonical": "", "noindex": False,
                    "issues": [{"type": "error", "field": "Conexión", "msg": f"Error al cargar: {str(e)[:120]}"}],
                }

            results.append(page_result)

    # Persist to DB
    db = SessionLocal()
    try:
        job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
        if job:
            job.status = "done"
            job.pages_crawled = str(len(results))
            job.results_json = json.dumps(results, ensure_ascii=False)
            db.commit()
    finally:
        db.close()


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/start")
async def start_crawl(req: StartCrawl, request: Request):
    uid = _uid(request)

    site_url = req.site_url.strip()
    if not site_url.startswith(("http://", "https://")):
        site_url = "https://" + site_url

    max_pages = max(1, min(req.max_pages, 50))

    # Create job record
    job_id = str(uuid.uuid4())
    db = SessionLocal()
    try:
        job = CrawlJob(id=job_id, user_id=uid, site_url=site_url, status="running")
        db.add(job)
        db.commit()
    finally:
        db.close()

    # Run crawl synchronously (FastAPI will await this in the event loop)
    # For production you'd use BackgroundTasks; here we run inline for simplicity
    # but wrapped so the HTTP response returns the job_id immediately.
    import asyncio
    asyncio.create_task(_crawl(site_url, max_pages, job_id, uid))

    return {"job_id": job_id, "status": "running", "site_url": site_url}


@router.get("/results/{job_id}")
async def get_results(job_id: str, request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        job = db.query(CrawlJob).filter(
            CrawlJob.id == job_id, CrawlJob.user_id == uid
        ).first()
        if not job:
            raise HTTPException(404, "Trabajo de crawl no encontrado")

        results = json.loads(job.results_json or "[]")

        # Build issues summary
        errors = warnings = ok_count = 0
        for page in results:
            for issue in page.get("issues", []):
                t = issue.get("type")
                if t == "error":
                    errors += 1
                elif t == "warning":
                    warnings += 1
                elif t == "ok":
                    ok_count += 1

        return {
            "job_id": job.id,
            "site_url": job.site_url,
            "status": job.status,
            "pages_crawled": int(job.pages_crawled or 0),
            "created_at": job.created_at.strftime("%Y-%m-%d %H:%M") if job.created_at else "",
            "issues_summary": {"errors": errors, "warnings": warnings, "ok": ok_count},
            "results": results,
        }
    finally:
        db.close()


@router.get("/history")
async def crawl_history(request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        jobs = (
            db.query(CrawlJob)
            .filter(CrawlJob.user_id == uid)
            .order_by(CrawlJob.created_at.desc())
            .limit(20)
            .all()
        )
        result = []
        for job in jobs:
            pages = json.loads(job.results_json or "[]")
            errors = sum(
                1 for p in pages for i in p.get("issues", []) if i.get("type") == "error"
            )
            warnings = sum(
                1 for p in pages for i in p.get("issues", []) if i.get("type") == "warning"
            )
            result.append({
                "job_id": job.id,
                "site_url": job.site_url,
                "status": job.status,
                "pages_crawled": int(job.pages_crawled or 0),
                "errors": errors,
                "warnings": warnings,
                "created_at": job.created_at.strftime("%Y-%m-%d %H:%M") if job.created_at else "",
            })
        return result
    finally:
        db.close()
