import sqlite3

conn = sqlite3.connect('healthconnect.db')
cursor = conn.cursor()

print("Doctor 34 specialization check:")
cursor.execute("SELECT id, email, full_name, specialization FROM users WHERE id = 34")
doc = cursor.fetchone()
if doc:
    spec = doc[3]
    print(f"  ID: {doc[0]}")
    print(f"  Name: {doc[2]}")
    print(f"  Specialization: '{spec}' (length: {len(spec) if spec else 0})")
    print(f"  Bytes: {spec.encode() if spec else None}")
else:
    print("  Doctor 34 not found!")

conn.close()
