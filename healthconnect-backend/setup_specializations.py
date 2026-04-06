import sqlite3

conn = sqlite3.connect('healthconnect.db')
cursor = conn.cursor()

# Add specializations to doctors so they can be matched
specializations = {
    30: 'General Medicine',
    22: 'Respiratory',  # For Asthma
    2: 'Neurology',
    34: 'Cardiology',   # Already has this
    35: 'Dermatology'
}

print("Setting up specializations for doctors...\n")
for doctor_id, spec in specializations.items():
    cursor.execute("UPDATE users SET specialization = ? WHERE id = ? AND role = 'doctor'", 
                   (spec, doctor_id))
    print(f"✓ Doctor {doctor_id}: Specialization set to '{spec}'")

conn.commit()

# Verify the update
print("\n=== UPDATED DOCTORS ===")
cursor.execute("SELECT id, email, full_name, specialization FROM users WHERE role='doctor'")
doctors = cursor.fetchall()
for doc in doctors:
    print(f"  Doctor {doc[0]}: {doc[2]} | Spec: '{doc[3]}'")

conn.close()
