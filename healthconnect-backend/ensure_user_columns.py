"""One-off migration helper: ensure expected columns exist on the users table.

Run this script once to add missing columns used by the app (safe: checks PRAGMA before ALTER).
"""
from database import engine
from sqlalchemy import text

def ensure_columns():
    with engine.connect() as conn:
        try:
            pragma = conn.execute(text("PRAGMA table_info('users')"))
            existing = {row['name'] for row in pragma.mappings()}

            # desired columns and their SQL types
            desired = {
                'allergies': 'VARCHAR',
                'medications': 'VARCHAR',
                'surgeries': 'VARCHAR',
                'age': 'INTEGER',
                'gender': 'VARCHAR',
                'bloodgroup': 'VARCHAR',
                'allergy': 'VARCHAR',
                'profile_picture_url': 'VARCHAR'
            }

            added = []
            for col, coltype in desired.items():
                if col not in existing:
                    sql = f"ALTER TABLE users ADD COLUMN {col} {coltype}"
                    try:
                        conn.execute(text(sql))
                        added.append(col)
                    except Exception as e:
                        print(f"Failed to add column {col}: {e}")

            if added:
                print(f"Added missing user columns: {added}")
            else:
                print("No missing user columns detected")

        except Exception as e:
            print(f"ensure_columns failed: {e}")

if __name__ == '__main__':
    ensure_columns()
