#!/usr/bin/env python3
"""
Quick diagnostic script to verify MedTech localhost setup
Run this from healthconnect-backend directory
"""

import sys
import os
from pathlib import Path

def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def check_imports():
    """Check if all required packages are installed"""
    print_header("1️⃣  CHECKING IMPORTS")
    
    packages = {
        'FastAPI': 'fastapi',
        'SQLAlchemy': 'sqlalchemy',
        'Pydantic': 'pydantic',
        'Python JWT': 'jwt',
        'Google Auth': 'google.oauth2',
        'Bcrypt': 'bcrypt',
        'Uvicorn': 'uvicorn',
    }
    
    all_ok = True
    for name, module in packages.items():
        try:
            __import__(module)
            print(f"✓ {name:20} installed")
        except ImportError as e:
            print(f"✗ {name:20} MISSING - {e}")
            all_ok = False
    
    return all_ok

def check_database():
    """Check if database is properly initialized"""
    print_header("2️⃣  CHECKING DATABASE")
    
    try:
        from database import engine, SessionLocal
        from models import User, Prescription, Inventory
        from sqlalchemy import text
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("✓ Database connection successful")
        
        # Check tables
        db = SessionLocal()
        user_count = db.query(User).count()
        print(f"✓ Users table exists ({user_count} users)")
        
        prescription_count = db.query(Prescription).count()
        print(f"✓ Prescriptions table exists ({prescription_count} prescriptions)")
        
        inventory_count = db.query(Inventory).count()
        print(f"✓ Inventory table exists ({inventory_count} items)")
        
        db.close()
        
        # Check database file location
        db_path = Path('./healthconnect.db')
        if db_path.exists():
            size_mb = db_path.stat().st_size / (1024 * 1024)
            print(f"✓ Database file: {db_path.absolute()} ({size_mb:.2f} MB)")
        else:
            print("⚠️  Database file not found at ./healthconnect.db")
        
        return True
        
    except Exception as e:
        print(f"✗ Database error: {e}")
        print("  Run: python init_pharmacy_db.py")
        return False

def check_auth():
    """Check if Google Auth is configured"""
    print_header("3️⃣  CHECKING GOOGLE AUTH")
    
    try:
        from utils.auth import verify_google_token, GOOGLE_CLIENT_ID
        
        if GOOGLE_CLIENT_ID:
            print(f"✓ GOOGLE_CLIENT_ID set: {GOOGLE_CLIENT_ID[:30]}...")
        else:
            print("⚠️  GOOGLE_CLIENT_ID not set")
            print("  Add to .env: GOOGLE_CLIENT_ID=your-client-id")
        
        print("✓ verify_google_token function exists")
        return True
        
    except Exception as e:
        print(f"✗ Auth error: {e}")
        return False

def check_environment():
    """Check environment variables"""
    print_header("4️⃣  CHECKING ENVIRONMENT")
    
    env_vars = {
        'GOOGLE_CLIENT_ID': 'Google OAuth Client ID',
        'DATABASE_URL': 'PostgreSQL URL (optional, uses SQLite if not set)',
        'SECRET_KEY': 'JWT Secret Key (optional)',
    }
    
    for key, description in env_vars.items():
        value = os.getenv(key)
        if value:
            if 'SECRET' in key or 'PASSWORD' in key:
                print(f"✓ {key:20} set (hidden for security)")
            else:
                print(f"✓ {key:20} set")
        else:
            print(f"  {key:20} not set ({description})")
    
    return True

def check_cors():
    """Check CORS configuration"""
    print_header("5️⃣  CHECKING CORS CONFIGURATION")
    
    try:
        with open('./main.py', 'r') as f:
            content = f.read()
            
        if 'localhost:5173' in content or '127.0.0.1:5173' in content:
            print("✓ Frontend origin (localhost:5173) in CORS config")
        else:
            print("✗ Frontend origin NOT in CORS config")
            print("  Add http://localhost:5173 to cors_origins in main.py")
            return False
        
        if 'localhost:8000' in content:
            print("✓ Backend origin (localhost:8000) in CORS config")
        
        return True
        
    except FileNotFoundError:
        print("✗ main.py not found")
        return False
    except Exception as e:
        print(f"✗ Error reading main.py: {e}")
        return False

def check_models():
    """Check if models are properly defined"""
    print_header("6️⃣  CHECKING DATA MODELS")
    
    try:
        from models import User, Prescription, Inventory
        
        # Check User model
        print("✓ User model defined")
        
        # Check Prescription model
        print("✓ Prescription model defined")
        
        # Check Inventory model
        print("✓ Inventory model defined")
        
        # Check for pharmacy fields
        from sqlalchemy import inspect
        from database import engine
        
        inspector = inspect(engine)
        if 'prescriptions' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('prescriptions')]
            
            if 'pharmacy_status' in columns:
                print("✓ pharmacy_status field in prescriptions")
            else:
                print("⚠️  pharmacy_status field NOT in prescriptions")
            
            if 'status' in columns:
                print("✓ status field in prescriptions")
            else:
                print("⚠️  status field NOT in prescriptions")
        
        return True
        
    except Exception as e:
        print(f"✗ Model error: {e}")
        return False

def main():
    print("\n" + "="*60)
    print("  🔍 MedTech Localhost Diagnostic Report")
    print("="*60)
    
    checks = [
        ("Imports", check_imports),
        ("Database", check_database),
        ("Google Auth", check_auth),
        ("Environment", check_environment),
        ("CORS Config", check_cors),
        ("Data Models", check_models),
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n✗ Error checking {name}: {e}")
            results.append((name, False))
    
    # Summary
    print_header("📊 SUMMARY")
    
    all_ok = True
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}  {name}")
        if not result:
            all_ok = False
    
    # Recommendations
    print_header("🎯 NEXT STEPS")
    
    if all_ok:
        print("✓ All checks passed!")
        print("\nYou're ready to:")
        print("  1. Start backend: python main.py")
        print("  2. Start frontend: npm run dev")
        print("  3. Open http://localhost:5173")
        print("  4. Test Google login")
    else:
        print("⚠️  Some checks failed. Please review errors above.")
        print("\nCommon fixes:")
        print("  • Database: python init_pharmacy_db.py")
        print("  • Packages: pip install -r requirements.txt")
        print("  • CORS: Add localhost:5173 to cors_origins in main.py")
    
    print("\n" + "="*60)
    print(f"  Report generated at: {Path.cwd()}")
    print("="*60 + "\n")
    
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(main())
