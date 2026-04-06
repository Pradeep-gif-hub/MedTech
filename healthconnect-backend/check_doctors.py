import sqlite3

conn = sqlite3.connect('healthconnect.db')
cursor = conn.cursor()

print('\n=== DOCTORS IN DATABASE ===')
cursor.execute("SELECT id, email, role, specialization FROM users WHERE role='doctor' LIMIT 10")
rows = cursor.fetchall()
for row in rows:
    print(f'  ID: {row[0]}, Email: {row[1]}, Specialization: {row[3]}')

print('\n=== CONSULTATIONS IN DATABASE ===')
cursor.execute("SELECT id, patient_id, doctor_id, disease, status FROM consultations LIMIT 10")
rows = cursor.fetchall()
for row in rows:
    print(f'  ID: {row[0]}, Patient: {row[1]}, Doctor: {row[2]}, Disease: {row[3]}, Status: {row[4]}')

print('\n=== PATIENTS IN DATABASE ===')
cursor.execute("SELECT id, email, role FROM users WHERE role='patient' LIMIT 5")
rows = cursor.fetchall()
for row in rows:
    print(f'  ID: {row[0]}, Email: {row[1]}')

conn.close()
