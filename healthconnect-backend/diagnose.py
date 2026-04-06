import sqlite3

conn = sqlite3.connect('healthconnect.db')
cursor = conn.cursor()

print("\n=== ALL DOCTORS AND THEIR SPECIALIZATIONS ===")
cursor.execute("SELECT id, email, full_name, specialization FROM users WHERE role='doctor'")
doctors = cursor.fetchall()
for doc in doctors:
    spec = doc[3] if doc[3] else "NO SPECIALIZATION"
    print(f"  Doctor {doc[0]}: {doc[2]} | Email: {doc[1]} | Spec: '{spec}'")

print("\n=== ALL CONSULTATIONS IN DATABASE ===")
cursor.execute("SELECT id, patient_id, doctor_id, disease, status FROM consultations ORDER BY id DESC")
consults = cursor.fetchall()
for con in consults:
    doctor_str = f"Doctor {con[2]}" if con[2] else "NO DOCTOR (NULL)"
    print(f"  Consultation {con[0]}: Patient {con[1]}, {doctor_str}, Disease: {con[3]}, Status: {con[4]}")

print("\n=== ISSUE ANALYSIS ===")
print("Consultations with NULL doctor_id mean:")
print("  -> No doctor has a specialization matching the disease")
print("  -> Doctor won't see this consultation in their queue")
print("")
print("Solution: Make sure disease matches a doctor's specialization")

conn.close()
