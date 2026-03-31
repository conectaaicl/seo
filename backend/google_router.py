from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from database import SessionLocal, Tenant
from auth_helpers import decode_token
from urllib.parse import quote
import os, httpx, datetime

router = APIRouter(tags=["gsc"])

REDIRECT_URI = "https://seo.conectaai.cl/auth/google/callback"
SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
TOKEN_URL = "https://oauth2.googleapis.com/token"


def _client_id():
    return os.getenv("GOOGLE_CLIENT_ID", "")

def _client_secret():
    return os.getenv("GOOGLE_CLIENT_SECRET", "")


def _get_tenant(request: Request, db: Session) -> Tenant | None:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401)
    payload = decode_token(auth[7:])
    user_id = payload.get("sub", "")
    return db.query(Tenant).filter(Tenant.user_id == user_id).first()


async def _refresh_access_token(refresh_token: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": _client_id(),
            "client_secret": _client_secret(),
            "grant_type": "refresh_token",
        })
        if r.status_code != 200:
            raise HTTPException(400, "Token de Google expirado. Reconecta Search Console.")
        return r.json()["access_token"]


# ── GET auth URL ────────────────────────────────────────────────────────────
@router.get("/api/gsc/auth-url")
async def gsc_auth_url(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401)
    payload = decode_token(auth[7:])
    user_id = payload.get("sub", "")
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={_client_id()}"
        f"&redirect_uri={quote(REDIRECT_URI, safe='')}"
        f"&response_type=code"
        f"&scope={quote(SCOPE, safe='')}"
        f"&access_type=offline"
        f"&prompt=consent"
        f"&state={user_id}"
    )
    return {"url": url}


# ── OAuth callback (public — starts with /auth/) ────────────────────────────
@router.get("/auth/google/callback")
async def google_callback(code: str = None, state: str = None, error: str = None):
    app_url = os.getenv("APP_URL", "https://seo.conectaai.cl")
    db = SessionLocal()
    try:
        if error or not code:
            return RedirectResponse(f"{app_url}?gsc=error&msg={error or 'cancelled'}")

        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(TOKEN_URL, data={
                "code": code,
                "client_id": _client_id(),
                "client_secret": _client_secret(),
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
            })
            if r.status_code != 200:
                return RedirectResponse(f"{app_url}?gsc=error&msg=token_exchange_failed")
            tokens = r.json()

        refresh_token = tokens.get("refresh_token")
        if not refresh_token:
            return RedirectResponse(f"{app_url}?gsc=error&msg=no_refresh_token")

        tenant = db.query(Tenant).filter(Tenant.user_id == state).first()
        if tenant:
            tenant.google_refresh_token = refresh_token
            db.commit()

        return RedirectResponse(f"{app_url}?gsc=ok")
    finally:
        db.close()


# ── GSC status ───────────────────────────────────────────────────────────────
@router.get("/api/gsc/status")
async def gsc_status(request: Request):
    db = SessionLocal()
    try:
        tenant = _get_tenant(request, db)
        connected = bool(tenant and tenant.google_refresh_token)
        return {"connected": connected}
    finally:
        db.close()


# ── Disconnect ────────────────────────────────────────────────────────────────
@router.delete("/api/gsc/disconnect")
async def gsc_disconnect(request: Request):
    db = SessionLocal()
    try:
        tenant = _get_tenant(request, db)
        if tenant:
            tenant.google_refresh_token = ""
            db.commit()
        return {"ok": True}
    finally:
        db.close()


# ── List verified sites ───────────────────────────────────────────────────────
@router.get("/api/gsc/sites")
async def gsc_sites(request: Request):
    db = SessionLocal()
    try:
        tenant = _get_tenant(request, db)
        if not tenant or not tenant.google_refresh_token:
            raise HTTPException(400, "Search Console no conectado")
        access_token = await _refresh_access_token(tenant.google_refresh_token)
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                "https://www.googleapis.com/webmasters/v3/sites",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            r.raise_for_status()
        sites = [s["siteUrl"] for s in r.json().get("siteEntry", [])]
        return {"sites": sites}
    finally:
        db.close()


# ── Search analytics ──────────────────────────────────────────────────────────
@router.get("/api/gsc/analytics")
async def gsc_analytics(site_url: str, days: int = 28, request: Request = None):
    db = SessionLocal()
    try:
        tenant = _get_tenant(request, db)
        if not tenant or not tenant.google_refresh_token:
            raise HTTPException(400, "Search Console no conectado")
        access_token = await _refresh_access_token(tenant.google_refresh_token)

        end = datetime.date.today()
        start = end - datetime.timedelta(days=days)
        encoded = quote(site_url, safe="")

        async with httpx.AsyncClient(timeout=30) as client:
            # Top queries
            rq = await client.post(
                f"https://www.googleapis.com/webmasters/v3/sites/{encoded}/searchAnalytics/query",
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "startDate": str(start), "endDate": str(end),
                    "dimensions": ["query"], "rowLimit": 25,
                    "orderBy": [{"field": "clicks", "sortOrder": "DESCENDING"}]
                }
            )
            rq.raise_for_status()

            # Top pages
            rp = await client.post(
                f"https://www.googleapis.com/webmasters/v3/sites/{encoded}/searchAnalytics/query",
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "startDate": str(start), "endDate": str(end),
                    "dimensions": ["page"], "rowLimit": 10,
                    "orderBy": [{"field": "clicks", "sortOrder": "DESCENDING"}]
                }
            )
            rp.raise_for_status()

            # Totals (no dimension)
            rt = await client.post(
                f"https://www.googleapis.com/webmasters/v3/sites/{encoded}/searchAnalytics/query",
                headers={"Authorization": f"Bearer {access_token}"},
                json={"startDate": str(start), "endDate": str(end), "rowLimit": 1}
            )
            rt.raise_for_status()

        def fmt_rows(rows, key="query"):
            return [
                {
                    "key": r["keys"][0],
                    "clicks": int(r.get("clicks", 0)),
                    "impressions": int(r.get("impressions", 0)),
                    "ctr": round(r.get("ctr", 0) * 100, 1),
                    "position": round(r.get("position", 0), 1),
                }
                for r in rows
            ]

        totals_rows = rt.json().get("rows", [{}])
        totals = totals_rows[0] if totals_rows else {}

        return {
            "site": site_url,
            "period": {"start": str(start), "end": str(end), "days": days},
            "totals": {
                "clicks": int(totals.get("clicks", 0)),
                "impressions": int(totals.get("impressions", 0)),
                "ctr": round(totals.get("ctr", 0) * 100, 1),
                "position": round(totals.get("position", 0), 1),
            },
            "top_queries": fmt_rows(rq.json().get("rows", [])),
            "top_pages": fmt_rows(rp.json().get("rows", []), key="page"),
        }
    finally:
        db.close()
