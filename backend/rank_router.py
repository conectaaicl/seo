from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import SessionLocal, TrackedKeyword, RankHistory
from auth_helpers import decode_token
from google_router import _get_refresh_token, _refresh_access_token
from urllib.parse import quote
import httpx, datetime

router = APIRouter(prefix="/api/rank", tags=["rank"])


def _uid(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401)
    return decode_token(auth[7:]).get("sub", "")


class AddKeyword(BaseModel):
    keyword: str
    site_url: str


# ── List tracked keywords ─────────────────────────────────────────────────────
@router.get("/keywords")
async def list_keywords(request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        kws = db.query(TrackedKeyword).filter(TrackedKeyword.user_id == uid).all()
        result = []
        for kw in kws:
            history = (
                db.query(RankHistory)
                .filter(RankHistory.keyword_id == kw.id)
                .order_by(RankHistory.checked_at.desc())
                .limit(30)
                .all()
            )
            latest = history[0] if history else None
            result.append({
                "id": kw.id,
                "keyword": kw.keyword,
                "site_url": kw.site_url,
                "position": latest.position if latest else "—",
                "clicks": latest.clicks if latest else "0",
                "impressions": latest.impressions if latest else "0",
                "last_checked": latest.checked_at.strftime("%Y-%m-%d %H:%M") if latest else None,
                "history": [
                    {"date": h.checked_at.strftime("%Y-%m-%d"), "position": h.position}
                    for h in reversed(history)
                ],
            })
        return result
    finally:
        db.close()


# ── Add keyword ───────────────────────────────────────────────────────────────
@router.post("/keywords")
async def add_keyword(req: AddKeyword, request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        # Check duplicate
        exists = db.query(TrackedKeyword).filter(
            TrackedKeyword.user_id == uid,
            TrackedKeyword.keyword == req.keyword.strip().lower(),
            TrackedKeyword.site_url == req.site_url,
        ).first()
        if exists:
            raise HTTPException(400, "Ya estás rastreando esa keyword para ese sitio")
        kw = TrackedKeyword(
            user_id=uid,
            keyword=req.keyword.strip().lower(),
            site_url=req.site_url,
        )
        db.add(kw)
        db.commit()
        db.refresh(kw)
        return {"id": kw.id, "keyword": kw.keyword, "site_url": kw.site_url}
    finally:
        db.close()


# ── Delete keyword ────────────────────────────────────────────────────────────
@router.delete("/keywords/{kw_id}")
async def delete_keyword(kw_id: str, request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        kw = db.query(TrackedKeyword).filter(
            TrackedKeyword.id == kw_id, TrackedKeyword.user_id == uid
        ).first()
        if not kw:
            raise HTTPException(404)
        db.query(RankHistory).filter(RankHistory.keyword_id == kw_id).delete()
        db.delete(kw)
        db.commit()
        return {"ok": True}
    finally:
        db.close()


# ── Check positions now (via Search Console) ─────────────────────────────────
@router.post("/check")
async def check_rankings(request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        refresh_token = _get_refresh_token(uid, db)
        if not refresh_token:
            raise HTTPException(400, "Conecta Google Search Console primero para rastrear posiciones")

        kws = db.query(TrackedKeyword).filter(TrackedKeyword.user_id == uid).all()
        if not kws:
            return {"updated": 0}

        access_token = await _refresh_access_token(refresh_token)

        # Group by site_url
        by_site: dict = {}
        for kw in kws:
            by_site.setdefault(kw.site_url, []).append(kw)

        updated = 0
        end = datetime.date.today()
        start = end - datetime.timedelta(days=7)

        async with httpx.AsyncClient(timeout=30) as client:
            for site_url, site_kws in by_site.items():
                encoded = quote(site_url, safe="")
                r = await client.post(
                    f"https://www.googleapis.com/webmasters/v3/sites/{encoded}/searchAnalytics/query",
                    headers={"Authorization": f"Bearer {access_token}"},
                    json={
                        "startDate": str(start),
                        "endDate": str(end),
                        "dimensions": ["query"],
                        "rowLimit": 1000,
                    }
                )
                if r.status_code != 200:
                    continue

                rows = {row["keys"][0].lower(): row for row in r.json().get("rows", [])}

                for kw in site_kws:
                    row = rows.get(kw.keyword)
                    pos = str(round(row["position"], 1)) if row else "—"
                    clicks = str(int(row.get("clicks", 0))) if row else "0"
                    impressions = str(int(row.get("impressions", 0))) if row else "0"
                    db.add(RankHistory(
                        keyword_id=kw.id,
                        position=pos,
                        clicks=clicks,
                        impressions=impressions,
                    ))
                    updated += 1

        db.commit()
        return {"updated": updated, "checked_at": str(end)}
    finally:
        db.close()
