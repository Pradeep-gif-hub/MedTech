#!/usr/bin/env python3
"""
Verification script to check if analytics data is real and flowing correctly
"""

import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import and_

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Prescription, User, Feedback, Notification

def verify_analytics_data():
    """Verify that real data is in the database"""
    db = SessionLocal()
    
    try:
        print("\n" + "="*60)
        print("ANALYTICS DATA VERIFICATION REPORT")
        print("="*60)
        
        # Get current month
        now = datetime.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        print(f"\n📅 Current Month: {month_start.strftime('%B %Y')}")
        print(f"🔍 Checking data from: {month_start.isoformat()}")
        
        # Get all doctors
        doctors = db.query(User).filter(User.role == "doctor").all()
        print(f"\n👨‍⚕️ Total Doctors: {len(doctors)}")
        
        for doctor in doctors:
            print(f"\n" + "-"*60)
            print(f"📊 DOCTOR: {doctor.name} (ID: {doctor.id})")
            print("-"*60)
            
            # Count prescriptions this month
            prescriptions_this_month = db.query(Prescription).filter(
                and_(
                    Prescription.doctor_id == doctor.id,
                    Prescription.created_at >= month_start
                )
            ).all()
            
            print(f"  📋 Prescriptions This Month: {len(prescriptions_this_month)}")
            
            if prescriptions_this_month:
                print(f"     Diagnoses issued:")
                diagnosis_count = {}
                for p in prescriptions_this_month:
                    diagnosis = p.diagnosis or "Unknown"
                    diagnosis_count[diagnosis] = diagnosis_count.get(diagnosis, 0) + 1
                
                for diagnosis, count in sorted(diagnosis_count.items(), key=lambda x: x[1], reverse=True):
                    print(f"       • {diagnosis}: {count} cases")
            
            # Count feedback this month
            feedback_this_month = db.query(Feedback).filter(
                and_(
                    Feedback.doctor_id == doctor.id,
                    Feedback.created_at >= month_start
                )
            ).all()
            
            print(f"\n  ⭐ Feedback Received This Month: {len(feedback_this_month)}")
            
            if feedback_this_month:
                avg_rating = sum(f.rating for f in feedback_this_month) / len(feedback_this_month)
                print(f"     Average Rating: {avg_rating:.1f}/5")
                
                print(f"     Patient Reviews:")
                for fb in feedback_this_month:
                    patient = db.query(User).filter(User.id == fb.patient_id).first()
                    stars = "⭐" * fb.rating
                    print(f"       {stars} {patient.name if patient else 'Anonymous'}: {fb.feedback_text or '(no comment)'}")
            else:
                print(f"     No feedback received yet")
            
            # Count unique patients
            unique_patients = db.query(func.count(func.distinct(Prescription.patient_id))).filter(
                and_(
                    Prescription.doctor_id == doctor.id,
                    Prescription.created_at >= month_start
                )
            ).scalar() or 0
            
            print(f"\n  👥 Unique Patients This Month: {unique_patients}")
        
        print("\n" + "="*60)
        print("✓ VERIFICATION COMPLETE")
        print("="*60)
        
        # Summary
        total_prescriptions = db.query(Prescription).filter(
            Prescription.created_at >= month_start
        ).count()
        total_feedback = db.query(Feedback).filter(
            Feedback.created_at >= month_start
        ).count()
        
        print(f"\n📈 SUMMARY THIS MONTH:")
        print(f"  • Total Prescriptions: {total_prescriptions}")
        print(f"  • Total Feedback: {total_feedback}")
        print(f"  • Feedback Rate: {(total_feedback/max(total_prescriptions, 1)*100):.1f}%")
        
        if total_prescriptions == 0:
            print("\n⚠️  NO PRESCRIPTIONS IN DATABASE THIS MONTH")
            print("   To test: Create a prescription in the doctor dashboard")
            print("   Then submit feedback in the patient notifications")
        
        if total_feedback == 0:
            print("\n⚠️  NO FEEDBACK IN DATABASE THIS MONTH")
            print("   Feedback will appear after patients submit ratings")
        
    finally:
        db.close()

if __name__ == "__main__":
    from sqlalchemy import func
    verify_analytics_data()
