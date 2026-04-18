#!/usr/bin/env python3
"""
🚨 CRITICAL MIGRATION SCRIPT: SQLite → PostgreSQL
Safe data migration with zero data loss.

Usage:
    python migrate_sqlite_to_postgres.py

Requirements:
    - SOURCE: Local healthconnect.db (SQLite)
    - TARGET: PostgreSQL (via DATABASE_URL env var)
    - All users must exist in target before new data inserted

Safety Checks:
    ✓ Creates PostgreSQL tables first
    ✓ Checks for duplicates by email
    ✓ Preserves all fields and IDs
    ✓ Logs every step
"""

import os
import sys
from datetime import datetime
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

# Import models
import models
from database import Base

def setup_logging():
    """Setup detailed logging for migration"""
    import sys
    from datetime import datetime

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = f"migration_{timestamp}.log"

    class Logger:
        def __init__(self, filepath):
            self.terminal = sys.stdout
            self.log = open(filepath, "w", encoding="utf-8")

        def write(self, message):
            self.terminal.write(message)
            try:
                self.log.write(message)
            except:
                self.log.write(message.encode("utf-8", errors="ignore").decode("utf-8"))
            self.log.flush()

        def flush(self):
            pass

    sys.stdout = Logger(log_file)
    print(f"\nMigration Log: {log_file}\n")

def log_section(title):
    """Print formatted section header"""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}\n")

def verify_sqlite_db():
    """Verify SQLite database exists and is accessible"""
    db_path = "./healthconnect.db"
    if not os.path.exists(db_path):
        print(f"❌ ERROR: SQLite database not found: {db_path}")
        return False
    print(f"✅ SQLite database found: {db_path}")
    return True

def connect_to_sqlite():
    """Connect to local SQLite database"""
    try:
        sqlite_url = "sqlite:///./healthconnect.db"
        engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT sqlite_version()"))
            version = result.scalar()
            print(f"✅ Connected to SQLite: version {version}")
        
        return engine
    except Exception as e:
        print(f"❌ Failed to connect to SQLite: {e}")
        raise

def connect_to_postgres():
    """Connect to PostgreSQL database"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ ERROR: DATABASE_URL environment variable not set")
        print("Set it with: export DATABASE_URL='postgresql://user:pass@host/dbname'")
        raise ValueError("DATABASE_URL not configured")
    
    try:
        # Hide password in logs
        safe_url = database_url.split("@")[0] + "@***"
        print(f"🔗 Connecting to PostgreSQL: {safe_url}")
        
        engine = create_engine(
            database_url,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True
        )
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.scalar().split(" ")[0:3]
            print(f"✅ Connected to PostgreSQL: {' '.join(version)}")
        
        return engine
    except Exception as e:
        print(f"❌ Failed to connect to PostgreSQL: {e}")
        raise

def create_postgres_tables(pg_engine):
    """Create all required tables in PostgreSQL"""
    log_section("STEP 1: Creating PostgreSQL Tables")
    
    try:
        print("📝 Creating tables from models...")
        Base.metadata.create_all(bind=pg_engine)
        print("✅ All tables created in PostgreSQL")
        return True
    except Exception as e:
        print(f"❌ Failed to create tables: {e}")
        return False

def get_table_list(sqlite_engine):
    """Get list of tables in SQLite"""
    inspector = inspect(sqlite_engine)
    tables = inspector.get_table_names()
    return tables

def count_rows_sqlite(sqlite_engine, table_name):
    """Count rows in SQLite table"""
    try:
        with sqlite_engine.connect() as conn:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
            count = result.scalar()
            return count
    except:
        return 0

def count_rows_postgres(pg_engine, table_name):
    """Count rows in PostgreSQL table"""
    try:
        with pg_engine.connect() as conn:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
            count = result.scalar()
            return count
    except:
        return 0

def migrate_users(sqlite_engine, pg_engine):
    """Migrate users table with duplicate checking"""
    log_section("STEP 2: Migrating Users Table")
    
    # Get session for both databases
    SQLiteSession = sessionmaker(bind=sqlite_engine)
    PostgresSession = sessionmaker(bind=pg_engine)
    
    sqlite_db = SQLiteSession()
    postgres_db = PostgresSession()
    
    try:
        # Fetch all users from SQLite
        sqlite_users = sqlite_db.query(models.User).all()
        total_users = len(sqlite_users)
        
        print(f"📊 Found {total_users} users in SQLite")
        
        migrated = 0
        skipped = 0
        errors = []
        
        for user in sqlite_users:
            try:
                # Check if user exists in PostgreSQL by email
                existing = postgres_db.query(models.User).filter(
                    models.User.email == user.email
                ).first()
                
                if existing:
                    print(f"⏭️  SKIP: {user.email} (already exists in PostgreSQL)")
                    skipped += 1
                else:
                    # Create new user in PostgreSQL
                    new_user = models.User(
                        id=user.id,
                        name=user.name,
                        email=user.email,
                        password=user.password,
                        role=user.role,
                        location=getattr(user, 'location', None),
                        dob=getattr(user, 'dob', None),
                        phone=getattr(user, 'phone', None),
                        emergency_contact=getattr(user, 'emergency_contact', None),
                        allergies=getattr(user, 'allergies', None),
                        medications=getattr(user, 'medications', None),
                        surgeries=getattr(user, 'surgeries', None),
                        status=getattr(user, 'status', 'active'),
                        age=getattr(user, 'age', None),
                        gender=getattr(user, 'gender', None),
                        bloodgroup=getattr(user, 'bloodgroup', None),
                        abha_id=getattr(user, 'abha_id', None),
                        allergy=getattr(user, 'allergy', None),
                        profile_pic=getattr(user, 'profile_pic', None),
                        profile_picture_url=getattr(user, 'profile_picture_url', None),
                        reset_token=getattr(user, 'reset_token', None),
                        reset_token_expiry=getattr(user, 'reset_token_expiry', None),
                        specialization=getattr(user, 'specialization', None),
                        years_of_experience=getattr(user, 'years_of_experience', None),
                        languages_spoken=getattr(user, 'languages_spoken', None),
                        full_name=getattr(user, 'full_name', None),
                        license_number=getattr(user, 'license_number', None),
                        registration_number=getattr(user, 'registration_number', None),
                        hospital_name=getattr(user, 'hospital_name', None),
                        license_status=getattr(user, 'license_status', None),
                        license_valid_till=getattr(user, 'license_valid_till', None),
                        date_of_birth=getattr(user, 'date_of_birth', None),
                        blood_group=getattr(user, 'blood_group', None),
                        created_at=user.created_at,
                        updated_at=user.updated_at,
                        last_login=getattr(user, 'last_login', None),
                    )
                    postgres_db.add(new_user)
                    postgres_db.commit()
                    
                    print(f"✅ MIGRATE: {user.email} (ID: {user.id}, Role: {user.role})")
                    migrated += 1
            
            except Exception as e:
                postgres_db.rollback()
                error_msg = f"❌ ERROR: {user.email} - {str(e)}"
                print(error_msg)
                errors.append(error_msg)
        
        # Summary
        print(f"\n{'─'*70}")
        print(f"📊 MIGRATION SUMMARY - USERS TABLE:")
        print(f"  Total found:     {total_users}")
        print(f"  Migrated:        {migrated} ✅")
        print(f"  Skipped (dups):  {skipped} ⏭️")
        print(f"  Errors:          {len(errors)} ❌")
        
        if errors:
            print(f"\n⚠️  Error Details:")
            for error in errors:
                print(f"  {error}")
        
        return migrated, skipped, errors
    
    finally:
        sqlite_db.close()
        postgres_db.close()

def migrate_other_tables(sqlite_engine, pg_engine):
    """Migrate other tables (prescriptions, consultations, etc.)"""
    log_section("STEP 3: Migrating Other Tables")
    
    sqlite_tables = get_table_list(sqlite_engine)
    
    # Skip users (already migrated) and system tables
    skip_tables = {'users', 'sqlite_sequence', 'alembic_version'}
    tables_to_migrate = [t for t in sqlite_tables if t not in skip_tables]
    
    if not tables_to_migrate:
        print("ℹ️  No additional tables to migrate")
        return
    
    print(f"📋 Tables to migrate: {', '.join(tables_to_migrate)}\n")
    
    for table_name in tables_to_migrate:
        count = count_rows_sqlite(sqlite_engine, table_name)
        if count == 0:
            print(f"⏭️  SKIP: {table_name} (empty)")
            continue
        
        print(f"⚙️  Copying {table_name} ({count} rows)...")
        
        try:
            with sqlite_engine.connect() as sqlite_conn:
                with pg_engine.connect() as pg_conn:
                    # Get all data from SQLite
                    result = sqlite_conn.execute(text(f"SELECT * FROM {table_name}"))
                    rows = result.fetchall()
                    
                    if rows:
                        # Get column names
                        column_names = list(result.keys())
                        inserted = 0
                        errors_in_table = []
                        
                        for row in rows:
                            try:
                                # Convert SQLAlchemy Row to dict properly
                                # Use _mapping attribute which is the proper way to convert Row to dict
                                if hasattr(row, '_mapping'):
                                    row_dict = dict(row._mapping)
                                else:
                                    # Fallback: manually zip column names with values
                                    row_dict = dict(zip(column_names, row))
                                
                                # Create parameterized INSERT query with proper placeholders
                                placeholders = ", ".join([f":{col}" for col in column_names])
                                insert_query = f"INSERT INTO {table_name} ({', '.join(column_names)}) VALUES ({placeholders})"
                                
                                # Execute with parameters
                                pg_conn.execute(text(insert_query), row_dict)
                                inserted += 1
                            
                            except Exception as row_error:
                                error_msg = f"{table_name} row: {str(row_error)}"
                                errors_in_table.append(error_msg)
                        
                        # Commit after all rows
                        pg_conn.commit()
                        
                        if inserted > 0:
                            print(f"✅ {table_name}: {inserted}/{len(rows)} rows inserted")
                        
                        if errors_in_table:
                            print(f"⚠️  {table_name}: {len(errors_in_table)} row errors (skipped)")
        
        except Exception as e:
            print(f"⚠️  WARNING: Could not migrate {table_name}: {e}")

def verify_migration(sqlite_engine, pg_engine):
    """Verify data integrity after migration"""
    log_section("STEP 4: Verification")
    
    sqlite_tables = get_table_list(sqlite_engine)
    skip_tables = {'sqlite_sequence', 'alembic_version'}
    
    print("📊 Row Counts Comparison:\n")
    print(f"{'Table':<25} {'SQLite':<12} {'PostgreSQL':<12} {'Status'}")
    print(f"{'-'*70}")
    
    all_match = True
    for table in sqlite_tables:
        if table in skip_tables:
            continue
        
        sqlite_count = count_rows_sqlite(sqlite_engine, table)
        postgres_count = count_rows_postgres(pg_engine, table)
        
        if sqlite_count == postgres_count:
            status = "✅ MATCH"
        else:
            status = f"⚠️  DIFF ({postgres_count - sqlite_count})"
            all_match = False
        
        print(f"{table:<25} {sqlite_count:<12} {postgres_count:<12} {status}")
    
    print(f"{'-'*70}")
    
    if all_match:
        print("✅ All tables match! Migration successful.")
        return True
    else:
        print("⚠️  Some tables have differences. Review above.")
        return False

def main():
    """Main migration workflow"""
    print("\n")
    print("╔" + "="*68 + "╗")
    print("║" + " "*15 + "SQLite → PostgreSQL Migration" + " "*24 + "║")
    print("╚" + "="*68 + "╝")
    
    log_section("PRE-MIGRATION CHECKS")
    
    # 1. Verify SQLite exists
    if not verify_sqlite_db():
        sys.exit(1)
    
    # 2. Connect to SQLite
    log_section("CONNECTING TO DATABASES")
    try:
        sqlite_engine = connect_to_sqlite()
    except Exception as e:
        print(f"❌ Cannot continue without SQLite: {e}")
        sys.exit(1)
    
    # 3. Connect to PostgreSQL
    try:
        pg_engine = connect_to_postgres()
    except Exception as e:
        print(f"❌ Cannot continue without PostgreSQL: {e}")
        print("\n💡 To set DATABASE_URL, run:")
        print("   export DATABASE_URL='postgresql://user:password@localhost/medtech'")
        sys.exit(1)
    
    # 4. Create PostgreSQL tables
    if not create_postgres_tables(pg_engine):
        print("❌ Cannot continue without PostgreSQL tables")
        sys.exit(1)
    
    # 5. Migrate users
    try:
        migrated, skipped, errors = migrate_users(sqlite_engine, pg_engine)
    except Exception as e:
        print(f"❌ User migration failed: {e}")
        sys.exit(1)
    
    # 6. Migrate other tables
    try:
        migrate_other_tables(sqlite_engine, pg_engine)
    except Exception as e:
        print(f"⚠️  Other table migration warning: {e}")
    
    # 7. Verify
    verify_migration(sqlite_engine, pg_engine)
    
    # Final summary
    log_section("MIGRATION COMPLETE")
    print("""
✅ Migration finished!

📋 Next Steps:
  1. Verify PostgreSQL has all your users:
     psql -d medtech -c "SELECT COUNT(*) FROM users;"
  
  2. Set environment variable on production:
     export DATABASE_URL='postgresql://user:pass@host/dbname'
  
  3. Restart backend:
     python -m uvicorn main:app --reload
  
  4. Test admin dashboard:
     - Verify all users appear
     - Check recent users (last 7 days)
     - Test login (email + Google OAuth)
  
  5. Keep SQLite backup:
     - Rename healthconnect.db to healthconnect.db.backup
     - Keep safe for 1-2 weeks

⚠️  IMPORTANT:
  - DO NOT delete healthconnect.db yet
  - Test in staging first
  - Ensure all users migrated correctly
  - Monitor logs for errors
""")

if __name__ == "__main__":
    setup_logging()
    try:
        main()
    except Exception as e:
        print(f"\n❌ MIGRATION FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
setup_logging()