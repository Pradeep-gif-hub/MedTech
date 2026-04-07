# WebRTC Video Consultation - Fixed & Debugging Guide

## ✅ Fixes Applied

### 1. **WebRTC WebSocket Connection Fixed**
- **Before**: Tried to connect to frontend (`ws://localhost:5173`)
- **After**: Now connects to backend (`ws://localhost:8000`)
- **Files**: `PatientDashboard.tsx` (line 255) and `DoctorDashboard.tsx` (line 192)

### 2. **Video Element Attributes Fixed**
- Added explicit `autoPlay={true}`, `muted={true}`, `playsInline={true}`
- Added `style={{ display: 'block' }}` to ensure videos are visible
- Both patient and doctor dashboards updated

### 3. **Comprehensive Logging Added**
- Log when WebSocket connects: `[PatientDashboard] Connecting to WebSocket: ws://localhost:8000/...`
- Log when media requested: `[PatientDashboard] Requesting user media...`
- Log when streams attached: `[PatientDashboard] Attaching local stream to localVideoRef`
- Log when remote track arrives: `[PatientDashboard] Received remote track: video`

---

## 🧪 Testing the Video Consultation

### Step 1: Start Backend & Frontend
```bash
# Terminal 1: Backend
cd healthconnect-backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd healthconnect-frontend
npm run dev  # Should be on localhost:5173
```

### Step 2: Open Two Browser Windows

**Window 1 - Patient**
```
http://localhost:5173/patient/home
Login as patient
```

**Window 2 - Doctor**
```
http://localhost:5173/doctor/home
Login as doctor
```

### Step 3: Patient Submits Consultation

In **Window 1 (Patient)**:
1. Go to **Home** tab
2. Right panel: Fill consultation form
3. Click **Submit Consultation**
4. ✅ Should show "Consultation request submitted!"
5. Go to **Consultation** tab
6. Should show "Waiting for doctor to connect..." with pulsing dots

**Check Browser Console (F12 → Console)**:
```
[PatientDashboard] Consultation created: {id: 35, patient_id: 8, doctor_id: 34, ...}
[PatientDashboard] Consultation status: waiting
```

### Step 4: Doctor Views Queue

In **Window 2 (Doctor)**:
1. Go to **Queue** tab
2. ✅ Should see patient with:
   - Name, disease, symptoms
   - "waiting" status badge
   - **Start** button

### Step 5: Doctor Starts Consultation

In **Window 2 (Doctor Queue)**:
1. Click **Start** button
2. ✅ Redirects to **Consultation** tab
3. Should be dark screen (waiting for video)

**Check Browser Console**:
```
[DoctorDashboard] Consultation 35 updated to in-progress
[DoctorDashboard] Connecting to WebSocket: ws://localhost:8000/ws/live-consultation/receiver
[DoctorDashboard] Requesting user media...
```

### Step 6: Patient Sees Doctor Accepted & Clicks Video

In **Window 1 (Patient)**:
1. Within 5-10 seconds, console should show:
   ```
   [PatientDashboard] Consultation status: in-progress
   ```

2. UI should change to show:
   ```
   ✓ Doctor accepted your consultation!
   Ready to start video consultation
   ```

3. **Start Video Consultation** button becomes enabled

4. Click **Start Video Consultation**

**Check Browser Console** (watch for these logs):
```
[PatientDashboard] Connecting to WebSocket: ws://localhost:8000/ws/live-consultation/sender
[PatientDashboard] Requesting user media...
[PatientDashboard] Got local stream: MediaStream {id: "...", active: true, ...}
[PatientDashboard] Attaching local stream to localVideoRef
[PatientDashboard] Local video playing ✓
[PatientDashboard] Adding track: video
[PatientDashboard] Adding track: audio
```

### Step 7: Doctor Starts Video

In **Window 2 (Doctor)**:
1. When patient clicks video button, doctor console should show:
   ```
   [DoctorDashboard] WebSocket message received: {type: "offer", sdp: {...}}
   [DoctorDashboard] Received offer, creating answer...
   [DoctorDashboard] Requesting user media...
   [DoctorDashboard] Got local stream
   [DoctorDashboard] Adding doctor local stream...
   [DoctorDashboard] Creating answer...
   ```

### Step 8: Check for Video Display

**Patient Side** should show:
- ✅ **Large screen**: Doctor's video (once connected)
- ✅ **Small corner**: Patient's own video
- ✅ **Live Vitals** panel on right

**Doctor Side** should show:
- ✅ **Large screen**: Patient's video (once connected)
- ✅ **Small corner**: Doctor's own video
- ✅ **Patient info** on right

---

## 🔍 Troubleshooting Guide

### Issue: WebSocket Connection Fails
**Error**: `WebSocket connection to 'ws://...' failed`

**Solutions**:
1. Check backend is running on port 8000
   ```bash
   # Should see: Uvicorn running on http://0.0.0.0:8000
   ```

2. Check firewall allows port 8000
3. Verify WebSocket endpoint exists: `/ws/live-consultation/sender` (patient) or `/ws/live-consultation/receiver` (doctor)

**Debug**:
- Open DevTools (F12)
- Go to Console tab
- Look for: `[PatientDashboard] Connecting to WebSocket: ws://localhost:8000/...`
- Should say "WebSocket open" if successful

---

### Issue: Video Not Showing
**Problem**: Video is black/blank even after connection

**Causes & Solutions**:

1. **Camera Permission Denied**
   - Check browser permission
   - Go to Chrome settings → Privacy → Camera
   - Allow `localhost:5173`

2. **Video Ref Not Attached**
   - Console shows error: `localVideoRef.current is null!`
   - Problem: Video element not rendering
   - Check: Is video inside consultation tab? Is tab active?

3. **Stream Not Playing**
   - Check console for: `Local video play() error`
   - May need to wait for user interaction first
   - Try clicking anywhere on page first

**Debug Steps**:
```javascript
// In browser console, check if refs are set:
// (Only works if using React DevTools)

// Wait for video to play, then check:
// Should show MediaStream object
console.log('Patient local video:', document.querySelector('video[data-testid="local-video"]'))
console.log('Doctor remote video:', document.querySelector('video[data-testid="remote-video"]'))
```

---

### Issue: One-Way Video (Only Doctor Sees Patient)
**Problem**: Doctor sees patient but patient doesn't see doctor

**Causes**:
- Doctor's local stream not being added to connection
- Remote track event not firing on patient side

**Solutions**:
1. Check doctor console for ICE error messages
2. Verify answer is being sent back to patient
3. Check for CORS/firewall issues blocking media stream

**Debug**:
```
Patient console should show:
✓ [PatientDashboard] ICE candidate queued/sent (multiple times)
✓ [PatientDashboard] Received remote track: video
✓ [PatientDashboard] Setting remoteVideoRef.srcObject
✓ [PatientDashboard] Remote video playing
```

---

### Issue: Audio Not Working
**Problem**: Video works but no audio

**Solutions**:
1. Check microphone permission in browser
2. Verify audio tracks being added: console should show `Adding track: audio`
3. Check speaker volume is not muted

**Debug**:
```
Console should show:
✓ Adding track: audio (patient sent)
✓ Adding track: audio (doctor sent)
✓ Received remote track: audio
```

---

## 📊 Expected Console Output Timeline

### Patient Side (Clicking "Start Video Consultation")
```
0s:   [PatientDashboard] Connecting to WebSocket: ws://localhost:8000/ws/live-consultation/sender
0s:   [PatientDashboard] Requesting user media...
0.5s: [PatientDashboard] Got local stream: MediaStream {...}
0.5s: [PatientDashboard] Attaching local stream to localVideoRef
0.5s: [PatientDashboard] Local video playing ✓
0.6s: [PatientDashboard] Adding track: video
0.6s: [PatientDashboard] Adding track: audio
0.7s: [PatientDashboard] ICE candidate queued/sent
1-3s: [PatientDashboard] ICE candidate queued/sent (multiple)
2s:   [PatientDashboard] Received offer (WS message)
3s:   [PatientDashboard] Received remote track: video
3s:   [PatientDashboard] Remote video playing ✓
```

### Doctor Side (Patient Starts Video)
```
0s:   WebSocket receives offer from patient
0s:   [DoctorDashboard] WebSocket message: offer
0s:   [DoctorDashboard] Requesting user media...
0.5s: [DoctorDashboard] Got doctor local stream
0.5s: [DoctorDashboard] Adding doctor local stream to pc
1s:   [DoctorDashboard] Creating answer...
1s:   [DoctorDashboard] Queued/sent answer
1-3s: [DoctorDashboard] ICE candidate queued/sent (multiple)
2s:   [DoctorDashboard] Received remote track: video
2s:   [DoctorDashboard] Remote video playing ✓
```

---

## ✅ Verification Checklist

- [ ] WebSocket connects to backend (not frontend)
- [ ] Video elements have `autoPlay`, `muted`, `playsInline`
- [ ] Patient sees local video in small corner
- [ ] Doctor sees patient video in large screen
- [ ] Doctor sees own video in small corner
- [ ] Patient sees doctor video in large screen
- [ ] Audio works (can hear both sides)
- [ ] No console errors about refs being null
- [ ] Connection logs show in console
- [ ] Video plays after ICE candidates exchanged

---

## 🚀 How to Monitor WebSocket Traffic

1. Open **DevTools** (F12)
2. Go to **Network** tab
3. Filter by **WS** (WebSocket)
4. Look for:
   - `ws://localhost:8000/ws/live-consultation/sender` (patient)
   - `ws://localhost:8000/ws/live-consultation/receiver` (doctor)
5. Click on each to see frames (messages sent/received)

---

## 🎯 If Still Not Working

### Check These in Order:

1. **Backend Server**
   ```
   Is it running? Should see:
   INFO:     Uvicorn running on http://0.0.0.0:8000
   ```

2. **WebSocket Endpoint**
   ```
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
     http://localhost:8000/ws/live-consultation/sender
   ```
   Should get WebSocket upgrade response (not 404)

3. **Browser Console**
   - Clear all logs
   - Open new consultation
   - Watch console in real-time
   - Copy-paste full error messages

4. **Check Firewall**
   - Some networks block port 8000
   - Try on different network if possible

5. **Browser Compatibility**
   - Chrome/Edge: ✅ Works
   - Firefox: ✅ Works
   - Safari: ⚠️ May need https for older versions
   - Mobile: ⚠️ May have permission issues

---

**Last Updated**: April 7, 2026
**Status**: ✅ Fixed and Ready for Testing
