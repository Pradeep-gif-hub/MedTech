from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        # Check if doctor_id column already exists
        result = conn.execute(text("PRAGMA table_info(prescriptions)"))
        columns = {row[1] for row in result}
        
        if 'doctor_id' in columns:
            print("doctor_id column already exists")
        else:
            # Add doctor_id column
            conn.execute(text("ALTER TABLE prescriptions ADD COLUMN doctor_id INTEGER"))
            conn.commit()
            print("Successfully added doctor_id column to prescriptions table")
            
        # Verify final schema
        result = conn.execute(text("PRAGMA table_info(prescriptions)"))
        print("\nFinal prescriptions table columns:")
        for row in result:
            print(f"  - {row[1]}: {row[2]}")
    except Exception as e:
        print(f"Error: {e}")
