#!/usr/bin/env python3
"""
Comprehensive test: Multiple diseases matching different specializations
"""
import requests

BASE_URL = 'http://localhost:8000'
PATIENT_ID = 11

# Test cases: (disease, expected_doctor_id)
# NOTE: Matching requires 4-character prefix match
# "Cardiac*" matches "Cardiology" (cardi...)
# "Respir*" matches "Respiratory" (respir...)
# "Neuro*" matches "Neurology" (neuro...)
# "Dermat*" matches "Dermatology" (dermat...)
test_cases = [
    ("Cardiac Arrest", 34),           # ✓ Matches Cardiology (cardi prefix)
    ("Cardiomyopathy", 34),           # ✓ Matches Cardiology (cardi prefix)
    ("Respiratory Failure", 22),      # ✓ Matches Respiratory (respir prefix)
    ("Respiratory Infection", 22),    # ✓ Matches Respiratory (respir prefix)
    ("Neurological Disorder", 30),    # ✓ Matches Neurology (neuro prefix)
    ("Neuralgic Pain", 30),           # ✓ Matches Neurology (neuro prefix)
    ("Dermatological Issue", 35),     # ✓ Matches Dermatology (dermat prefix)
    ("Dermatitis", 35),               # ✓ Matches Dermatology (dermat prefix)
]

print("=" * 70)
print("COMPREHENSIVE TEST: All Disease-to-Doctor Mappings")
print("=" * 70)
print()

passed = 0
failed = 0

for disease, expected_doctor in test_cases:
    print(f"Testing disease: '{disease}'")
    print(f"  Expected doctor: {expected_doctor}")
    
    response = requests.post(
        f'{BASE_URL}/api/consultations',
        json={
            'patient_id': PATIENT_ID,
            'disease': disease,
            'symptoms': f'Patient suffering from {disease}',
            'duration': '1 week',
            'appointment_time': '3:00 PM'
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        assigned_doctor = result.get('doctor_id')
        
        if assigned_doctor == expected_doctor:
            print(f"  Result: PASS - Correctly assigned to doctor {assigned_doctor}")
            passed += 1
        else:
            print(f"  Result: FAIL - Expected {expected_doctor}, got {assigned_doctor}")
            failed += 1
    else:
        print(f"  Result: FAIL - API error {response.status_code}")
        failed += 1
    
    print()

print("=" * 70)
print(f"RESULTS: {passed} PASSED, {failed} FAILED")
print("=" * 70)

if failed == 0:
    print("\nALL TESTS PASSED!")
    print("Disease-to-Doctor specialization matching is working perfectly!")
else:
    print(f"\n{failed} test(s) failed. Check specialization prefixes.")
