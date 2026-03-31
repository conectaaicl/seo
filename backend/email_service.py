import smtplib, os, asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from functools import partial


def _smtp_config():
    return {
        "host": os.getenv("SMTP_HOST", "mail.conectaai.cl"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", "no-reply@conectaai.cl"),
        "password": os.getenv("SMTP_PASSWORD", "ConectaAI#2025!"),
        "from": os.getenv("SMTP_FROM", "SEO UltraPRO <no-reply@conectaai.cl>"),
    }


def _send_sync(to: str, subject: str, html: str):
    cfg = _smtp_config()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = cfg["from"]
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP(cfg["host"], cfg["port"]) as s:
        s.ehlo()
        s.starttls()
        s.login(cfg["user"], cfg["password"])
        s.sendmail(cfg["user"], to, msg.as_string())


async def send_email(to: str, subject: str, html: str):
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, partial(_send_sync, to, subject, html))


def invite_html(name: str, email: str, password: str, url: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#080b10;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#131920;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
      <div style="font-size:36px;margin-bottom:8px;">🚀</div>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">SEO UltraPRO</h1>
      <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">by ConectaAI</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;">¡Hola {name}! 👋</h2>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Tu acceso a <strong style="color:#818cf8;">SEO UltraPRO</strong> ha sido creado.
        Ahora puedes gestionar toda tu estrategia SEO con inteligencia artificial.
      </p>
      <div style="background:#0d1117;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid rgba(255,255,255,0.06);">
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Email</div>
          <div style="font-size:14px;color:#e2e8f0;font-weight:600;">{email}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Contraseña temporal</div>
          <div style="font-size:16px;color:#10b981;font-weight:800;letter-spacing:.05em;font-family:monospace;">{password}</div>
        </div>
      </div>
      <a href="{url}" style="display:block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:10px;font-weight:700;font-size:14px;margin-bottom:24px;">
        Ingresar a SEO UltraPRO →
      </a>
      <p style="color:#64748b;font-size:12px;text-align:center;margin:0;">
        Te recomendamos cambiar tu contraseña después del primer ingreso.<br/>
        <strong style="color:#818cf8;">ConectaAI</strong> © 2026
      </p>
    </div>
  </div>
</body>
</html>
"""


def test_email_html() -> str:
    return """
<!DOCTYPE html>
<html>
<body style="background:#080b10;font-family:Arial,sans-serif;padding:40px;">
  <div style="max-width:400px;margin:0 auto;background:#131920;border-radius:12px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
    <h2 style="color:#10b981;margin:0 0 12px;">✓ SMTP Configurado</h2>
    <p style="color:#94a3b8;margin:0;">El servidor de correo está funcionando correctamente.</p>
    <p style="color:#64748b;font-size:12px;margin:16px 0 0;">SEO UltraPRO — ConectaAI</p>
  </div>
</body>
</html>
"""
