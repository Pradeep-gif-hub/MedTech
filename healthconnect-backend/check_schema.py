from database import engine
from sqlalchemy import text, inspect

inspector = inspect(engine)
tables = inspector.get_table_names()
print("Tables:", tables)

if 'prescriptions' in tables:
    columns = inspector.get_columns('prescriptions')
    print("\nPrescriptions table columns:")
    for col in columns:
        print(f"  - {col['name']}: {col['type']}")
else:
    print("\nPrescriptions table does not exist")
