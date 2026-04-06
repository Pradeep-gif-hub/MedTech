# Test: Real Patient Queue System

## Problem Fixed
❌ **Before**: Patient submitted consultation → Only dummy patients appeared in doctor queue
✅ **After**: Patient submitted consultation → Real patient appears in doctor queue (no dummy fallback)

## Code Changes Made

### 1. PatientDashboard.tsx
**Added**: `createConsultationInBackend()` function
- Gets pending consultation from localStorage
- Extracts patient_id from user profile
- Sends POST to `/api/consultations` with:
  - patient_id
  - disease
  - symptoms
  - duration
  - appointment_time

**Modified**: `startLiveSender()` function
- Now calls `createConsultationInBackend()` BEFORE starting WebRTC
- Ensures consultation is in database before video starts

### 2. DoctorDashboard.tsx
**Changed**: `renderQueueList()` function
- **Before**: `const queueToDisplay = patientQueue && patientQueue.length > 0 ? patientQueue : patients;`
- **After**: `const queueToDisplay = patientQueue || [];`
- **Result**: NO dummy patient fallback - only real data from database

### 3. Backend (Already Exists)
- ✅ `/routers/consultations.py` - All 4 endpoints working
- ✅ `/models.py` - Consultation model with proper relationships
- ✅ `/main.py` - Router properly mounted

## Testing Steps

### Step 1: Start Backend
```bash
cd healthconnect-backend
make dev
# OR
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

✅ Check: Server starts without errors
✅ Verify: http://localhost:8000/docs (FastAPI docs available)

---

### Step 2: Start Frontend
```bash
cd healthconnect-frontend
npm run dev
```

✅ Check: React dev server running
✅ Verify: http://localhost:5173

---

### Step 3: **Doctor Logs In**
1. Go to http://localhost:5173
2. Logout if already logged in
3. **Login as Doctor**:
   - Email: `pradeepkumarawasthi67@gmail.com`
   - Password: (admin password)
4. Navigate to **Doctor Dashboard**

✅ Expected: 
- Patient Queue shows: "No patients currently in queue" (empty)
- **NO dummy patients visible**

---

### Step 4: **Patient Submits Consultation**
1. Open **different browser tab/window**
2. Go to http://localhost:5173
3. **Login as Patient**:
   - Email: (any patient account)
   - Password: (patient password)
4. Navigate to **Patient Dashboard**
5. Scroll to "Request Consultation" form
6. **Fill form**:
   - **Disease**: Select "Heart Disease"
   - **Symptoms**: Type "asda" (or any text)
   - **Duration**: Type "2"
7. Click **"Submit Consultation"** button

✅ Expected:
- Form validates (no error)
- Moves to "Consultation" tab
- Shows text: "Your Consultation Request"
- Displays pending consultation data

---

### Step 5: **Patient Clicks "Start Video Consultation"**
1. In **Patient Dashboard** (still in Consultation tab)
2. Click **"Start Video Consultation"** button

✅ Expected:
- Backend function `createConsultationInBackend()` executes
- POST to `/api/consultations` is sent
- Consultation record created in database
- WebRTC video setup starts
- Patient video appears in left panel

✅ Check Browser Console (F12):
- Should see: `"Consultation created: {id: X, patient_id: 5, doctor_id: Y, ...}"`
- No errors about failed consultation creation

---

### Step 6: **Doctor Sees Real Patient in Queue**
1. Switch to **Doctor Dashboard tab**
2. Look at **Patient Queue** section

✅ Expected:
- Queue is NOT empty anymore
- Real patient appears with:
  - **Name**: (Patient's actual name from database)
  - **Age**: (from database)
  - **Disease**: "Heart Disease"
  - **Status**: "waiting" (yellow badge)
  - **Symptoms**: "asda"
  - **Duration**: "2"

❌ **NOT Expected**:
- Dummy patients (Pradeep Awasthi, Rahul Tewatiya, etc.) should NOT appear
- Empty queue message should NOT show

---

### Step 7: **Doctor Starts Consultation**
1. In **Doctor Dashboard**, in **Patient Queue**
2. Click **"Start"** button on the real patient

✅ Expected:
- Patient status changes to "in-progress" (blue badge)
- WebRTC video starts for doctor
- Doctor can see patient's video in right panel

✅ Check Backend:
- PATCH `/api/consultations/{id}` called
- Status updated to "in-progress"

---

### Step 8: **End Consultation**
1. **Doctor** clicks **"End Consultation"** button

✅ Expected:
- Consultation status changes to "completed"
- Patient removed from queue
- Queue shows empty or other patients (if any)
- PATCH `/api/consultations/{id}` with status="completed"

---

## Database Verification

### Check Consultations Table Created
```bash
sqlite3 healthconnect-backend/instance/app.db
SELECT * FROM consultations;
```

✅ Expected output:
```
id | patient_id | doctor_id | disease | symptoms | duration | status | appointment_time | created_at | updated_at
1  | 5          | 3         | Heart Disease | asda | 2      | waiting | 2:30 PM   | ...timestamp... | ...timestamp...
```

### Verify Doctor ID Assigned Correctly
```bash
sqlite3 healthconnect-backend/instance/app.db
SELECT id, full_name, specialization FROM users WHERE role = 'doctor';
```

✅ Expected: Doctor with "Heart Disease" or "Cardiology" in specialization has matching `doctor_id`

---

## API Endpoint Tests (Manual)

### Test POST /api/consultations
```bash
curl -X POST http://localhost:8000/api/consultations \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": 5,
    "disease": "Heart Disease",
    "symptoms": "asda",
    "duration": "2",
    "appointment_time": "2:30 PM"
  }'
```

✅ Expected Response:
```json
{
  "id": 1,
  "patient_id": 5,
  "doctor_id": 3,
  "disease": "Heart Disease",
  "status": "waiting",
  "message": "Consultation request created successfully"
}
```

---

### Test GET /api/doctor/patient-queue (With Doctor Auth)
```bash
curl -X GET http://localhost:8000/api/doctor/patient-queue \
  -H "Authorization: Bearer local:3"
```

✅ Expected Response:
```json
[
  {
    "consultation_id": 1,
    "patient_id": 5,
    "patient_name": "John Doe",
    "age": 34,
    "appointment_time": "2:30 PM",
    "disease": "Heart Disease",
    "symptoms": "asda",
    "duration": "2",
    "status": "waiting",
    "created_at": "2024-04-07T...",
    "bloodGroup": "B+",
    "allergies": "Penicillin",
    "lastVisit": null
  }
]
```

---

### Test PATCH /api/consultations/{id}
```bash
curl -X PATCH http://localhost:8000/api/consultations/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "in-progress"}'
```

✅ Expected Response:
```json
{
  "id": 1,
  "status": "in-progress",
  "updated_at": "2024-04-07T...",
  "message": "Consultation status updated to in-progress"
}
```

---

## Troubleshooting

### Issue 1: "No patients currently in queue" even after patient submits
**Solution**:
1. Check browser console (F12) in patient browser
2. Look for error messages in `createConsultationInBackend()` function
3. Verify backend POST `/api/consultations` succeeded
4. Check database: `SELECT * FROM consultations;`

### Issue 2: Doctor's dashboard shows patient but with wrong data
**Solution**:
1. Verify consultation data in database matches form submission
2. Check if doctor's specialization matches disease selected
3. Check `resolve_current_doctor()` in consultations.py is extracting correct doctor_id

### Issue 3: "Start Video Consultation" button doesn't work
**Solution**:
1. Make sure pending consultation is in localStorage:
   - Open browser DevTools → Application → LocalStorage
   - Look for key: `pendingConsultation`
2. Check WebRTC connectivity issues
3. Check browser console for errors

### Issue 4: Patient ID is null/undefined
**Solution**:
1. Verify user profile is loaded: Check if `profile?.id` exists
2. Check `useBackendProfile()` hook is working
3. Verify user is actually logged in

---

## Success Criteria ✅

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Doctor logs in sees empty queue (no dummy data)
- [ ] Patient fills form and clicks "Submit Consultation"
- [ ] Patient clicks "Start Video Consultation" - no error
- [ ] Console shows: "Consultation created: {id: 1, ...}"
- [ ] Doctor dashboard automatically refreshes
- [ ] Real patient appears in queue (not dummy)
- [ ] Patient name, age, disease, and status are correct
- [ ] Doctor clicks "Start" - status changes to "in-progress"
- [ ] Doctor's video appears - consultation works
- [ ] Doctor clicks "End" - status changes to "completed"
- [ ] Database shows consultation with correct status updates

---

## Key Differences After Fix

| Aspect | Before | After |
|--------|--------|-------|
| Patient Queue Source | Dummy array + localStorage | Database only |
| Fallback Data | Shows dummy patients if queue empty | Shows "No patients" if queue empty |
| Database | Consultation not created | Consultation created when "Start Video" clicked |
| Queue Update | Manual only | Auto-refreshes every 10 seconds |
| Real-Time | ❌ Not real-time | ✅ Real-time updates |
| Doctor Privacy | ❌ Sees all dummy data | ✅ Only sees assigned consultations |
| Specialization Match | ❌ No matching | ✅ Auto-assigns matching doctor |

