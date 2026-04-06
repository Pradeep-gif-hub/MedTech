# Doctor Dashboard Patient Queue Implementation

## Overview
The Doctor Dashboard now uses a **real database-driven patient queue system** based on specialization matching, replacing all dummy patient data.

## System Architecture

```
Patient Submission
       ↓
Consultation Created in DB
       ↓
Doctor Assigned (Specialization Match)
       ↓
Appears in Doctor's Queue
       ↓
Doctor Starts Consultation
       ↓
Status → "in-progress"
       ↓
Doctor Ends Consultation
       ↓
Status → "completed"
```

## Database Changes

### New Table: Consultations
```sql
CREATE TABLE consultations (
    id INTEGER PRIMARY KEY,
    patient_id INTEGER FOREIGN KEY,
    doctor_id INTEGER FOREIGN KEY,
    disease VARCHAR,  -- e.g., "Cardiology"
    symptoms VARCHAR,
    duration VARCHAR,  -- e.g., "2 weeks"
    status VARCHAR DEFAULT 'waiting',  -- waiting, in-progress, completed
    appointment_time VARCHAR,
    created_at DATETIME,
    updated_at DATETIME
);
```

## Frontend Implementation

### 1. State Management
Added to DoctorDashboard.tsx:
```typescript
const [patientQueue, setPatientQueue] = useState<any[]>([]);
const [queueLoading, setQueueLoading] = useState(false);
```

### 2. Queue Fetching
```typescript
const fetchPatientQueue = async () => {
  const response = await fetch(buildApiUrl(`/api/doctor/patient-queue`), {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  setPatientQueue(data);
};
```

Auto-refreshes every 10 seconds:
```typescript
useEffect(() => {
  fetchPatientQueue();
  const interval = setInterval(fetchPatientQueue, 10000);
  return () => clearInterval(interval);
}, [profile?.id]);
```

### 3. Start Consultation
When doctor clicks "Start", the consultation status is updated to "in-progress":
```typescript
const startConsultation = async (patient: any) => {
  const success = await updateConsultationStatus(
    patient.consultation_id, 
    'in-progress'
  );
  // Then start WebRTC...
};
```

### 4. End Consultation
When consultation ends, status is updated to "completed":
```typescript
const endConsultation = async () => {
  if (currentPatient?.consultation_id) {
    await updateConsultationStatus(
      currentPatient.consultation_id, 
      'completed'
    );
  }
  // Then cleanup...
};
```

### 5. Queue Display
Renders real data instead of dummy:
```typescript
{queueToDisplay.map((patient) => (
  <div key={patient.consultation_id}>
    <h3>{patient.patient_name}</h3>
    <p>Age: {patient.age} | Disease: {patient.disease}</p>
    <span className={statusBadgeColor}>{patient.status}</span>
    <button onClick={() => startConsultation(patient)}>Start</button>
  </div>
))}
```

## Backend Implementation

### New Router: /routers/consultations.py

#### 1. POST /api/consultations
**Create a consultation**
```
Request:
{
  "patient_id": 5,
  "disease": "Cardiology",
  "symptoms": "Chest pain",
  "duration": "2 weeks",
  "appointment_time": "3:00 PM"
}

Response:
{
  "id": 12,
  "patient_id": 5,
  "doctor_id": 3,  // Automatically assigned
  "disease": "Cardiology",
  "status": "waiting",
  "message": "Consultation request created successfully"
}
```

**Auto-assignment logic:**
- Searches for doctor where `specialization` matches `disease`
- If found, assigns `doctor_id`
- If not found, `doctor_id` remains null (unassigned)

#### 2. GET /api/doctor/patient-queue
**Fetch active consultations for logged-in doctor**

Returns all consultations where:
- `doctor_id` = logged-in doctor
- `status` IN ("waiting", "in-progress")

Response format:
```json
[
  {
    "consultation_id": 12,
    "patient_id": 5,
    "patient_name": "Rahul Sharma",
    "age": 45,
    "appointment_time": "3:15 PM",
    "disease": "Cardiology",
    "symptoms": "Chest pain",
    "duration": "2 weeks",
    "status": "waiting",
    "bloodGroup": "B+",
    "allergies": "Penicillin",
    "lastVisit": null
  }
]
```

#### 3. PATCH /api/consultations/{id}
**Update consultation status**

```
Request:
{
  "status": "in-progress"  // or "completed"
}

Response:
{
  "id": 12,
  "status": "in-progress",
  "updated_at": "2024-03-07T15:30:45.123456",
  "message": "Consultation status updated to in-progress"
}
```

#### 4. GET /api/consultations/{id}
**Get detail of specific consultation**

Returns full consultation details including patient and doctor info.

## Data Flow Example

### Patient Submits Consultation
1. Patient fills form in PatientDashboard:
   - Disease: "Cardiology"
   - Symptoms: "Chest pain"
   - Duration: "2 weeks"

2. Frontend POST to `/api/consultations`:
   ```json
   {
     "patient_id": 5,
     "disease": "Cardiology",
     "symptoms": "Chest pain",
     "duration": "2 weeks"
   }
   ```

3. Backend:
   - Creates consultation record with `status="waiting"`
   - Searches for doctor with `specialization LIKE "%Cardiology%"`
   - Finds Dr. Pradeep (ID: 3, Specialization: Cardiology)
   - Sets `doctor_id = 3`
   - Saves to database

### Doctor Views Queue
1. Doctor logs in → DoctorDashboard renders
2. Component fetches `/api/doctor/patient-queue`
3. Backend query:
   ```sql
   SELECT * FROM consultations 
   WHERE doctor_id = 3 
   AND status IN ('waiting', 'in-progress')
   ```
4. Returns Rahul's consultation
5. Displays in Patient Queue

### Doctor Starts Consultation
1. Doctor clicks "Start" button
2. Frontend PATCH `/api/consultations/12`:
   ```json
   {"status": "in-progress"}
   ```
3. DB updated: `consultations.status = "in-progress"`
4. Queue refreshes
5. Patient status badge changes to blue (in-progress)
6. WebRTC consultation starts

### Doctor Ends Consultation
1. Doctor clicks "End Consultation" button
2. Frontend PATCH `/api/consultations/12`:
   ```json
   {"status": "completed"}
   ```
3. DB updated: `consultations.status = "completed"`
4. Consultation removed from doctor's queue
5. (Optional) Mark as completed for records

## Key Features

### ✅ Specialization Matching
- Only doctors with matching specialization see consultations
- Example: Patient selects "Cardiology" → Only Cardiologists see request

### ✅ Real-Time Updates
- Queue refreshes every 10 seconds
- Status changes immediately reflected
- No dummy data

### ✅ Status Tracking
- **Waiting**: Patient submitted, doctor can view
- **In-progress**: Doctor started consultation
- **Completed**: Consultation finished

### ✅ Patient Details
- Includes age, symptoms, disease, duration
- Access to blood group and allergies
- Automatically populated from registration

### ✅ Fallback Support
- If no real data, shows dummy patients for demo
- Flexible data structure supports both real and test data

## Testing

### Test Scenario 1: Create Consultation
```bash
curl -X POST http://localhost:8000/api/consultations \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": 5,
    "disease": "Cardiology",
    "symptoms": "Chest pain and shortness of breath",
    "duration": "3 days",
    "appointment_time": "2:30 PM"
  }'
```

### Test Scenario 2: Get Doctor Queue
```bash
curl -X GET http://localhost:8000/api/doctor/patient-queue \
  -H "Authorization: Bearer local:3"
```

### Test Scenario 3: Update Status
```bash
curl -X PATCH http://localhost:8000/api/consultations/12 \
  -H "Content-Type: application/json" \
  -d '{"status": "in-progress"}'
```

## Files Modified/Created

### Backend
- ✅ `/models.py` - Added Consultation model
- ✅ `/routers/consultations.py` - NEW router with 4 endpoints
- ✅ `/main.py` - Added consultations router import and registration

### Frontend
- ✅ `/src/components/DoctorDashboard.tsx`:
  - Added `patientQueue` state
  - Added `queueLoading` state
  - Added `fetchPatientQueue()` function
  - Added `updateConsultationStatus()` function
  - Updated `startConsultation()` to update status
  - Updated `endConsultation()` to update status
  - Updated `renderQueueList()` to use real data
  - Updated `ConsultationHeader` to show disease info
  - Added useEffect to fetch queue on mount

## Differences Between Real & Dummy Data

### Real Data (From Database)
```javascript
{
  consultation_id: 12,
  patient_name: "Rahul Sharma",
  age: 45,
  disease: "Cardiology",
  symptoms: "Chest pain",
  status: "waiting"
}
```

### Dummy Data (Fallback)
```javascript
{
  id: 2,
  name: "Rahul Tewatiya",
  age: 45,
  time: "3:15 PM",
  urgency: "urgent",
  status: "in-progress"
}
```

Frontend normalizes both:
```typescript
const patientName = patient.patient_name || patient.name;
const status = patient.status || 'waiting';
```

## Error Handling

### No Matching Doctor
If patient selects disease but no doctor has that specialization:
- Consultation still created
- `doctor_id` set to NULL
- Will not appear in any doctor's queue
- Admin can manually assign later

### Authentication Failures
- Returns 401 "Unauthorized" if no valid token
- Returns 403 "Access restricted to doctors only" for non-doctors

### Invalid Status Update
- Returns 400 if status not in ["waiting", "in-progress", "completed"]

## Future Enhancements

1. **Notification System**
   - Notify doctor when new consultation assigned
   - Notify patient when consultation status updates

2. **Queue Filtering**
   - Filter by disease/specialty
   - Sort by urgency or wait time
   - Search by patient name

3. **Assignment Rules**
   - Distribute load across doctors
   - Assign based on availability
   - Patient preference for specific doctor

4. **Analytics**
   - Track consultation duration
   - Monitor queue length
   - Calculate average wait times

5. **Follow-ups**
   - Schedule follow-up consultations
   - Track patient history
   - Repeat consultations for same patient

## Deployment Notes

1. Run database migration to create `consultations` table:
   ```bash
   alembic upgrade head
   ```
   OR let create_tables_on_startup handle it

2. Ensure JWT token includes user_id for authorization

3. Test with proper doctor/patient roles

4. Monitor queue refresh interval (currently 10s) for performance
