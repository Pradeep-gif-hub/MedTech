from dotenv import load_dotenv
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# ============================================================
# CRITICAL: POSTGRESQL ONLY - NO SQLITE FALLBACK
# Prevents data inconsistency between SQLite and PostgreSQL
# ============================================================

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise Exception("❌ DATABASE_URL not set. PostgreSQL required.")

# PostgreSQL mode (ONLY mode - no SQLite fallback!)
print("🐘 ACTIVE DATABASE:", DATABASE_URL)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

print(f"🔧 Database engine configured: {engine.dialect.name.upper()}")


def get_db():
    """Database dependency injection for FastAPI endpoints"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_engine():
    """Get the current database engine (for migrations/admin tasks)"""
    return engine


def get_database_type():
    """Return current database type: 'postgresql'"""
    return engine.dialect.name

