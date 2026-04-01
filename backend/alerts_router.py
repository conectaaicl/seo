from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from database import SessionLocal, AlertConfig
from auth_helpers import decode_token
from email_service import send_email
import datetime

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


def _uid(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401)
    return decode_token(auth[7:]).get("sub", "")


class AlertConfigIn(BaseModel):
    site_url: str
    alert_email: str
    seo_score_threshold: str = "70"
    pagespeed_threshold: str = "50"
    is_active: bool = True


def _config_to_dict(cfg: AlertConfig) -> dict:
    return {
        "id": cfg.id,
        "user_id": cfg.user_id,
        "site_url": cfg.site_url,
        "alert_email": cfg.alert_email,
        "seo_score_threshold": cfg.seo_score_threshold,
        "pagespeed_threshold": cfg.pagespeed_threshold,
        "is_active": cfg.is_active,
        "last_checked": cfg.last_checked.strftime("%Y-%m-%d %H:%M") if cfg.last_checked else None,
        "last_seo_score": cfg.last_seo_score,
        "last_pagespeed_score": cfg.last_pagespeed_score,
        "created_at": cfg.created_at.strftime("%Y-%m-%d %H:%M") if cfg.created_at else None,
    }


# ── GET config ────────────────────────────────────────────────────────────────
@router.get("/config")
async def get_config(request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        cfg = db.query(AlertConfig).filter(AlertConfig.user_id == uid).first()
        if not cfg:
            return None
        return _config_to_dict(cfg)
    finally:
        db.close()


# ── PUT config (create or update) ─────────────────────────────────────────────
@router.put("/config")
async def upsert_config(body: AlertConfigIn, request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        cfg = db.query(AlertConfig).filter(AlertConfig.user_id == uid).first()
        if cfg:
            cfg.site_url = body.site_url
            cfg.alert_email = body.alert_email
            cfg.seo_score_threshold = body.seo_score_threshold
            cfg.pagespeed_threshold = body.pagespeed_threshold
            cfg.is_active = body.is_active
        else:
            cfg = AlertConfig(
                user_id=uid,
                site_url=body.site_url,
                alert_email=body.alert_email,
                seo_score_threshold=body.seo_score_threshold,
                pagespeed_threshold=body.pagespeed_threshold,
                is_active=body.is_active,
            )
            db.add(cfg)
        db.commit()
        db.refresh(cfg)
        return _config_to_dict(cfg)
    finally:
        db.close()


# ── DELETE config ─────────────────────────────────────────────────────────────
@router.delete("/config")
async def delete_config(request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        cfg = db.query(AlertConfig).filter(AlertConfig.user_id == uid).first()
        if not cfg:
            raise HTTPException(404, "No hay configuración de alertas")
        db.delete(cfg)
        db.commit()
        return {"ok": True}
    finally:
        db.close()


# ── POST check-now ─────────────────────────────────────────────────────────────
@router.post("/check-now")
async def check_now(request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        cfg = db.query(AlertConfig).filter(AlertConfig.user_id == uid).first()
        if not cfg:
            raise HTTPException(404, "Configura las alertas primero")

        # Import here to avoid circular import at module level
        from main import audit_url, URLReq

        # Run SEO audit
        try:
            audit = await audit_url(URLReq(url=cfg.site_url))
        except Exception as e:
            raise HTTPException(400, f"Error al auditar {cfg.site_url}: {e}")

        score = audit.get("score", 0)
        threshold = int(cfg.seo_score_threshold)
        issues = audit.get("issues", [])

        alert_sent = False

        # Determine if we should send alert:
        # Alert if score < threshold AND (score changed or never checked)
        prev_score_str = cfg.last_seo_score or ""
        score_changed = (str(score) != prev_score_str)

        if score < threshold and score_changed and cfg.is_active:
            # Build top issues list (errors + warnings only)
            bad_issues = [i for i in issues if i["type"] in ("error", "warning")][:8]
            issues_rows = "".join(
                f"""<tr>
                  <td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="color:{'#ef4444' if i['type']=='error' else '#f59e0b'};font-weight:700;">
                      {'✗' if i['type']=='error' else '⚠'}
                    </span>
                  </td>
                  <td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);color:#94a3b8;font-size:13px;">
                    {i['field']}
                  </td>
                  <td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e2e8f0;font-size:13px;">
                    {i['msg']}
                  </td>
                </tr>"""
                for i in bad_issues
            )

            score_color = "#22c55e" if score >= 75 else "#f59e0b" if score >= 50 else "#ef4444"

            html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#080b10;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#131920;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
    <div style="background:linear-gradient(135deg,#ef4444,#f97316);padding:28px 32px;">
      <div style="font-size:32px;margin-bottom:8px;">⚠️</div>
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:800;">Alerta SEO Activada</h1>
      <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">SEO UltraPRO — by ConectaAI</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">
        El score SEO de <strong style="color:#e2e8f0;">{cfg.site_url}</strong> ha caído por debajo del umbral configurado.
      </p>
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;background:#0d1117;border-radius:10px;padding:16px;text-align:center;border:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Score Actual</div>
          <div style="font-size:36px;font-weight:800;color:{score_color};">{score}</div>
          <div style="font-size:11px;color:#64748b;">/100</div>
        </div>
        <div style="flex:1;background:#0d1117;border-radius:10px;padding:16px;text-align:center;border:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Umbral Mínimo</div>
          <div style="font-size:36px;font-weight:800;color:#6366f1;">{threshold}</div>
          <div style="font-size:11px;color:#64748b;">/100</div>
        </div>
      </div>
      {'<h3 style="color:#fff;font-size:14px;margin:0 0 12px;">Problemas detectados:</h3><table style="width:100%;border-collapse:collapse;background:#0d1117;border-radius:10px;overflow:hidden;"><tbody>' + issues_rows + '</tbody></table>' if issues_rows else ''}
      <div style="margin-top:24px;padding:16px;background:#0d1117;border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:11px;color:#64748b;margin-bottom:4px;">Sitio auditado</div>
        <div style="font-size:13px;color:#818cf8;font-weight:600;">{cfg.site_url}</div>
        <div style="font-size:11px;color:#64748b;margin-top:8px;">Fecha del análisis</div>
        <div style="font-size:13px;color:#e2e8f0;">{datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC</div>
      </div>
      <p style="color:#64748b;font-size:11px;text-align:center;margin:24px 0 0;">
        SEO UltraPRO · <strong style="color:#818cf8;">ConectaAI</strong> © 2026<br/>
        Gestiona tus alertas en el panel SEO UltraPRO.
      </p>
    </div>
  </div>
</body>
</html>"""

            subject = f"⚠ Alerta SEO — {cfg.site_url} — Score cayó a {score}"
            await send_email(cfg.alert_email, subject, html)
            alert_sent = True

        # Update last_checked and last_seo_score
        cfg.last_checked = datetime.datetime.utcnow()
        cfg.last_seo_score = str(score)
        db.commit()

        return {
            "score": score,
            "threshold": threshold,
            "alert_sent": alert_sent,
            "site_url": cfg.site_url,
            "grade": audit.get("grade", ""),
            "errors": audit.get("errors", 0),
            "warnings": audit.get("warnings", 0),
            "passed": audit.get("passed", 0),
            "issues": issues[:10],
        }
    finally:
        db.close()
