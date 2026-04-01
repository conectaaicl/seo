from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import SessionLocal, ReportSchedule
from auth_helpers import decode_token
from email_service import send_email
import datetime

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _uid(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401)
    return decode_token(auth[7:]).get("sub", "")


class ScheduleIn(BaseModel):
    site_url: str
    report_email: str
    is_active: bool = True


def _to_dict(s: ReportSchedule) -> dict:
    return {
        "id": s.id,
        "site_url": s.site_url,
        "report_email": s.report_email,
        "is_active": s.is_active,
        "last_sent": s.last_sent.strftime("%Y-%m-%d %H:%M") if s.last_sent else None,
        "created_at": s.created_at.strftime("%Y-%m-%d") if s.created_at else None,
    }


@router.get("/schedule")
async def get_schedule(request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        s = db.query(ReportSchedule).filter(ReportSchedule.user_id == uid).first()
        return _to_dict(s) if s else None
    finally:
        db.close()


@router.put("/schedule")
async def upsert_schedule(body: ScheduleIn, request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        s = db.query(ReportSchedule).filter(ReportSchedule.user_id == uid).first()
        if s:
            s.site_url = body.site_url
            s.report_email = body.report_email
            s.is_active = body.is_active
        else:
            s = ReportSchedule(
                user_id=uid,
                site_url=body.site_url,
                report_email=body.report_email,
                is_active=body.is_active,
            )
            db.add(s)
        db.commit()
        db.refresh(s)
        return _to_dict(s)
    finally:
        db.close()


@router.delete("/schedule")
async def delete_schedule(request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        s = db.query(ReportSchedule).filter(ReportSchedule.user_id == uid).first()
        if not s:
            raise HTTPException(404, "No hay programación configurada")
        db.delete(s)
        db.commit()
        return {"ok": True}
    finally:
        db.close()


@router.post("/send-now")
async def send_now(request: Request):
    uid = _uid(request)
    db = SessionLocal()
    try:
        s = db.query(ReportSchedule).filter(ReportSchedule.user_id == uid).first()
        if not s:
            raise HTTPException(404, "Configura el informe primero")

        # Import audit function to get SEO data
        from main import audit_url, URLReq
        try:
            audit = await audit_url(URLReq(url=s.site_url))
        except Exception as e:
            raise HTTPException(400, f"Error al auditar {s.site_url}: {e}")

        score = audit.get("score", 0)
        grade = audit.get("grade", "N/A")
        errors = audit.get("errors", 0)
        warnings = audit.get("warnings", 0)
        passed = audit.get("passed", 0)
        issues = audit.get("issues", [])

        score_color = "#22c55e" if score >= 75 else "#f59e0b" if score >= 50 else "#ef4444"
        now = datetime.datetime.utcnow()
        month_name = now.strftime("%B %Y")

        bad_issues = [i for i in issues if i["type"] in ("error", "warning")][:10]
        issues_html = "".join(
            f"""<tr>
              <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);width:28px;">
                <span style="color:{'#ef4444' if i['type']=='error' else '#f59e0b'};font-weight:700;font-size:15px;">
                  {'✗' if i['type']=='error' else '⚠'}
                </span>
              </td>
              <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);color:#94a3b8;font-size:12px;white-space:nowrap;">
                {i['field']}
              </td>
              <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);color:#e2e8f0;font-size:13px;">
                {i['msg']}
              </td>
            </tr>"""
            for i in bad_issues
        )

        html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#080b10;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:620px;margin:40px auto;background:#131920;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 36px;">
      <div style="font-size:32px;margin-bottom:10px;">📊</div>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
        Informe SEO Mensual
      </h1>
      <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px;">{month_name} · SEO UltraPRO by ConectaAI</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 36px;">

      <!-- Site info -->
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Aquí está el resumen mensual de SEO para <strong style="color:#e2e8f0;">{s.site_url}</strong>.
      </p>

      <!-- Score + Stats grid -->
      <div style="display:flex;gap:12px;margin-bottom:28px;flex-wrap:wrap;">
        <div style="flex:1 0 120px;background:#0d1117;border-radius:12px;padding:20px;text-align:center;border:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Score SEO</div>
          <div style="font-size:44px;font-weight:800;color:{score_color};line-height:1;">{score}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">/ 100 · Grado {grade}</div>
        </div>
        <div style="flex:1 0 80px;background:#0d1117;border-radius:12px;padding:20px;text-align:center;border:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Errores</div>
          <div style="font-size:32px;font-weight:800;color:#ef4444;line-height:1;">{errors}</div>
        </div>
        <div style="flex:1 0 80px;background:#0d1117;border-radius:12px;padding:20px;text-align:center;border:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Avisos</div>
          <div style="font-size:32px;font-weight:800;color:#f59e0b;line-height:1;">{warnings}</div>
        </div>
        <div style="flex:1 0 80px;background:#0d1117;border-radius:12px;padding:20px;text-align:center;border:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">OK</div>
          <div style="font-size:32px;font-weight:800;color:#10b981;line-height:1;">{passed}</div>
        </div>
      </div>

      <!-- Issues table -->
      {'<h3 style="color:#fff;font-size:14px;margin:0 0 14px;font-weight:700;">Problemas a corregir este mes:</h3><table style="width:100%;border-collapse:collapse;background:#0d1117;border-radius:12px;overflow:hidden;"><tbody>' + issues_html + '</tbody></table>' if issues_html else '<div style="background:#0d1117;border-radius:12px;padding:20px;text-align:center;color:#10b981;font-size:14px;font-weight:600;">✓ Sin errores críticos detectados este mes</div>'}

      <!-- Footer -->
      <p style="color:#475569;font-size:11px;text-align:center;margin:32px 0 0;line-height:1.7;">
        SEO UltraPRO · <strong style="color:#6366f1;">ConectaAI</strong> © {now.year}<br/>
        Informe generado automáticamente el {now.strftime('%Y-%m-%d %H:%M')} UTC.<br/>
        Gestiona tus informes en <a href="https://seo.conectaai.cl" style="color:#818cf8;">seo.conectaai.cl</a>
      </p>
    </div>
  </div>
</body>
</html>"""

        subject = f"📊 Informe SEO Mensual — {s.site_url} — Score: {score}/100"
        await send_email(s.report_email, subject, html)

        s.last_sent = now
        db.commit()

        return {
            "sent": True,
            "to": s.report_email,
            "score": score,
            "grade": grade,
            "errors": errors,
            "warnings": warnings,
            "passed": passed,
        }
    finally:
        db.close()
