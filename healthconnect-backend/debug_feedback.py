#!/usr/bin/env python3
"""
Debug script to check all users, prescriptions, feedback, and find the issue
"""
import sys
sys.path.insert(0, '.')
from database import SessionLocal
from models import User, Prescription, Feedback

db = SessionLocal()

print("=" * 80)
print("📋 USER ACCOUNTS")
print("=" * 80)
users = db.query(User).all()
for u in users:
    print(f"  ID: {u.id} | Name: {u.name} | Email: {u.email} | Role: {u.role}")

print("\n" + "=" * 80)
print("📝 PRESCRIPTIONS")
print("=" * 80)
prescriptions = db.query(Prescription).all()
for p in prescriptions:
    patient = db.query(User).filter(User.id == p.patient_id).first()
    doctor = db.query(User).filter(User.id == p.doctor_id).first()
    print(f"  ID: {p.id} | Patient: {patient.email if patient else 'N/A'} | Doctor: {doctor.email if doctor else 'N/A'} | Diagnosis: {p.diagnosis} | Created: {p.created_at}")

print("\n" + "=" * 80)
print("⭐ FEEDBACK (ALL)")
print("=" * 80)
feedbacks = db.query(Feedback).all()
if feedbacks:
    for fb in feedbacks:
        patient = db.query(User).filter(User.id == fb.patient_id).first()
        doctor = db.query(User).filter(User.id == fb.doctor_id).first()
        print(f"  ID: {fb.id}")
        print(f"  Patient: {patient.email if patient else 'N/A'} ({fb.patient_id})")
        print(f"  Doctor: {doctor.email if doctor else 'N/A'} ({fb.doctor_id})")
        print(f"  Rating: {fb.rating}/5")
        print(f"  Text: {fb.feedback_text}")
        print(f"  Created: {fb.created_at}")
        print()
else:
    print("  ❌ NO FEEDBACK FOUND IN DATABASE!")

print("\n" + "=" * 80)
print("💡 ANALYSIS")
print("=" * 80)

# Find patient email
patient = db.query(User).filter(User.email.like('%pradeepkumarawasthi67%')).first()
if patient:
    print(f"✓ Patient Found: {patient.email} (ID: {patient.id})")
    # Find doctor email
    doctor = db.query(User).filter(User.email.like('%pradeepk.ic.24@nitj.ac.in%')).first()
    if doctor:
        print(f"✓ Doctor Found: {doctor.email} (ID: {doctor.id})")
        # Check if they have a prescription together
        prescription = db.query(Prescription).filter(
            Prescription.patient_id == patient.id,
            Prescription.doctor_id == doctor.id
        ).first()
        if prescription:
            print(f"✓ Prescription Found: ID {prescription.id}")
            # Check feedback for this prescription
            feedback = db.query(Feedback).filter(
                Feedback.prescription_id == prescription.id,
                Feedback.patient_id == patient.id,
                Feedback.doctor_id == doctor.id
            ).all()
            if feedback:
                print(f"✓ Feedback Found: {len(feedback)} record(s)")
                for fb in feedback:
                    print(f"  - Rating: {fb.rating}/5, Text: {fb.feedback_text}, Created: {fb.created_at}")
            else:
                print(f"❌ NO FEEDBACK for this prescription!")
        else:
            print(f"❌ NO PRESCRIPTION between these users!")
    else:
        print(f"❌ Doctor NOT found!")
else:
    print(f"❌ Patient NOT found!")

db.close()
