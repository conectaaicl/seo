from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker
import datetime, uuid, os



DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////app/data/seo_app.db")
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
    google_refresh_token = Column(String, default="")
    ga4_refresh_token = Column(String, default="")


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


class TrackedKeyword(Base):
    __tablename__ = "tracked_keywords"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    keyword = Column(String, nullable=False)
    site_url = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class RankHistory(Base):
    __tablename__ = "rank_history"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    keyword_id = Column(String, nullable=False, index=True)
    position = Column(String, default="")   # avg position or "—"
    clicks = Column(String, default="0")
    impressions = Column(String, default="0")
    checked_at = Column(DateTime, default=datetime.datetime.utcnow)


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class CrawlJob(Base):
    __tablename__ = "crawl_jobs"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    site_url = Column(String, nullable=False)
    status = Column(String, default="running")   # running | done | error
    pages_crawled = Column(String, default="0")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    results_json = Column(Text, default="[]")    # JSON array of page results


class AlertConfig(Base):
    __tablename__ = "alert_configs"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    site_url = Column(String, nullable=False)
    alert_email = Column(String, nullable=False)
    seo_score_threshold = Column(String, default="70")   # alert if score drops below this
    pagespeed_threshold = Column(String, default="50")   # alert if performance drops below this
    is_active = Column(Boolean, default=True)
    last_checked = Column(DateTime, nullable=True)
    last_seo_score = Column(String, default="")
    last_pagespeed_score = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ReportSchedule(Base):
    __tablename__ = "report_schedules"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    site_url = Column(String, nullable=False)
    report_email = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    last_sent = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
