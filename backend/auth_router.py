from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db, User
from auth_helpers import verify_password, create_token, decode_token
import datetime

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginReq(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(req: LoginReq, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email == req.email.strip().lower(),
        User.is_active == True
    ).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Credenciales incorrectas")
    user.last_login = datetime.datetime.utcnow()
    db.commit()
    token = create_token(user.id, user.role)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        }
    }


@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "No autenticado")
    payload = decode_token(auth[7:])
    user = db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()
    if not user:
        raise HTTPException(401, "Usuario no encontrado")
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.role}
