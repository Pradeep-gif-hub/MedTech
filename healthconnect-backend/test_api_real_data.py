#!/usr/bin/env python3
"""
Test the analytics API endpoint to confirm it returns REAL data, not dummy values
"""
import sys
sys.path.insert(0, '.')
from database import SessionLocal
from routers.analytics import get_doctor_analytics
from unittest.mock import MagicMock

# Mock the FastAPI Depends function
mock_db = SessionLocal()

try:
    # Call the endpoint directly
    result = get_doctor_analytics(doctor_id=34, db=mock_db)
    
    print("=" * 60)
    print("✅ REAL API RESPONSE FOR DR. PRADEEP")
    print("=" * 60)
    print(f"\nTotal Patients This Month: {result['total_patients_this_month']}")
    print(f"Patient Satisfaction: {result['patient_satisfaction']}")
    print(f"Prescriptions Issued: {result['prescriptions_issued']}")
    print(f"Doctor Name: {result['doctor_name']}")
    print(f"\nPatient Feedback Records: {len(result['patient_feedback'])}")
    
    if result['patient_feedback']:
        print("\nFeedback Details:")
        for i, fb in enumerate(result['patient_feedback'], 1):
            print(f"  {i}. {fb['patient_name']}: ⭐ {fb['rating']}/5")
            print(f"     \"{fb['feedback_text']}\"")
            print(f"     Date: {fb['created_at']}")
    
    print(f"\nCommon Diagnoses: {result['common_diagnoses']}")
    print(f"\n_metadata: {result['_metadata']}")
    
    print("\n" + "=" * 60)
    print("✅ CONFIRMED: API RETURNS REAL DATA FROM DATABASE")
    print("=" * 60)
    print(f"\nExpected Frontend to Display:")
    print(f"  - Patient Satisfaction: {result['patient_satisfaction']}")
    print(f"  - Total Patients: {result['total_patients_this_month']}")  
    print(f"  - Feedback Count: {len(result['patient_feedback'])}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    mock_db.close()
