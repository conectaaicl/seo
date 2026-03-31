from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db, User, Tenant, Setting
from auth_helpers import decode_token, hash_password, generate_password
from email_service import send_email, invite_html, test_email_html
import datetime, os

router = APIRouter(prefix="/admin", tags=["admin"])

APP_URL = os.getenv("APP_URL", "https://seo.conectaai.cl")


def require_admin(request: Request, db: Session = Depends(get_db)):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "No autenticado")
    payload = decode_token(auth[7:])
    if payload.get("role") != "admin":
        raise HTTPException(403, "Solo administradores")
    user = db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()
    if not user:
        raise HTTPException(401, "Usuario no encontrado")
    return user


# ── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _=Depends(require_admin)):
    return {
        "total_tenants": db.query(Tenant).count(),
        "active_tenants": db.query(Tenant).filter(Tenant.is_active == True).count(),
        "total_users": db.query(User).count(),
        "active_users": db.query(User).filter(User.is_active == True).count(),
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "pagespeed_configured": bool(os.getenv("PAGESPEED_API_KEY")),
        "smtp_configured": bool(os.getenv("SMTP_PASSWORD")),
    }


# ── Tenants ──────────────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    name: str
    email: str
    domain: Optional[str] = ""
    plan: Optional[str] = "basic"
    notes: Optional[str] = ""
    send_invite: Optional[bool] = True
    groq_api_key: Optional[str] = ""
    pagespeed_api_key: Optional[str] = ""


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    domain: Optional[str] = None
    plan: Optional[str] = None
    notes: Optional[str] = None
    groq_api_key: Optional[str] = None
    pagespeed_api_key: Optional[str] = None


def tenant_dict(t: Tenant) -> dict:
    gk = t.groq_api_key or ""
    pk = t.pagespeed_api_key or ""
    return {
        "id": t.id, "name": t.name, "email": t.email, "domain": t.domain,
        "plan": t.plan, "is_active": t.is_active, "notes": t.notes,
        "user_id": t.user_id,
        "groq_api_key_set": bool(gk),
        "pagespeed_api_key_set": bool(pk),
        "groq_api_key_masked": (gk[:6] + "•" * (len(gk)-6)) if len(gk) > 6 else ("•" * len(gk) if gk else ""),
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("/tenants")
def list_tenants(db: Session = Depends(get_db), _=Depends(require_admin)):
    tenants = db.query(Tenant).order_by(Tenant.created_at.desc()).all()
    return [tenant_dict(t) for t in tenants]


@router.post("/tenants")
async def create_tenant(req: TenantCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    # Create user account for tenant
    password = generate_password()
    existing = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if existing:
        raise HTTPException(400, f"Ya existe un usuario con el email {req.email}")

    user = User(
        email=req.email.strip().lower(),
        name=req.name,
        password_hash=hash_password(password),
        role="user",
    )
    db.add(user)
    db.flush()

    tenant = Tenant(
        name=req.name,
        email=req.email.strip().lower(),
        domain=req.domain or "",
        plan=req.plan or "basic",
        notes=req.notes or "",
        user_id=user.id,
        groq_api_key=req.groq_api_key or "",
        pagespeed_api_key=req.pagespeed_api_key or "",
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    if req.send_invite:
        try:
            await send_email(
                req.email,
                f"Acceso a SEO UltraPRO — {req.name}",
                invite_html(req.name, req.email, password, APP_URL),
            )
        except Exception as e:
            return {**tenant_dict(tenant), "warning": f"Tenant creado pero error al enviar email: {e}", "temp_password": password}

    return {**tenant_dict(tenant), "temp_password": password}


@router.put("/tenants/{tenant_id}")
def update_tenant(tenant_id: str, req: TenantUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(404, "Tenant no encontrado")
    if req.name is not None: t.name = req.name
    if req.email is not None: t.email = req.email
    if req.domain is not None: t.domain = req.domain
    if req.plan is not None: t.plan = req.plan
    if req.notes is not None: t.notes = req.notes
    if req.groq_api_key is not None: t.groq_api_key = req.groq_api_key
    if req.pagespeed_api_key is not None: t.pagespeed_api_key = req.pagespeed_api_key
    db.commit()
    return tenant_dict(t)


@router.post("/tenants/{tenant_id}/toggle")
def toggle_tenant(tenant_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(404, "Tenant no encontrado")
    t.is_active = not t.is_active
    if t.user_id:
        u = db.query(User).filter(User.id == t.user_id).first()
        if u:
            u.is_active = t.is_active
    db.commit()
    return tenant_dict(t)


@router.delete("/tenants/{tenant_id}")
def delete_tenant(tenant_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(404, "Tenant no encontrado")
    if t.user_id:
        u = db.query(User).filter(User.id == t.user_id).first()
        if u:
            db.delete(u)
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.post("/tenants/{tenant_id}/resend-invite")
async def resend_invite(tenant_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(404, "Tenant no encontrado")
    password = generate_password()
    if t.user_id:
        u = db.query(User).filter(User.id == t.user_id).first()
        if u:
            u.password_hash = hash_password(password)
            db.commit()
    try:
        await send_email(
            t.email,
            f"Acceso a SEO UltraPRO — {t.name}",
            invite_html(t.name, t.email, password, APP_URL),
        )
    except Exception as e:
        raise HTTPException(500, f"Error al enviar email: {e}")
    return {"ok": True, "temp_password": password}


# ── Users ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: Optional[str] = "user"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


def user_dict(u: User) -> dict:
    return {
        "id": u.id, "email": u.email, "name": u.name, "role": u.role,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "last_login": u.last_login.isoformat() if u.last_login else None,
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db), _=Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [user_dict(u) for u in users]


@router.post("/users")
def create_user(req: UserCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if db.query(User).filter(User.email == req.email.strip().lower()).first():
        raise HTTPException(400, "Email ya registrado")
    u = User(
        email=req.email.strip().lower(),
        name=req.name,
        password_hash=hash_password(req.password),
        role=req.role or "user",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return user_dict(u)


@router.put("/users/{user_id}")
def update_user(user_id: str, req: UserUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if req.name is not None: u.name = req.name
    if req.role is not None: u.role = req.role
    if req.password: u.password_hash = hash_password(req.password)
    db.commit()
    return user_dict(u)


@router.post("/users/{user_id}/toggle")
def toggle_user(user_id: str, db: Session = Depends(get_db), admin=Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if u.id == admin.id:
        raise HTTPException(400, "No puedes desactivarte a ti mismo")
    u.is_active = not u.is_active
    db.commit()
    return user_dict(u)


@router.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), admin=Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if u.id == admin.id:
        raise HTTPException(400, "No puedes eliminarte a ti mismo")
    db.delete(u)
    db.commit()
    return {"ok": True}


# ── Settings ─────────────────────────────────────────────────────────────────

SETTING_KEYS = [
    "GROQ_API_KEY", "PAGESPEED_API_KEY",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM",
    "APP_URL",
]


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), _=Depends(require_admin)):
    stored = {s.key: s.value for s in db.query(Setting).all()}
    result = {}
    for k in SETTING_KEYS:
        result[k] = stored.get(k, os.getenv(k, ""))
    # Mask passwords partially
    for secret in ["GROQ_API_KEY", "PAGESPEED_API_KEY", "SMTP_PASSWORD"]:
        v = result.get(secret, "")
        if len(v) > 8:
            result[f"{secret}_masked"] = v[:6] + "•" * (len(v) - 6)
        else:
            result[f"{secret}_masked"] = "•" * len(v)
    return result


@router.put("/settings")
def update_settings(data: dict, db: Session = Depends(get_db), _=Depends(require_admin)):
    for key, value in data.items():
        if key not in SETTING_KEYS:
            continue
        setting = db.query(Setting).filter(Setting.key == key).first()
        if setting:
            setting.value = str(value)
            setting.updated_at = datetime.datetime.utcnow()
        else:
            db.add(Setting(key=key, value=str(value)))
        # Update runtime env
        os.environ[key] = str(value)
    db.commit()
    return {"ok": True}


@router.post("/test-email")
async def test_email(request: Request, db: Session = Depends(get_db), _=Depends(require_admin)):
    body = await request.json()
    to = body.get("to", "")
    if not to:
        raise HTTPException(400, "Email destino requerido")
    try:
        await send_email(to, "✓ Test SMTP — SEO UltraPRO", test_email_html())
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, f"Error SMTP: {e}")
