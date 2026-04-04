from database import SessionLocal
from models import User, Prescription, Notification
import json
import datetime

db = SessionLocal()
try:
    # Create prescription without going through API
    patient = db.query(User).filter(User.id == 32).first()
    doctor = db.query(User).filter(User.id == 2).first()
    
    print(f"Patient: {patient.name if patient else 'NOT FOUND'}")
    print(f"Doctor: {doctor.name if doctor else 'NOT FOUND'}")
    
    medications = json.dumps([{"name": "Amlodipine", "dosage": "5mg", "duration": "30 days"}])
    
    # Convert date string to date object
    date_value = datetime.date.fromisoformat("2026-04-04")
    
    new_prescription = Prescription(
        patient_id=32,
        doctor_id=2,
        diagnosis="Hypertension",
        instruction="Take one tablet daily",
        medications=medications,
        date=date_value,
    )
    db.add(new_prescription)
    db.flush()
    
    new_prescription.pdf_url = f"/api/prescriptions/pdf/{new_prescription.id}"
    db.commit()
    db.refresh(new_prescription)
    
    print(f"Prescription created: ID={new_prescription.id}, PDF URL={new_prescription.pdf_url}")
    
    # Try to create notification
    notification = Notification(
        user_id=32,
        type="prescription",
        message=f"New prescription received from Dr. {doctor.name}",
        related_prescription_id=new_prescription.id,
    )
    db.add(notification)
    db.commit()
    print(f"Notification created for patient {32}")
    print("SUCCESS: Prescription and notification created!")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
