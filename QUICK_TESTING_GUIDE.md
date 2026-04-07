# Quick Testing Guide - Consultation Queue System

## 🚀 Quick Start Testing

### Prerequisites
- Backend running on `http://localhost:8000`
- Frontend running on `http://localhost:5173`
- Both services connected properly

---

## ✅ Test Flow (5 minutes)

### Step 1: Open Two Browser Windows

**Window 1 (Patient)**
- Login as Patient
- Go to `http://localhost:5173/patient/home`

**Window 2 (Doctor)**  
- Login as Doctor (ID: 22 for Respiratory, 34 for Cardiology, etc.)
- Go to `http://localhost:5173/doctor/home`

---

### Step 2: Patient Submits Consultation

In **Window 1 (Patient Dashboard)**:

1. Click **Home** tab
2. Right panel: **Consultation Form**
3. Fill form:
   - **Disease**: Select `Asthma` (or any listed disease)
   - **Symptoms**: `Breathing difficulty and chest pain`
   - **Duration**: `3 days`
4. Click **Submit Consultation**
5. ✅ Should show: "Consultation request submitted!"
6. ✅ Should go to **Consultation** tab
7. ✅ Should show: "Waiting for doctor to connect..." (with pulsing dots)

**Check Browser Console** (F12):
```
[PatientDashboard] Consultation created: {id: 123, status: "waiting"}
[PatientDashboard] Consultation status: waiting
```

---

### Step 3: Doctor Views Patient in Queue

In **Window 2 (Doctor Dashboard)**:

1. Click **Queue** tab (or **Patient Queue** section)
2. ✅ Should see patient card with:
   - Patient name
   - Disease: `Asthma`
   - Symptoms: `Breathing difficulty and chest pain`
   - Status badge: **waiting** (yellow)
   - **Start** button

**Check Backend Logs**:
```
[DoctorDashboard] Patient Queue: [{patient_id: 1, disease: "Asthma", ...}]
```

---

### Step 4: Doctor Starts Consultation

In **Window 2 (Doctor Queue)**:

1. Click **Start** button on patient card
2. ✅ Should navigate to **Consultation** tab
3. ✅ Should say "In consultation with patient"

**Check Browser Console**:
```
[DoctorDashboard] Consultation 123 updated to in-progress
```

**Check Doctor Queue** - Status updates:
- Queue card now shows: **in-progress** (blue badge)
- Or disappears if refreshed

---

### Step 5: Patient Sees Doctor Accepted

In **Window 1 (Patient Dashboard)**:

Watch the **Consultation** tab for ~5-10 seconds...

✅ **Should change to show**:
```
✓ Doctor has accepted your consultation!
Ready to start video consultation
```

✅ **Video button should become ENABLED**

**Check Browser Console**:
```
[PatientDashboard] Consultation status: in-progress
```

---

### Step 6: Start WebRTC Video (Optional)

Both can now click **Start Video Consultation** to begin video call.

✅ Should see:
- Patient video in large screen on patient side
- Doctor video in small corner
- Doctor video in large screen on doctor side  
- Patient video in small corner

---

## 🔍 What to Verify

### Patient Side ✓
- [ ] Form submits to backend API (not just localStorage)
- [ ] Gets consultation ID back from API
- [ ] Shows "waiting..." state
- [ ] Polls status every 5 seconds (F12 → Network tab)
- [ ] Shows status change within 5-10 seconds
- [ ] Video button enabled after status changes
- [ ] Video starts when button clicked

### Doctor Side ✓
- [ ] Queue fetches every 10 seconds
- [ ] Shows correct patient info
- [ ] Status shows as "waiting"
- [ ] Start button is clickable
- [ ] Status updates to "in-progress"
- [ ] Can start video

### Backend ✓
- [ ] POST /api/consultations returns ID
- [ ] Disease maps to correct specialization
- [ ] Doctor ID auto-assigned correctly
- [ ] PATCH /api/consultations/{id} updates status
- [ ] GET /api/consultations/{id} returns correct status
- [ ] GET /api/doctor/patient-queue returns queue

---

## 📊 Status Transitions

```
Patient Side Timeline:
├── 0s:   Submit form → "waiting"
├── 0s:   Start polling (every 5s)
├── 5s:   ✓ Check status (still "waiting")
├── 10s:  ✓ Check status (still "waiting")
└── 15s:  ✓ Check status (NOW "in-progress" after doctor started)
          → Show "Doctor accepted!"
          → Enable video button

Doctor Side Timeline:
├── 10s:  Doctor queue refreshed
├── 10s:  Patient visible in queue
├── 15s:  Doctor clicks Start
├── 15s:  Status → "in-progress" 
├── 15s:  Queue refreshes, shows status changed
└── Immediately patient sees change on next poll (5s interval)
```

---

## 🐛 Debug Checklist

### If Patient Form Doesn't Submit:
```
□ Check Network tab - POST /api/consultations fails?
□ Check Auth headers (getAuthHeaders() working?)
□ Check userId is being passed correctly
□ Check disease maps to specialization in backend
□ Check backend disease_specialization_map.py
```

### If Doctor Queue is Empty:
```
□ Check doctor ID matches backend (22, 30, 34, 35)
□ Check doctor role = "doctor" in database
□ Check getAuthHeaders() returns valid doctor token
□ Check fetchPatientQueue() fetch error in console
□ Check Network tab - GET /api/doctor/patient-queue response
```

### If Status Doesn't Update:
```
□ Check polling interval (should be 5 seconds)
□ Check Browser DevTools Network → look for GET /api/consultations/{id}
□ Check consultation ID localStorage (F12 → Storage → localStorage)
□ Check server-side status was actually updated
□ Check database consultations table directly
```

### If Video Won't Connect:
```
□ Check WebSocket connection (ws:// logs)
□ Check both users can access camera/mic
□ Check ICE candidates logged
□ Check STUN/TURN server configuration
□ Check browser console errors
```

---

## 📱 Test Scenarios

### Scenario 1: Different Specializations
Test path: Patient with **Cardiology** disease → Doctor 34
```
1. Patient submits: "Heart Attack"
   → Backend maps to "Cardiology"
   → Doctor 34 automatically assigned
2. Doctor 34 sees patient in queue
3. Doctor 22 (Respiratory) does NOT see patient
```

### Scenario 2: Multiple Patients
Test path: Multi-patient queue
```
1. Patient 1: "Asthma" → Doctor 22's queue
2. Patient 2: "Stroke" → Doctor 30's queue  
3. Patient 3: "Acne" → Doctor 35's queue
4. Each doctor sees only their patients
```

### Scenario 3: Consultation Completion
Test path: Mark consultation as complete
```
1. Doctor clicks End Consultation
2. Status → "completed"
3. Patient no longer in doctor's queue
4. Consultation record saved
```

---

## 🎯 Expected Behavior

### Console Logs to See

**Patient Side**:
```
[PatientDashboard] Consultation created: Object {id: 123, status: "waiting", ...}
[PatientDashboard] Consultation status: waiting
[PatientDashboard] Consultation status: waiting
[PatientDashboard] Consultation status: in-progress
```

**Doctor Side**:
```
[DoctorDashboard] Patient Queue: Array(1) [{patient_id: 1, disease: "Asthma", ...}]
[DoctorDashboard] Consultation 123 updated to in-progress
```

---

## ⏱️ Timing Reference

| Action | Time | Where |
|--------|------|-------|
| Patient submits | 0s | Patient form |
| Appears in queue | 0-10s | Doctor queue |
| Doctor starts | ~10-30s | Doctor queue |
| Patient sees update | ~15-40s | Patient consultation tab |
| Video can start | ~15-40s | Both |

*(Timing depends on polling intervals and network latency)*

---

## 🚨 Common Issues

### Issue: "Status not updating on patient side"
**Solution**: 
- Open DevTools (F12)
- Go to Network tab
- Filter by `consultations`
- Watch for GET /api/consultations/{id} every 5 seconds
- Verify response shows `"status": "in-progress"`

### Issue: "Patient not appearing in doctor queue"
**Solution**:
- Check doctor ID: Should be 2, 22, 30, 34, or 35
- Check consultation was created (check database or API response)
- Check disease maps in backend: `disease_specialization_map.py`
- Check doctor's specialization matches mapped specialization

### Issue: "Video button still disabled after doctor accepts"
**Solution**:
- Check localStorage has updated: F12 → Storage → localStorage → pendingConsultation
- Check `status` field is `in-progress` (not `waiting`)
- Refresh page if needed
- Check console for JS errors

---

## ✅ Final Verification

When system works correctly:

- [x] Patient fills form and submits
- [x] Backend creates consultation with ID and status
- [x] Doctor sees patient in queue immediately (or on next 10s refresh)
- [x] Doctor clicks Start
- [x] Status becomes "in-progress"
- [x] Patient sees update on next 5s poll (~5-10 sec delay)
- [x] Patient sees "Doctor accepted!" message
- [x] Video button becomes enabled
- [x] Both can start WebRTC video call

**If all pass → System is working correctly!** 🎉

---

## 📚 References

- Full Implementation: `CONSULTATION_QUEUE_IMPLEMENTATION.md`
- Backend API: `healthconnect-backend/routers/consultations.py`
- Patient Frontend: `healthconnect-frontend/src/components/PatientDashboard.tsx`
- Doctor Frontend: `healthconnect-frontend/src/components/DoctorDashboard.tsx`
- Mapping: `healthconnect-backend/disease_specialization_map.py`

---

**Happy Testing! 🚀**
