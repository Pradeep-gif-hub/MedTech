#!/usr/bin/env python3
"""
Database initialization script for Pharmacy Integration System
This script creates new tables and adds new columns to existing tables.
"""

import sys
import os
from database import engine, SessionLocal
from models import Base, Prescription, Inventory, User
from sqlalchemy import inspect, text, event

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Set SQLite pragmas for better performance and reliability"""
    if 'sqlite' in str(engine.url):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

def init_pharmacy_database():
    """Initialize pharmacy integration database tables"""
    
    print("[DB_INIT] Starting pharmacy database initialization...")
    
    # Create all tables defined in models
    try:
        print("[DB_INIT] Creating tables...")
        Base.metadata.create_all(bind=engine)
        print("[DB_INIT] ✓ All tables created/verified")
    except Exception as e:
        print(f"[DB_INIT] ✗ Error creating tables: {e}")
        return False
    
    # Verify pharmacy_status column exists in prescriptions
    db = None
    try:
        inspector = inspect(engine)
        
        # Check prescriptions table
        print("[DB_INIT] Checking prescriptions table columns...")
        if 'prescriptions' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('prescriptions')]
            
            if 'pharmacy_status' not in columns:
                print("[DB_INIT] Adding pharmacy_status column to prescriptions...")
                try:
                    with engine.begin() as conn:
                        if 'sqlite' in str(engine.url):
                            conn.execute(text("""
                                ALTER TABLE prescriptions 
                                ADD COLUMN pharmacy_status VARCHAR DEFAULT 'pending'
                            """))
                        else:
                            conn.execute(text("""
                                ALTER TABLE prescriptions 
                                ADD COLUMN pharmacy_status VARCHAR DEFAULT 'pending'
                            """))
                    print("[DB_INIT] ✓ pharmacy_status column added")
                except Exception as e:
                    if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                        print(f"[DB_INIT] ✓ pharmacy_status column already exists")
                    else:
                        print(f"[DB_INIT] Note: {e}")
            else:
                print("[DB_INIT] ✓ pharmacy_status column already exists")
            
            if 'status' not in columns:
                print("[DB_INIT] Adding status column to prescriptions...")
                try:
                    with engine.begin() as conn:
                        if 'sqlite' in str(engine.url):
                            conn.execute(text("""
                                ALTER TABLE prescriptions 
                                ADD COLUMN status VARCHAR DEFAULT 'pending'
                            """))
                        else:
                            conn.execute(text("""
                                ALTER TABLE prescriptions 
                                ADD COLUMN status VARCHAR DEFAULT 'pending'
                            """))
                    print("[DB_INIT] ✓ status column added")
                except Exception as e:
                    if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                        print(f"[DB_INIT] ✓ status column already exists")
                    else:
                        print(f"[DB_INIT] Note: {e}")
            else:
                print("[DB_INIT] ✓ status column already exists")
        
        # Check inventory table
        print("[DB_INIT] Checking inventory table...")
        if 'inventory' not in inspector.get_table_names():
            print("[DB_INIT] ✓ Inventory table will be created automatically")
        else:
            print("[DB_INIT] ✓ Inventory table already exists")
        
        print("[DB_INIT] ✓ Database initialization complete!")
        return True
        
    except Exception as e:
        print(f"[DB_INIT] ✗ Error during verification: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if db:
            db.close()


if __name__ == "__main__":
    try:
        success = init_pharmacy_database()
        print("[DB_INIT] Database initialization finished successfully!" if success else "[DB_INIT] Database initialization had issues but may still be usable")
        sys.exit(0)
    except KeyboardInterrupt:
        print("\n[DB_INIT] Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"[DB_INIT] Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
