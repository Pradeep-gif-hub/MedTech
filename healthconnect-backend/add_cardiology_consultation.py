import sqlite3
from datetime import datetime

conn = sqlite3.connect('healthconnect.db')
cursor = conn.cursor()

# Insert a new consultation with "Cardiology" to match doctor 34
print("Inserting consultation with Cardiology disease...")
cursor.execute("""
    INSERT INTO consultations (patient_id, doctor_id, disease, symptoms, duration, appointment_time, status, created_at, updated_at)
    VALUES (5, NULL, 'Cardiology', 'Chest pain and shortness of breath', '3 days', '2:30 PM', 'waiting', datetime('now'), datetime('now'))
""")
conn.commit()

print("\nAll consultations in database:")
cursor.execute("SELECT id, patient_id, doctor_id, disease, symptoms, status, created_at FROM consultations")
rows = cursor.fetchall()
for row in rows:
    print(f'  ID: {row[0]}, Patient: {row[1]}, Doctor: {row[2]}, Disease: {row[3]}, Symptoms: {row[4]}, Status: {row[5]}')

print("\nLet's verify doctor specializations match:")
cursor.execute("SELECT id, email, specialization FROM users WHERE role='doctor' ORDER BY id")
docs = cursor.fetchall()
for doc in docs:
    if doc[2]:  # Has specialization
        print(f"  Doctor {doc[0]}: Specialization='{doc[2]}'")

conn.close()
