# Patient Dashboard Profile System - Implementation Overview

## Executive Summary
The Patient Dashboard profile system is a comprehensive user profile management system with both backend APIs and frontend UI components. It supports patient profile completion on signup, profile viewing, and profile editing with real-time synchronization through JWT authentication.

---

## 1. Database Model Schema (Patient User Model)

### File Location
📁 [healthconnect-backend/models.py](healthconnect-backend/models.py)

### User Model Structure
```python
class User(Base):
    __tablename__ = "users"
    
    # Core Identity Fields
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    name = Column(String, nullable=True)
    role = Column(String, nullable=True)  # 'patient', 'doctor', 'pharmacy', 'admin'
    
    # Profile Information Fields
    dob = Column(String, nullable=True)                    # Date of birth (ISO format)
    age = Column(Integer, nullable=True)                   # Computed/stored age
    gender = Column(String, nullable=True)                  # Male, Female, Others
    phone = Column(String, nullable=True)                   # Phone number
    emergency_contact = Column(String, nullable=True)       # Emergency contact number
    
    # Health Information Fields
    bloodgroup = Column(String, nullable=True)             # A+, B+, O+, AB+, AB-, O-
    abha_id = Column(String, nullable=True)                # Ayushman Bharat Health Account ID
    allergy = Column(String, nullable=True)                # Single allergy field (singular)
    
    # Legacy Fields (for backward compatibility)
    allergies = Column(String, nullable=True)              # Plural allergies (legacy)
    medications = Column(String, nullable=True)            # Current medications list
    surgeries = Column(String, nullable=True)              # Surgery history
    
    # Media/Presentation
    profile_picture_url = Column(String, nullable=True)    # URL to profile picture
```

### Key Features
- **Dual allergy fields**: `allergy` (singular) and `allergies` (plural) for frontend/backend compatibility
- **Age field**: Can be stored or computed from DOB
- **Profile picture**: Stored as URL (supports Google OAuth profile pictures)
- **Role-based**: Supports multiple roles (patient, doctor, pharmacy, admin)

---

## 2. Backend Routes for Patient Profile

### File Location
📁 [healthconnect-backend/routers/users.py](healthconnect-backend/routers/users.py)

### Profile-Related Endpoints

#### **POST /api/users/google-login**
**Purpose**: Google OAuth login endpoint
**Authentication**: Authorization header with Google ID token
**Response for existing users**: User data + `is_new_user: false`
**Response for new users**: Temporary user info + `is_new_user: true` + redirect to profile completion

```python
Response (New User):
{
  "user": {
    "user_id": null,
    "email": "user@gmail.com",
    "name": "John Doe",
    "role": "patient",
    "dob": null,
    "phone": null,
    "age": null,
    "gender": null,
    "bloodgroup": null,
    "abha_id": null,
    "allergy": null,
    "profile_picture_url": "https://...",
    "google_id": "...",
    "picture": "https://..."
  },
  "is_new_user": true,
  "message": "Please complete your profile"
}
```

#### **POST /api/users/complete-profile**
**Purpose**: Complete user profile after Google signup
**Required Fields**: `user_id`, `name`, `age`, `gender`, `bloodgroup`, `allergy`, `role`
**Process**: 
1. Frontend receives temporary user data from google-login
2. User fills profile completion form
3. Frontend calls complete-profile endpoint with form data
4. Backend persists user to database

```python
Request Payload:
{
  "user_id": 123,
  "name": "John Doe",
  "age": 30,
  "gender": "Male",
  "bloodgroup": "O+",
  "allergy": "Penicillin",
  "abha_id": "Optional ABHA ID",
  "role": "patient"
}

Response:
{
  "message": "Profile completed successfully",
  "user": {
    "user_id": 123,
    "email": "user@gmail.com",
    "name": "John Doe",
    "role": "patient",
    "age": 30,
    "gender": "Male",
    "bloodgroup": "O+",
    "abha_id": "...",
    "allergy": "Penicillin",
    "profile_picture_url": "https://..."
  }
}
```

#### **POST /api/users/login**
**Purpose**: Email and password login
**Authentication**: Email + password in request body
**Response**: User data with local token (format: `"local:{user_id}"`)

```python
Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "message": "Welcome John Doe!",
  "user_id": 123,
  "id": 123,
  "name": "John Doe",
  "email": "user@example.com",
  "role": "patient",
  "age": 30,
  "gender": "Male",
  "bloodgroup": "O+",
  "phone": "9876543210",
  "dob": "1993-01-15",
  "abha_id": "...",
  "allergy": "Penicillin",
  "profile_picture_url": "https://...",
  "token": "local:123"
}
```

#### **GET /api/users/me** ✅ PRIMARY PROFILE FETCH
**Purpose**: Retrieve current authenticated user's complete profile
**Authentication**: JWT Token in Authorization header
**Response**: Complete user profile object

```python
Request Headers:
Authorization: Bearer local:123

Response:
{
  "id": 123,
  "user_id": 123,
  "name": "John Doe",
  "email": "user@example.com",
  "role": "patient",
  "dob": "1993-01-15",
  "phone": "9876543210",
  "emergency_contact": "9876543211",
  "age": 30,
  "gender": "Male",
  "bloodgroup": "O+",
  "abha_id": "ABHA123456",
  "allergy": "Penicillin",
  "profile_picture_url": "https://...",
  "picture": "https://...",
  "token": "local:123"
}
```

#### **PUT /api/users/update-profile** ✅ PRIMARY PROFILE UPDATE
**Purpose**: Update current authenticated user's profile
**Authentication**: JWT Token in Authorization header
**Request Body**: Partial user profile fields (only send fields to update)

```python
Request Headers:
Authorization: Bearer local:123

Request Body (Example):
{
  "name": "Jane Doe",
  "phone": "9876543210",
  "gender": "Female",
  "bloodgroup": "AB+",
  "age": 31,
  "dob": "1992-06-20",
  "abha_id": "NEWIDVALUE",
  "allergy": "Peanuts",
  "picture": "https://new-picture-url.com/image.jpg"
}

Response: Updated user profile object
```

#### **PUT /api/users/update/{user_id}** (Legacy)
**Purpose**: Update user by ID (admin/system endpoint)
**Note**: Newer endpoints use JWT authentication

#### **PATCH /api/users/me** (Alternative)
**Purpose**: Partial profile update
**Supports**: Both snake_case and camelCase field names

---

## 3. JWT Authentication & Patient ID Extraction

### File Location
📁 [healthconnect-backend/routers/users.py](healthconnect-backend/routers/users.py)  
📁 [healthconnect-backend/utils/auth.py](healthconnect-backend/utils/auth.py)

### Token Format & Extraction
**Local Token Format**: `"local:{user_id}"` (e.g., `"local:123"`)

```python
def build_local_token(user_id: int) -> str:
    return f"{LOCAL_TOKEN_PREFIX}{user_id}"  # Returns "local:123"
```

### Authentication Middleware
```python
async def resolve_current_user(request: Request, db: Session) -> models.User:
    """
    Extracts and validates user from JWT token.
    
    Priority:
    1. JWT Token from Authorization: Bearer header (local or Google token)
    2. Fallback to X-User-Id header (legacy)
    """
    auth_header = request.headers.get("Authorization") or ""
    user = None

    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        
        if token.startswith("local:"):
            # Extract local user ID
            raw_user_id = token.replace("local:", "", 1)
            if raw_user_id.isdigit():
                user = db.query(models.User).filter(
                    models.User.id == int(raw_user_id)
                ).first()
        else:
            # Support Google OAuth tokens
            try:
                token_payload = await verify_google_token(request)
                email = token_payload.get("email") if token_payload else None
                if email:
                    user = db.query(models.User).filter(
                        models.User.email == email
                    ).first()
            except HTTPException:
                user = None
    
    if not user:
        # Fallback to X-User-Id header (legacy)
        user_id_header = request.headers.get("X-User-Id")
        if user_id_header and str(user_id_header).isdigit():
            user = db.query(models.User).filter(
                models.User.id == int(user_id_header)
            ).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    return user
```

### Google OAuth Token Verification
```python
async def verify_google_token(request: Request) -> Optional[dict]:
    """
    Verifies Google OAuth ID token from Authorization header.
    Returns structured user data from Google token payload.
    """
    # Returns:
    {
        "google_id": idinfo["sub"],
        "email": idinfo["email"],
        "name": idinfo.get("name"),
        "picture": idinfo.get("picture"),
        "email_verified": idinfo.get("email_verified")
    }
```

### Token Storage (Frontend)
```typescript
// Frontend stores token in localStorage
localStorage.setItem('token', userData.token);  // e.g., "local:123"

// Include in all API requests
headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
}
```

---

## 4. Frontend Profile System

### File Locations
- 📁 [healthconnect-frontend/src/components/PatientDashboard.tsx](healthconnect-frontend/src/components/PatientDashboard.tsx)
- 📁 [healthconnect-frontend/src/components/ProfileCompletion.tsx](healthconnect-frontend/src/components/ProfileCompletion.tsx)
- 📁 [healthconnect-frontend/src/hooks/useBackendProfile.ts](healthconnect-frontend/src/hooks/useBackendProfile.ts)

### 4.1 useBackendProfile Hook
**Purpose**: Centralized profile data fetching and state management

```typescript
export const useBackendProfile = () => {
  const [profile, setProfile] = useState(null as BackendProfile | null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null as string | null);

  // Fetches profile on component mount and can be refreshed manually
  const refreshProfile = async () => {
    const token = localStorage.getItem('token') || '';
    
    const data = await fetch(buildApiUrl('/api/users/me'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return data.json();
  };

  useEffect(() => {
    refreshProfile();  // Auto-fetch on component mount
  }, []);

  return { profile, loading, error, refreshProfile, setProfile };
};
```

**Type Definition**:
```typescript
type BackendProfile = {
  id?: number;
  user_id?: number;
  name?: string;
  email?: string;
  role?: string;
  age?: number | null;
  gender?: string | null;
  bloodgroup?: string | null;
  allergy?: string | null;
  allergies?: string | null; // Legacy field
  medications?: string | null;
  surgeries?: string | null;
  dob?: string | null;
  phone?: string | null;
  emergency_contact?: string | null;
  picture?: string | null;
  profile_picture_url?: string | null;
  token?: string | null;
};
```

### 4.2 ProfileCompletion Component
**Purpose**: Guide new Google OAuth users through profile setup
**Route**: Shown when `is_new_user: true` from google-login endpoint

**Flow**:
1. Display profile form with user's Google data pre-filled
2. User completes required fields (age computed from DOB)
3. Form submitted to `/api/users/signup` endpoint
4. Credentials saved to localStorage
5. Event dispatched and `onComplete()` callback called

```typescript
const handleSubmit = async (e: any) => {
  const age = computeAgeFromDob(formData.dob);
  
  const payload = {
    name: formData.name,
    email: user.email,
    role: formData.role,
    dob: formData.dob,
    phone: formData.phone,
    age,  // Auto-computed
    gender: formData.gender,
    bloodgroup: formData.bloodgroup,
    allergy: formData.allergy,
    password: '',
    picture: user.picture || '',
    profile_picture_url: user.picture || ''
  };

  const res = await fetch(buildApiUrl('/api/users/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  // Save token and dispatch event
  localStorage.setItem('token', userData.token);
  const ev = new CustomEvent('user-updated', { detail: userData });
  window.dispatchEvent(ev);
  
  onComplete(userData);
};
```

### 4.3 PatientDashboard Profile Tab

**Location**: [healthconnect-frontend/src/components/PatientDashboard.tsx - renderProfile()](healthconnect-frontend/src/components/PatientDashboard.tsx#L1182)

**Features**:
- **Home Tab**: Displays profile summary with health stats
- **Profile Tab (renderProfile)**: Editable form with all patient fields

#### Profile Display (Home Tab)
Displays user's health information in card format:
- Profile picture with name and email
- Age (computed from DOB)
- Gender
- Blood Group
- Date of Birth
- Phone Number
- ABHA ID
- Edit Profile button

#### Profile Edit Form (Profile Tab)
```tsx
const renderProfile = () => (
  <div className="space-y-6">
    {/* Personal Information Section */}
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Personal Information</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Full Name Input */}
        <input 
          type="text" 
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        
        {/* Date of Birth Input */}
        <input 
          type="date" 
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
        
        {/* Phone Number */}
        <input 
          type="tel" 
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        
        {/* Email (read-only typically) */}
        <input 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        
        {/* Blood Group Dropdown */}
        <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
          <option>A+</option>
          <option>B+</option>
          <option>O+</option>
          <option>AB+</option>
          <option>AB-</option>
          <option>O-</option>
        </select>
        
        {/* Emergency Contact */}
        <input 
          type="tel" 
          value={emergencyContact}
          onChange={(e) => setEmergencyContact(e.target.value)}
        />
        
        {/* ABHA ID */}
        <input 
          type="tel" 
          value={abhaId}
          onChange={(e) => setAbhaId(e.target.value)}
        />
        
        {/* Gender Dropdown */}
        <select value={Gender} onChange={(e) => setGender(e.target.value)}>
          <option>Male</option>
          <option>Female</option>
          <option>Others</option>
        </select>
      </div>
      
      <button onClick={updateProfile} className="mt-6">
        Update Profile
      </button>
    </div>
    
    {/* Medical History Section */}
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Medical History</h2>
      
      {/* Allergies Textarea */}
      <textarea 
        placeholder="List any known allergies..."
        value={allergies}
        onChange={(e) => setAllergies(e.target.value)}
      />
      
      {/* Current Medications */}
      <textarea 
        placeholder="List current medications..."
        value={medications}
        onChange={(e) => setMedications(e.target.value)}
      />
      
      {/* Previous Surgeries */}
      <textarea 
        placeholder="List any previous surgeries..."
        value={surgeries}
        onChange={(e) => setSurgeries(e.target.value)}
      />
    </div>
  </div>
);
```

#### Profile Update Function
```typescript
const updateProfile = async () => {
  const payload = {
    name: fullName,
    phone: phone,
    dob: dob,
    gender: Gender,
    bloodgroup: bloodGroup,
    age: computeAge(dob),  // Computed from DOB
    emergency_contact: emergencyContact,
    abha_id: abhaId,
    allergies: allergies,
    medications: medications,
    surgeries: surgeries,
    allergy: allergies,  // Support both singular and plural
    role: profile?.role || sessionUser?.role || localStorage.getItem('role') || 'patient',
  };

  const res = await fetch(buildApiUrl('/api/users/update-profile'), {
    method: 'PUT',
    headers: getAuthHeaders(),  // Includes Authorization header
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    await refreshProfile();  // Sync with backend
    alert('Profile updated successfully.');
  }
};
```

### 4.4 State Synchronization
```typescript
// State loaded from profile/localStorage
const [fullName, setFullName] = useState('');
const [dob, setDob] = useState('');
const [phone, setPhone] = useState('');
const [Gender, setGender] = useState('');
const [bloodGroup, setBloodGroup] = useState('');
const [emergencyContact, setEmergencyContact] = useState('');
const [abhaId, setAbhaId] = useState('');
const [allergies, setAllergies] = useState('');
const [medications, setMedications] = useState('');
const [surgeries, setSurgeries] = useState('');

// Sync with backend profile on mount
useEffect(() => {
  if (profile) {
    setFullName(profile.name || '');
    setDob(profile.dob || '');
    setPhone(profile.phone || '');
    setGender(profile.gender || '');
    setBloodGroup(profile.bloodgroup || '');
    setEmergencyContact(profile.emergency_contact || '');
    setAbhaId(profile.abha_id || '');
    setAllergies(profile.allergies || profile.allergy || '');
    setMedications(profile.medications || '');
    setSurgeries(profile.surgeries || '');
  }
}, [profile]);
```

---

## 5. Complete Data Flow Architecture

### 5.1 New Patient Signup Flow (Google OAuth)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. PATIENT INITIATES GOOGLE OAUTH LOGIN                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        Frontend: Google Sign-In (captures ID token)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. POST /api/users/google-login                                 │
│    Header: Authorization: Bearer <google_id_token>              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        Backend: verify_google_token()
        ├─ Validates with Google's OAuth servers
        ├─ Extracts: email, name, picture, google_id
        └─ Checks if user exists in DB
                              ↓
        ┌─────────────────────────────────────┐
        │ NEW USER (First Time)                │
        └─────────────────────────────────────┘
                              ↓
        Response:
        {
          "is_new_user": true,
          "user": {
            "user_id": null,  ← Not created yet
            "email": "user@gmail.com",
            "name": "John Doe",
            "picture": "https://...",
            ...
          },
          "message": "Please complete your profile"
        }
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. FRONTEND: Show ProfileCompletion Form                        │
│    - Pre-fill with Google data (name, picture, email)           │
│    - Require: age/dob, gender, bloodgroup, allergy             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        User fills form and clicks "Complete Profile"
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. POST /api/users/signup                                       │
│    Body: {                                                       │
│      "name": "John Doe",                                        │
│      "email": "user@gmail.com",                                │
│      "role": "patient",                                         │
│      "dob": "1993-01-15",                                       │
│      "age": 30,                                                 │
│      "gender": "Male",                                          │
│      "bloodgroup": "O+",                                        │
│      "allergy": "Penicillin",                                  │
│      "picture": "https://...",                                 │
│      "password": ""  ← Empty for Google users                  │
│    }                                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        Backend:
        ├─ Create User record in DB
        ├─ Hash password (empty → empty hash)
        └─ Return user with generated local token
                              ↓
        Response:
        {
          "id": 123,
          "user_id": 123,  ← Now has DB ID
          "name": "John Doe",
          "email": "user@gmail.com",
          "role": "patient",
          "age": 30,
          "gender": "Male",
          "bloodgroup": "O+",
          "allergy": "Penicillin",
          "token": "local:123"  ← JWT Token for future requests
        }
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. FRONTEND: Save & Redirect                                    │
│    - localStorage.setItem('token', 'local:123')                │
│    - Navigate to PatientDashboard                               │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Existing Patient Login Flow

```
POST /api/users/google-login (same email exists)
                ↓
Backend finds user in DB
                ↓
Response:
{
  "is_new_user": false,
  "user": { ...full user data... },
  "token": "local:123",
  "message": "Login successful"
}
                ↓
Frontend: localStorage.setItem('token', 'local:123')
          Navigate directly to PatientDashboard (no profile form)
```

### 5.3 Profile Fetch & Display Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ PatientDashboard Component Mounts                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        useBackendProfile hook:
        ├─ useEffect(() => refreshProfile(), [])
        └─ Called on component mount
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ GET /api/users/me                                               │
│ Header: Authorization: Bearer local:123                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        Backend:
        ├─ resolve_current_user():
        │  ├─ Parse Authorization header
        │  ├─ Extract user_id from "local:123"
        │  └─ Query DB: SELECT * FROM users WHERE id=123
        ├─ Return serialize_user(user)
                              ↓
        Response:
        {
          "id": 123,
          "user_id": 123,
          "name": "John Doe",
          "email": "user@gmail.com",
          "role": "patient",
          "dob": "1993-01-15",
          "age": 30,
          "gender": "Male",
          "bloodgroup": "O+",
          "phone": "9876543210",
          "abha_id": "ABHA123",
          "allergy": "Penicillin",
          "profile_picture_url": "https://...",
          "allergies": "Penicillin, Sulfa",
          "medications": "Aspirin, Vitamin D",
          "surgeries": "Appendectomy 2015"
        }
                              ↓
├─ setProfile(data)
├─ Sync form state:
│  ├─ setFullName(profile.name)
│  ├─ setDob(profile.dob)
│  ├─ setPhone(profile.phone)
│  └─ ... all fields
└─ Render ProfileTab with data
```

### 5.4 Profile Update Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ User Edits Profile Form & Clicks "Update Profile"              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        updateProfile() function:
        ├─ Collect form state
        └─ Build payload object
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PUT /api/users/update-profile                                   │
│ Header: Authorization: Bearer local:123                         │
│ Body: {                                                          │
│   "name": "Jane Doe",                                           │
│   "gender": "Female",                                           │
│   "phone": "9876543210",                                        │
│   "dob": "1992-06-20",                                          │
│   "bloodgroup": "AB+",                                          │
│   "allergy": "Peanuts",                                         │
│   ...other fields                                               │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        Backend:
        ├─ resolve_current_user() → Extract user_id from token
        ├─ Query: SELECT * FROM users WHERE id=123
        ├─ Update fields:
        │  ├─ user.name = "Jane Doe"
        │  ├─ user.gender = "Female"
        │  ├─ user.bloodgroup = "AB+"
        │  └─ ... all provided fields
        ├─ db.commit()
        └─ Return updated user
                              ↓
        Response: Updated user object
                              ↓
├─ refreshProfile()  ← Sync local state with backend
└─ alert('Profile updated successfully')
```

---

## 6. Key Authentication & Security Details

### Token Management
```typescript
// Frontend (useStoredUser hook / localStorage)
const token = localStorage.getItem('token');           // e.g., "local:123"
const role = localStorage.getItem('role');             // e.g., "patient"

// All API requests
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

// GetAuthHeaders utility function
export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};
```

### User Identification Methods (Priority Order)
1. **JWT Token** (Primary): `Authorization: Bearer local:123`
   - Token format: `local:{user_id}`
   - Extracted by: `resolve_current_user()` middleware

2. **Google OAuth Token** (Alternative): `Authorization: Bearer <google_id_token>`
   - Verified against Google OAuth servers
   - Email used to lookup user in DB

3. **X-User-Id Header** (Legacy/Fallback): `X-User-Id: 123`
   - Direct user ID in header

### Password & Security
- Passwords hashed with **bcrypt** during signup
- Google OAuth users have empty password hash (no password auth)
- Email-based uniqueness constraint enforced in DB

---

## 7. API Schemas & Types

### File Location
📁 [healthconnect-backend/schemas.py](healthconnect-backend/schemas.py)

```python
class UserCreate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    dob: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    bloodgroup: Optional[str] = None
    abha_id: Optional[str] = None
    allergy: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    surgeries: Optional[str] = None
    picture: Optional[str] = None
    profile_picture_url: Optional[str] = None

class UserResponse(BaseModel):
    id: Optional[int] = None
    user_id: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    dob: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    bloodgroup: Optional[str] = None
    abha_id: Optional[str] = None
    allergy: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    surgeries: Optional[str] = None
    picture: Optional[str] = None
    profile_picture_url: Optional[str] = None
    token: Optional[str] = None

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    bloodgroup: Optional[str] = None
    abha_id: Optional[str] = None
    age: Optional[int] = None
    emergency_contact: Optional[str] = None
    role: Optional[str] = None
    allergy: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    surgeries: Optional[str] = None
    picture: Optional[str] = None
    profile_picture_url: Optional[str] = None

    # Enable camelCase aliases
    model_config = {"populate_by_name": True}
```

---

## 8. Configuration & Deployment

### File Location
📁 [healthconnect-backend/main.py](healthconnect-backend/main.py)

### CORS Configuration (Multi-Origin Support)
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",           # Local frontend dev
        "http://localhost:3000",            # Alternative local dev
        "https://medtech-4rjc.onrender.com",    # Production
        "https://medtech-hcmo.onrender.com"     # Alternate production
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    expose_headers=["Content-Length"],
    max_age=600  # Cache preflight for 10 minutes
)
```

### Router Mounting (Dual Path Support)
```python
# Users endpoints available at both paths for frontend compatibility
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(users.router, prefix="/users", tags=["Users"])
```

### Database Initialization
- Automatic table creation on startup via SQLAlchemy `Base.metadata.create_all()`
- Automatic column addition for SQLite (ALTER TABLE on startup)
- Supports PostgreSQL, MySQL, SQLite

---

## 9. Frontend Configuration

### File Location
📁 [healthconnect-frontend/src/config/api.ts](healthconnect-frontend/src/config/api.ts)

### API URL Building
```typescript
export const buildApiUrl = (path: string): string => {
  // Returns appropriate API endpoint based on environment
  // Typically: "https://medtech-hcmo.onrender.com/api/..."
};
```

### Component Hooks
```typescript
// useStoredUser: Retrieves user data from localStorage
const { sessionUser, getProfile, setProfile } = useStoredUser();

// useBackendProfile: Fetches and manages profile from backend
const { profile, loading, error, refreshProfile } = useBackendProfile();
```

---

## 10. Error Handling & Edge Cases

### Common Error Scenarios

| Scenario | Status | Response | Handling |
|----------|--------|----------|----------|
| Missing Authorization header | 401 | `"Unauthorized"` | Redirect to login |
| Invalid/expired Google token | 401 | `"Invalid or expired Google token"` | Re-authenticate |
| Google client ID mismatch | 401 | `"Invalid token issuer"` | Check environment config |
| User not found (new user) | - | `is_new_user: true` | Show profile form |
| Email already registered | 400 | `"Email already registered"` | Show error, suggest login |
| Missing required fields | 400 | `"name is required"` | Validate form before submit |
| Profile update failed | 500 | `"Failed to update profile: {error}"` | Log error, show alert |

### Age Calculation
```typescript
const computeAgeFromDob = (dob: string) => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  
  return age >= 0 ? age : null;
};
```

---

## 11. Summary Table

| Component | Location | Purpose | Key Methods |
|-----------|----------|---------|------------|
| **Database Model** | `models.py` | User profile schema | 21 fields total |
| **Backend Routes** | `routers/users.py` | Profile APIs | GET /me, PUT /update-profile |
| **Auth Middleware** | `routers/users.py` | Token validation | `resolve_current_user()` |
| **Google OAuth** | `utils/auth.py` | OAuth verification | `verify_google_token()` |
| **Profile Hook** | `useBackendProfile.ts` | Data fetching | `refreshProfile()` |
| **Profile Form** | `PatientDashboard.tsx` | Edit UI | `renderProfile()` |
| **Completion Form** | `ProfileCompletion.tsx` | Signup UI | `handleSubmit()` |
| **API Config** | `config/api.ts` | URL building | `buildApiUrl()` |
| **Auth Headers** | `useBackendProfile.ts` | Token inclusion | `getAuthHeaders()` |

---

## 12. Quick Reference: Adding New Profile Fields

To add a new patient profile field (e.g., "preferred_language"):

1. **Database Model** (`models.py`):
   ```python
   preferred_language = Column(String, nullable=True)
   ```

2. **Schema** (`schemas.py`):
   ```python
   class UserCreate(BaseModel):
       preferred_language: Optional[str] = None
   
   class UserResponse(BaseModel):
       preferred_language: Optional[str] = None
   
   class UserProfileUpdate(BaseModel):
       preferred_language: Optional[str] = None
   ```

3. **Frontend Hook** (`useBackendProfile.ts`):
   ```typescript
   type BackendProfile = {
       preferred_language?: string | null;
   };
   ```

4. **Frontend Form** (`PatientDashboard.tsx`):
   ```tsx
   const [preferredLanguage, setPreferredLanguage] = useState('');
   
   // In renderProfile():
   <input 
     value={preferredLanguage}
     onChange={(e) => setPreferredLanguage(e.target.value)}
   />
   
   // In updateProfile():
   payload.preferred_language = preferredLanguage;
   ```

---

**Document Generated**: April 6, 2026  
**System Version**: MedTech HealthConnect Platform  
**Last Updated**: Current implementation
