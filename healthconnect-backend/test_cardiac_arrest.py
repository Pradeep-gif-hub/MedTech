#!/usr/bin/env python3
"""
Test: Cardiac Arrest should match Cardiology (Doctor 34)
This tests the fixed bidirectional matching logic
"""
import requests

BASE_URL = 'http://localhost:8000'
PATIENT_ID = 11
DOCTOR_ID = 34  # Cardiology

print('=' * 70)
print('TEST: Cardiac Arrest Disease Matching')
print('=' * 70)

# STEP 1: Create consultation with Cardiac Arrest
print('\n[STEP 1] Creating consultation with disease=Cardiac Arrest')
print('  Expected: Doctor 34 (Cardiology) should be assigned')

response = requests.post(
    f'{BASE_URL}/api/consultations',
    json={
        'patient_id': PATIENT_ID,
        'disease': 'Cardiac Arrest',
        'symptoms': 'Loss of consciousness and unresponsiveness',
        'duration': '15 minutes',
        'appointment_time': '5:00 PM'
    }
)

if response.status_code == 200:
    result = response.json()
    consultation_id = result.get('id')
    assigned_doctor = result.get('doctor_id')
    print(f'  [PASS] Consultation created: ID={consultation_id}')
    print(f'  [INFO] Doctor Assigned: {assigned_doctor}')
    
    if assigned_doctor == DOCTOR_ID:
        print(f'  [PASS] Correct doctor assigned (Cardiology)')
    else:
        print(f'  [FAIL] Expected doctor 34, got {assigned_doctor}')
        exit(1)
else:
    print(f'  [FAIL] Status {response.status_code}: {response.text}')
    exit(1)

# STEP 2: Doctor fetches their queue
print(f'\n[STEP 2] Doctor {DOCTOR_ID} fetches their patient queue')

response = requests.get(
    f'{BASE_URL}/api/doctor/patient-queue',
    headers={'Authorization': f'Bearer local:{DOCTOR_ID}'}
)

if response.status_code == 200:
    queue = response.json()
    cardiac_arrests = [c for c in queue if c.get('disease') == 'Cardiac Arrest']
    
    print(f'  [INFO] Total consultations in queue: {len(queue)}')
    print(f'  [INFO] Cardiac Arrest consultations: {len(cardiac_arrests)}')
    
    if cardiac_arrests:
        for ca in cardiac_arrests:
            print(f'    - Patient: {ca.get("patient_name")}')
            print(f'    - Symptoms: {ca.get("symptoms")}')
            print(f'    - Status: {ca.get("status")}')
        print(f'  [PASS] Cardiac Arrest found in Doctor queue!')
    else:
        print(f'  [FAIL] Cardiac Arrest not in queue')
        exit(1)
else:
    print(f'  [FAIL] Status {response.status_code}')
    exit(1)

print('\n' + '=' * 70)
print('ALL TESTS PASSED!')
print('=' * 70)
print('\nSummary:')
print('  [PASS] Cardiac Arrest disease matched Cardiology specialization')
print('  [PASS] Doctor 34 can see Cardiac Arrest in their queue')
print('  [PASS] Bidirectional keyword matching working correctly!')
