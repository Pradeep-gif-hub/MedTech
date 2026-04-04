#!/usr/bin/env python3
"""
Check the actual prescription and feedback relationship
"""
import sys
sys.path.insert(0, '.')
from database import SessionLocal
from models import User, Prescription, Feedback
from datetime import datetime, timedelta

db = SessionLocal()

print("=" * 80)
print("🔍 CURRENT SETUP")
print("=" * 80)

# The doctor in the system
doctor = db.query(User).filter(User.email == 'pradeepkumarawasthi67@gmail.com').first()
print(f"\nDoctor Account:")
print(f"  Email: {doctor.email}")
print(f"  ID: {doctor.id}")
print(f"  Name: {doctor.name}")

# Check what prescriptions this doctor has issued
doctor_prescriptions = db.query(Prescription).filter(Prescription.doctor_id == doctor.id).all()
print(f"\nPrescriptions from this doctor: {len(doctor_prescriptions)}")
for p in doctor_prescriptions:
    patient = db.query(User).filter(User.id == p.patient_id).first()
    print(f"  - Prescription ID: {p.id}")
    print(f"    Patient: {patient.email} ({patient.name})")
    print(f"    Created: {p.created_at}")
    
    # Check feedback for this prescription
    fb = db.query(Feedback).filter(Feedback.prescription_id == p.id).all()
    print(f"    Feedback on this prescription: {len(fb)} records")

# Check all feedback for this doctor
print(f"\n📊 All feedback received by this doctor:")
all_feedback = db.query(Feedback).filter(Feedback.doctor_id == doctor.id).all()
print(f"Total feedback: {len(all_feedback)}")

# Group by patient
feedback_by_patient = {}
for fb in all_feedback:
    patient = db.query(User).filter(User.id == fb.patient_id).first()
    patient_email = patient.email if patient else "Unknown"
    if patient_email not in feedback_by_patient:
        feedback_by_patient[patient_email] = []
    feedback_by_patient[patient_email].append(fb)

for patient_email, feedbacks in feedback_by_patient.items():
    print(f"\n  Patient: {patient_email}")
    for fb in feedbacks:
        print(f"    - Rating: {fb.rating}/5, Text: \"{fb.feedback_text}\", Created: {fb.created_at}")

# Check if feedback is being returned by the API correctly
print("\n" + "=" * 80)
print("🧪 TESTING API QUERY")
print("=" * 80)

now = datetime.now()
month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

feedback_records = db.query(Feedback, User).filter(
    Feedback.doctor_id == doctor.id,
    Feedback.created_at >= month_start,
    Feedback.patient_id == User.id
).order_by(Feedback.created_at.desc()).limit(10).all()

print(f"\nFeedback for doctor {doctor.id} this month ({month_start.strftime('%B %Y')}): {len(feedback_records)}")
for feedback, patient in feedback_records:
    print(f"  - Patient: {patient.name} | Rating: {feedback.rating}/5 | Text: \"{feedback.feedback_text}\"")

db.close()
