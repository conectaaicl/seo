from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from database import SessionLocal, User
from auth_helpers import decode_token
from urllib.parse import quote
import os, httpx, datetime

router = APIRouter(tags=["analytics"])

REDIRECT_URI = "https://seo.conectaai.cl/auth/ga4/callback"
GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
TOKEN_URL = "https://oauth2.googleapis.com/token"


def _client_id():
    return os.getenv("GOOGLE_CLIENT_ID", "")


def _client_secret():
    return os.getenv("GOOGLE_CLIENT_SECRET", "")


def _get_user_id(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401)
    payload = decode_token(auth[7:])
    return payload.get("sub", "")


def _get_ga4_refresh_token(user_id: str, db: Session) -> str:
    """Get GA4 refresh token from User."""
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.ga4_refresh_token:
        return user.ga4_refresh_token
    return ""


def _save_ga4_refresh_token(user_id: str, token: str, db: Session):
    """Save GA4 refresh token to User record."""
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.ga4_refresh_token = token
        db.commit()


async def _refresh_ga4_access_token(refresh_token: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": _client_id(),
            "client_secret": _client_secret(),
            "grant_type": "refresh_token",
        })
        if r.status_code != 200:
            raise HTTPException(400, "Token de GA4 expirado. Reconecta Google Analytics.")
        return r.json()["access_token"]


# ── GET auth URL ──────────────────────────────────────────────────────────────
@router.get("/api/ga4/auth-url")
async def ga4_auth_url(request: Request):
    user_id = _get_user_id(request)
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={_client_id()}"
        f"&redirect_uri={quote(REDIRECT_URI, safe='')}"
        f"&response_type=code"
        f"&scope={quote(GA4_SCOPE, safe='')}"
        f"&access_type=offline"
        f"&prompt=consent"
        f"&state={user_id}"
    )
    return {"url": url}


# ── OAuth callback (public — starts with /auth/) ──────────────────────────────
@router.get("/auth/ga4/callback")
async def ga4_callback(code: str = None, state: str = None, error: str = None):
    app_url = os.getenv("APP_URL", "https://seo.conectaai.cl")
    db = SessionLocal()
    try:
        if error or not code:
            return RedirectResponse(f"{app_url}?ga4=error")

        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(TOKEN_URL, data={
                "code": code,
                "client_id": _client_id(),
                "client_secret": _client_secret(),
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
            })
            if r.status_code != 200:
                return RedirectResponse(f"{app_url}?ga4=error")
            tokens = r.json()

        refresh_token = tokens.get("refresh_token")
        if not refresh_token:
            return RedirectResponse(f"{app_url}?ga4=error")

        _save_ga4_refresh_token(state, refresh_token, db)

        return RedirectResponse(f"{app_url}?ga4=ok&tab=analytics")
    finally:
        db.close()


# ── GA4 status ────────────────────────────────────────────────────────────────
@router.get("/api/ga4/status")
async def ga4_status(request: Request):
    db = SessionLocal()
    try:
        user_id = _get_user_id(request)
        token = _get_ga4_refresh_token(user_id, db)
        return {"connected": bool(token)}
    finally:
        db.close()


# ── Disconnect ────────────────────────────────────────────────────────────────
@router.delete("/api/ga4/disconnect")
async def ga4_disconnect(request: Request):
    db = SessionLocal()
    try:
        user_id = _get_user_id(request)
        _save_ga4_refresh_token(user_id, "", db)
        return {"ok": True}
    finally:
        db.close()


# ── List GA4 properties (Admin API) ──────────────────────────────────────────
@router.get("/api/ga4/properties")
async def ga4_properties(request: Request):
    db = SessionLocal()
    try:
        user_id = _get_user_id(request)
        token = _get_ga4_refresh_token(user_id, db)
        if not token:
            raise HTTPException(400, "Google Analytics no conectado")
        access_token = await _refresh_ga4_access_token(token)

        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                "https://analyticsadmin.googleapis.com/v1alpha/accountSummaries",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if r.status_code == 403:
                raise HTTPException(403, "Sin permisos para Google Analytics Admin API. Asegúrate de tener acceso a al menos una propiedad GA4.")
            r.raise_for_status()

        summaries = r.json().get("accountSummaries", [])
        properties = []
        for account in summaries:
            account_name = account.get("displayName", "")
            for prop in account.get("propertySummaries", []):
                prop_id = prop.get("property", "").replace("properties/", "")
                properties.append({
                    "id": prop_id,
                    "name": prop.get("displayName", prop_id),
                    "account": account_name,
                })
        return {"properties": properties}
    finally:
        db.close()


# ── GA4 traffic report ────────────────────────────────────────────────────────
@router.get("/api/ga4/report")
async def ga4_report(property_id: str, days: int = 28, request: Request = None):
    db = SessionLocal()
    try:
        user_id = _get_user_id(request)
        token = _get_ga4_refresh_token(user_id, db)
        if not token:
            raise HTTPException(400, "Google Analytics no conectado")
        access_token = await _refresh_ga4_access_token(token)

        end = datetime.date.today()
        start = end - datetime.timedelta(days=days - 1)

        property_path = f"properties/{property_id}"

        async with httpx.AsyncClient(timeout=30) as client:
            # Main report: daily sessions/users/pageviews/bounce/duration
            r_daily = await client.post(
                f"https://analyticsdata.googleapis.com/v1beta/{property_path}/runReport",
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "dimensions": [{"name": "date"}],
                    "metrics": [
                        {"name": "sessions"},
                        {"name": "totalUsers"},
                        {"name": "screenPageViews"},
                        {"name": "bounceRate"},
                        {"name": "averageSessionDuration"},
                    ],
                    "dateRanges": [{"startDate": str(start), "endDate": str(end)}],
                    "orderBys": [{"dimension": {"dimensionName": "date"}}],
                }
            )
            if r_daily.status_code == 403:
                raise HTTPException(403, "Sin acceso a esta propiedad de GA4.")
            r_daily.raise_for_status()

            # Top pages report
            r_pages = await client.post(
                f"https://analyticsdata.googleapis.com/v1beta/{property_path}/runReport",
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "dimensions": [{"name": "pagePath"}],
                    "metrics": [
                        {"name": "screenPageViews"},
                        {"name": "sessions"},
                        {"name": "bounceRate"},
                    ],
                    "dateRanges": [{"startDate": str(start), "endDate": str(end)}],
                    "orderBys": [{"metric": {"metricName": "screenPageViews"}, "desc": True}],
                    "limit": 20,
                }
            )
            r_pages.raise_for_status()

            # Totals report (no dimension)
            r_totals = await client.post(
                f"https://analyticsdata.googleapis.com/v1beta/{property_path}/runReport",
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "metrics": [
                        {"name": "sessions"},
                        {"name": "totalUsers"},
                        {"name": "screenPageViews"},
                        {"name": "bounceRate"},
                        {"name": "averageSessionDuration"},
                    ],
                    "dateRanges": [{"startDate": str(start), "endDate": str(end)}],
                }
            )
            r_totals.raise_for_status()

        # Parse daily rows
        daily_data = r_daily.json()
        daily_rows = []
        for row in daily_data.get("rows", []):
            dims = row.get("dimensionValues", [])
            vals = row.get("metricValues", [])
            raw_date = dims[0]["value"] if dims else ""
            # GA4 date format: YYYYMMDD -> YYYY-MM-DD
            if len(raw_date) == 8:
                fmt_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
            else:
                fmt_date = raw_date
            daily_rows.append({
                "date": fmt_date,
                "sessions": int(vals[0]["value"]) if len(vals) > 0 else 0,
                "users": int(vals[1]["value"]) if len(vals) > 1 else 0,
                "pageviews": int(vals[2]["value"]) if len(vals) > 2 else 0,
                "bounceRate": round(float(vals[3]["value"]) * 100, 1) if len(vals) > 3 else 0,
                "avgSessionDuration": round(float(vals[4]["value"]), 1) if len(vals) > 4 else 0,
            })

        # Parse top pages
        pages_data = r_pages.json()
        top_pages = []
        for row in pages_data.get("rows", []):
            dims = row.get("dimensionValues", [])
            vals = row.get("metricValues", [])
            top_pages.append({
                "path": dims[0]["value"] if dims else "/",
                "pageviews": int(vals[0]["value"]) if len(vals) > 0 else 0,
                "sessions": int(vals[1]["value"]) if len(vals) > 1 else 0,
                "bounceRate": round(float(vals[2]["value"]) * 100, 1) if len(vals) > 2 else 0,
            })

        # Parse totals
        totals_data = r_totals.json()
        totals_rows = totals_data.get("rows", [{}])
        t_vals = totals_rows[0].get("metricValues", []) if totals_rows else []

        totals = {
            "sessions": int(t_vals[0]["value"]) if len(t_vals) > 0 else 0,
            "users": int(t_vals[1]["value"]) if len(t_vals) > 1 else 0,
            "pageviews": int(t_vals[2]["value"]) if len(t_vals) > 2 else 0,
            "bounceRate": round(float(t_vals[3]["value"]) * 100, 1) if len(t_vals) > 3 else 0,
            "avgSessionDuration": round(float(t_vals[4]["value"]), 1) if len(t_vals) > 4 else 0,
        }

        return {
            "property_id": property_id,
            "period": {"start": str(start), "end": str(end), "days": days},
            "totals": totals,
            "daily": daily_rows,
            "top_pages": top_pages,
        }
    finally:
        db.close()
