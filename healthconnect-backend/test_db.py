#!/usr/bin/env python
"""
Test script to verify database migration and basic connectivity
"""
import sys
sys.path.insert(0, '.')

from database import engine, Base, SessionLocal
import models
from sqlalchemy import text, inspect

print("[TEST] Starting database test...")

# Check if tables exist
print("\n[TEST] Checking database schema...")
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f"[TEST] Tables in database: {tables}")

# Create all tables
print("\n[TEST] Running create_all...")
try:
    Base.metadata.create_all(bind=engine)
    print("[TEST] create_all completed successfully")
except Exception as e:
    print(f"[TEST] create_all failed: {e}")

# Check if SQLite and add missing columns
try:
    dialect_name = engine.dialect.name
    print(f"\n[TEST] DB dialect: {dialect_name}")
    
    if dialect_name == "sqlite":
        with engine.connect() as conn:
            # Get existing columns
            pragma = conn.execute(text("PRAGMA table_info('users')"))
            existing = {row['name'] for row in pragma.mappings()}
            print(f"[TEST] Existing user columns: {sorted(existing)}")
            
            # Check for missing doctor fields
            doctor_fields = [
                'full_name', 'specialization', 'years_of_experience', 'languages_spoken',
                'license_number', 'registration_number', 'hospital_name', 'license_status',
                'license_valid_till', 'date_of_birth', 'blood_group', 'created_at', 'updated_at'
            ]
            
            missing = [f for f in doctor_fields if f not in existing]
            if missing:
                print(f"[TEST] Missing doctor field columns: {missing}")
                
                # Add missing columns
                for field in missing:
                    if field in ['years_of_experience']:
                        col_type = "INTEGER"
                    elif field in ['created_at', 'updated_at']:
                        col_type = "DATETIME DEFAULT CURRENT_TIMESTAMP"
                    elif field in ['license_number', 'registration_number']:
                        col_type = "VARCHAR UNIQUE"
                    else:
                        col_type = "VARCHAR"
                    
                    try:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {field} {col_type}"))
                        print(f"[TEST] Added column: {field} ({col_type})")
                    except Exception as e:
                        print(f"[TEST] Column already exists: {field}")
                
                conn.commit()
            else:
                print("[TEST] All doctor field columns exist")
        
        # Verify all columns now
        with engine.connect() as conn:
            pragma = conn.execute(text("PRAGMA table_info('users')"))
            existing = {row['name'] for row in pragma.mappings()}
            print(f"\n[TEST] Final user columns: {sorted(existing)}")
            
except Exception as e:
    print(f"[TEST] Error during schema check: {e}")

# Test creating a test user
print("\n[TEST] Testing user creation...")
try:
    db = SessionLocal()
    
    # Try to create a test user
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    test_user = models.User(
        name="Test User",
        email=f"test@test.com",
        password=pwd_context.hash("password"),
        role="patient",
        dob="1990-01-01",
        phone="1234567890",
        emergency_contact="9876543210",
        age=34,
        gender="Male",
        bloodgroup="O+",
        abha_id="TEST123",
        allergy="None",
        profile_picture_url=None,
        full_name="Test User Full",
        specialization=None,
        years_of_experience=None,
        languages_spoken=None,
        license_number=None,
        registration_number=None,
        hospital_name=None,
        license_status=None,
        license_valid_till=None,
        date_of_birth="1990-01-01",
        blood_group="O+",
    )
    
    db.add(test_user)
    db.commit()
    print(f"[TEST] Test user created successfully: {test_user.id}")
    
    # Try to query it back
    queried = db.query(models.User).filter(models.User.email == f"test@test.com").first()
    if queried:
        print(f"[TEST] Test user queried successfully: {queried.id}")
    else:
        print("[TEST] ERROR: Could not query test user")
    
    db.close()
    
except Exception as e:
    print(f"[TEST] Error during user creation: {e}")
    import traceback
    traceback.print_exc()

print("\n[TEST] Database test complete!")
