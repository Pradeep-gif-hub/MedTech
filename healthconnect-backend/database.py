import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Dual-mode database configuration
# Priority: DATABASE_URL (PostgreSQL) > SQLite (local development)
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # PostgreSQL mode (production/deployment)
    print("[DATABASE] 🐘 Using PostgreSQL:", DATABASE_URL.split("@")[0] + "@...")
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,  # Verify connections before using
    )
else:
    # SQLite mode (local development)
    print("[DATABASE] 📁 Using SQLite: ./healthconnect.db")
    SQLALCHEMY_DATABASE_URL = "sqlite:///./healthconnect.db"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


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

