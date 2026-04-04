#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')
from database import SessionLocal
from sqlalchemy import func, and_, extract
from datetime import datetime, timedelta
from models import Prescription, User, Feedback

# Get DB session
db = SessionLocal()

# Get current month
now = datetime.now()
month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
prev_month_start = (month_start - timedelta(days=1)).replace(day=1)
prev_month_end = month_start - timedelta(seconds=1)

# Dr. Pradeep is ID 34
doctor_id = 34

# Get total patients this month
total_patients = db.query(func.count(func.distinct(Prescription.patient_id))).filter(
    Prescription.doctor_id == doctor_id,
    Prescription.created_at >= month_start
).scalar() or 0

# Get prescriptions issued this month
total_prescriptions = db.query(func.count(Prescription.id)).filter(
    Prescription.doctor_id == doctor_id,
    Prescription.created_at >= month_start
).scalar() or 0

# Get patient satisfaction (avg feedback rating)
avg_satisfaction = db.query(func.avg(Feedback.rating)).filter(
    Feedback.doctor_id == doctor_id,
    Feedback.created_at >= month_start
).scalar() or 0

# Get all feedback
feedback_list = db.query(Feedback).filter(
    Feedback.doctor_id == doctor_id,
    Feedback.created_at >= month_start
).all()

print('=== REAL ANALYTICS DATA FOR DR. PRADEEP (ID: 34) ===')
print(f'✓ Total Patients This Month: {total_patients}')
print(f'✓ Prescriptions Issued: {total_prescriptions}')
print(f'✓ Patient Satisfaction Average: {avg_satisfaction:.1f}/5')
print(f'✓ Total Feedback Submissions: {len(feedback_list)}')

if feedback_list:
    print('\nDetailed Feedback:')
    for i, fb in enumerate(feedback_list, 1):
        patient = db.query(User).filter(User.id == fb.patient_id).first()
        print(f'  #{i} - Patient: {patient.name if patient else "Unknown"}')
        print(f'       Rating: {fb.rating}/5 - "{fb.feedback_text}"')
        print(f'       Date: {fb.created_at}')

print('\n✅ ALL DATA IS FROM REAL DATABASE QUERIES - NO DUMMY VALUES')
