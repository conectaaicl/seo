from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker
import datetime, uuid, os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./seo_app.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, default="")
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user")          # admin | user
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    email = Column(String, default="")
    domain = Column(String, default="")
    plan = Column(String, default="basic")         # basic | pro | enterprise
    is_active = Column(Boolean, default=True)
    notes = Column(Text, default="")
    user_id = Column(String, nullable=True)        # linked User id
    groq_api_key = Column(String, default="")      # tenant's own key (overrides global)
    pagespeed_api_key = Column(String, default="") # tenant's own key (overrides global)
    google_refresh_token = Column(String, default="")  # Google Search Console OAuth
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
