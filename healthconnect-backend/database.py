import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ============================================================
# CRITICAL: POSTGRESQL ONLY - NO SQLITE FALLBACK
# Prevents data inconsistency between SQLite and PostgreSQL
# ============================================================

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    error_msg = """
    ❌ CRITICAL ERROR: DATABASE_URL not set!
    
    PostgreSQL is required. Set environment variable:
    Windows (PowerShell): $env:DATABASE_URL="postgresql://..."
    Linux/Mac: export DATABASE_URL="postgresql://..."
    
    Without this, backend will NOT start.
    """
    print(error_msg)
    raise Exception(error_msg)

# PostgreSQL mode (ONLY mode - no SQLite fallback!)
print("\n" + "="*70)
print("🐘 FORCED POSTGRESQL MODE")
print("="*70)
db_display = DATABASE_URL.split("@")[0] + "@..." if "@" in DATABASE_URL else DATABASE_URL[:50]
print(f"📍 Database URL: {db_display}")

engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Verify connections before using
    echo=False  # Set to True for SQL debugging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

print(f"🔧 Database engine configured: {engine.dialect.name.upper()}")
print(f"📦 SessionLocal pool_size=10, max_overflow=20")
print("="*70 + "\n")


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
    """Return current database type: 'postgresql' or 'sqlite'"""
    return engine.dialect.name

