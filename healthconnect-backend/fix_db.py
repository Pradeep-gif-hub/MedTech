#!/usr/bin/env python
"""
Quick fix script to add all missing doctor profile columns to users table
"""
import sys
sys.path.insert(0, '.')

from sqlalchemy import text, inspect
from database import engine

print("[FIX] Adding missing doctor profile columns to users table...")

try:
    with engine.connect() as conn:
        # Get existing columns
        inspector = inspect(engine)
        existing_cols = {col['name'] for col in inspector.get_columns('users')}
        print(f"[FIX] Current columns: {len(existing_cols)}")
        
        # Define all new columns to add
        new_columns = {
            'full_name': 'VARCHAR',
            'specialization': 'VARCHAR',
            'years_of_experience': 'INTEGER',
            'languages_spoken': 'VARCHAR',
            'license_number': 'VARCHAR',
            'registration_number': 'VARCHAR',
            'hospital_name': 'VARCHAR',
            'license_status': 'VARCHAR',
            'license_valid_till': 'VARCHAR',
            'date_of_birth': 'VARCHAR',
            'blood_group': 'VARCHAR',
            'created_at': 'DATETIME DEFAULT CURRENT_TIMESTAMP',
            'updated_at': 'DATETIME DEFAULT CURRENT_TIMESTAMP',
        }
        
        added_count = 0
        for col_name, col_type in new_columns.items():
            if col_name not in existing_cols:
                # Add UNIQUE constraint for license/registration numbers
                if col_name in ['license_number', 'registration_number']:
                    col_type = f"{col_type} UNIQUE"
                
                try:
                    sql = f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"
                    conn.execute(text(sql))
                    print(f"[FIX] ✓ Added column: {col_name}")
                    added_count += 1
                except Exception as e:
                    print(f"[FIX] ✗ Failed to add {col_name}: {str(e)}")
            else:
                print(f"[FIX] - Column already exists: {col_name}")
        
        conn.commit()
        print(f"\n[FIX] SUCCESS: Added {added_count} columns")
        
        # Verify all columns now exist
        inspector = inspect(engine)
        final_cols = {col['name'] for col in inspector.get_columns('users')}
        print(f"[FIX] Final column count: {len(final_cols)}")
        
except Exception as e:
    print(f"[FIX] ERROR: {e}")
    import traceback
    traceback.print_exc()
