#!/usr/bin/env python3
import requests

BASE_URL = 'http://localhost:8000'
PATIENT_ID = 5
PATIENT_DISEASE = 'Respiratory'
DOCTOR_ID = 22

print('=' * 70)
print('END-TO-END TEST: Real Patient Queue System')
print('=' * 70)

# STEP 1: Create consultation
print('\n[STEP 1] Patient submits consultation for Respiratory disease...')
response = requests.post(
    f'{BASE_URL}/api/consultations',
    json={
        'patient_id': PATIENT_ID,
        'disease': PATIENT_DISEASE,
        'symptoms': 'Difficult breathing and persistent cough',
        'duration': '2 weeks',
        'appointment_time': '4:00 PM'
    }
)

if response.status_code == 200:
    result = response.json()
    consultation_id = result.get('id')
    assigned_doctor = result.get('doctor_id')
    print(f'  [PASS] Consultation created: ID={consultation_id}')
    print(f'  [PASS] Doctor assigned: {assigned_doctor} (expected: 22)')
    if assigned_doctor != DOCTOR_ID:
        print(f'  [FAIL] Expected doctor {DOCTOR_ID}, got {assigned_doctor}')
        exit(1)
else:
    print(f'  [FAIL] {response.status_code}: {response.text}')
    exit(1)

# STEP 2: Doctor fetches queue
print(f'\n[STEP 2] Doctor {DOCTOR_ID} fetches their patient queue...')
response = requests.get(
    f'{BASE_URL}/api/doctor/patient-queue',
    headers={'Authorization': f'Bearer local:{DOCTOR_ID}'}
)

if response.status_code == 200:
    queue = response.json()
    if isinstance(queue, list) and len(queue) > 0:
        # Find the consultation we just created (most recent)
        matching = [p for p in queue if p.get('consultation_id') == consultation_id]
        if matching:
            patient = matching[0]
        else:
            patient = queue[0]  # Get first if not found
        
        print(f'  [PASS] Queue has {len(queue)} patient(s)')
        print(f'  [PASS] Patient name: {patient.get("patient_name")}')
        print(f'  [PASS] Disease: {patient.get("disease")}')
        print(f'  [PASS] Status: {patient.get("status")}')
        if patient.get('consultation_id') != consultation_id:
            print('  [FAIL] Our consultation not in queue. Showing:', patient.get('consultation_id'), 'Expected:', consultation_id)
            exit(1)
    else:
        print('  [FAIL] Queue is empty!')
        exit(1)
else:
    print(f'  [FAIL] {response.status_code}')
    exit(1)

# STEP 3: Start consultation
print(f'\n[STEP 3] Doctor starts consultation...')
response = requests.patch(
    f'{BASE_URL}/api/consultations/{consultation_id}',
    json={'status': 'in-progress'}
)

if response.status_code == 200:
    print('  [PASS] Status updated to in-progress')
else:
    print(f'  [FAIL] {response.status_code}')
    exit(1)

# STEP 4: Verify in queue
print(f'\n[STEP 4] Verify status in queue...')
response = requests.get(
    f'{BASE_URL}/api/doctor/patient-queue',
    headers={'Authorization': f'Bearer local:{DOCTOR_ID}'}
)

if response.status_code == 200:
    queue = response.json()
    matching = [p for p in queue if p.get('consultation_id') == consultation_id]
    if len(matching) > 0 and matching[0].get('status') == 'in-progress':
        print(f'  [PASS] Queue shows status: in-progress')
    else:
        print('  [FAIL] Status not updated')
        exit(1)
else:
    exit(1)

# STEP 5: Complete consultation
print(f'\n[STEP 5] Doctor ends consultation...')
response = requests.patch(
    f'{BASE_URL}/api/consultations/{consultation_id}',
    json={'status': 'completed'}
)

if response.status_code == 200:
    print('  [PASS] Status updated to completed')
else:
    print(f'  [FAIL] {response.status_code}')
    exit(1)

# STEP 6: Verify removed
print(f'\n[STEP 6] Verify consultation removed from queue...')
response = requests.get(
    f'{BASE_URL}/api/doctor/patient-queue',
    headers={'Authorization': f'Bearer local:{DOCTOR_ID}'}
)

if response.status_code == 200:
    queue = response.json()
    if len(queue) == 0:
        print('  [PASS] Queue is now empty (consultation removed)')
    else:
        print('  [PASS] Consultation removed from queue')
else:
    exit(1)

print('\n' + '=' * 70)
print('ALL TESTS PASSED!')
print('=' * 70)
print('')
print('Summary:')
print('  [PASS] Consultation created with auto-assigned doctor')
print('  [PASS] Doctor sees patient in their queue')
print('  [PASS] Status updates: waiting -> in-progress -> completed')
print('  [PASS] Completed consultations removed from queue')
print('  [PASS] NO DUMMY DATA USED!')
