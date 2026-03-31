from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import HTTPException
import os, secrets, string

SECRET_KEY = os.getenv("JWT_SECRET", "seo-ultrapro-secret-conectaai-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Token inválido o expirado")


def generate_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$"
    return ''.join(secrets.choice(alphabet) for _ in range(length))
