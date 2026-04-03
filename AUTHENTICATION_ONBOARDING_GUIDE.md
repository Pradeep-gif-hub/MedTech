# Authentication & Onboarding Flow - Complete Implementation

## Overview
This document details the comprehensive authentication improvements including role-based routing, new user onboarding, and profile completion workflows.

---

## FILES MODIFIED

### 1. Backend: `healthconnect-backend/routers/users.py`

#### Change 1: Updated `/api/users/google-login` Endpoint
**What Changed:**
- Now returns `is_new_user` flag to indicate if user is new
- Wraps user data in a `user` object
- Returns both user data and onboarding status

**Response Structure:**
```json
{
  "user": {
    "user_id": 123,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "patient",
    "age": null,
    "gender": null,
    "bloodgroup": null,
    "allergy": null,
    "profile_picture_url": "...",
    "google_id": "...",
    "picture": "...",
    "email_verified": true
  },
  "is_new_user": true/false,
  "message": "Login successful" or "Please complete your profile"
}
```

**Code Location:** Lines 48-140

#### Change 2: New `/api/users/complete-profile` Endpoint
**What It Does:**
- Accepts user_id, name, age, gender, bloodgroup, allergy, role
- Validates role against allowed values
- Updates user profile in database
- Returns updated user data

**Request Format:**
```json
{
  "user_id": 123,
  "name": "John Doe",
  "age": 30,
  "gender": "Male",
  "bloodgroup": "O+",
  "allergy": "Penicillin",
  "role": "patient"
}
```

**Response:**
```json
{
  "message": "Profile completed successfully",
  "user": {
    "user_id": 123,
    "email": "...",
    "name": "...",
    "role": "patient",
    ...
  }
}
```

**Code Location:** Lines 142-208

---

### 2. Frontend: `healthconnect-frontend/src/App.tsx`

#### Change 1: Added Import
```typescript
import ProfileCompletion from './components/ProfileCompletion';
```

#### Change 2: Extended UserRole and CurrentView Types
```typescript
export type CurrentView =
  | 'landing'
  | 'login-patient'
  | 'login-doctor'
  | 'login-pharmacy'
  | 'login-admin'
  | 'profile-completion'  // NEW
  | 'dashboard'
  | 'public'
  | 'admin';
```

#### Change 3: Added Pending User State
```typescript
const [pendingNewUser, setPendingNewUser] = useState<any>(null);
```

#### Change 4: New Handler for Profile Completion
```typescript
const handleProfileCompletion = (userData: any) => {
  const role = (userData.role || 'patient') as UserRole;
  setUserRole(role);
  setPendingNewUser(null);
  
  // Redirect to dashboard based on role
  if (role === 'admin') {
    setCurrentView('admin');
  } else {
    setCurrentView('dashboard');
  }
};
```

#### Change 5: New Handler for New User Redirect
```typescript
const handleNewUserRedirect = (newUserData: any) => {
  console.log('[App] New user detected, redirecting to profile completion');
  setPendingNewUser(newUserData);
  setCurrentView('profile-completion');
};
```

#### Change 6: Updated Login Handlers
All Login components now receive `onNewUser` prop:
```typescript
<Login
  role="patient"
  onLogin={handleLogin}
  onNewUser={handleNewUserRedirect}  // NEW
  onBack={() => setCurrentView('landing')}
/>
```

#### Change 7: Added Profile Completion Case
```typescript
case 'profile-completion':
  if (pendingNewUser) {
    return (
      <ProfileCompletion
        user={pendingNewUser}
        onComplete={handleProfileCompletion}
      />
    );
  }
  ...
```

---

### 3. Frontend: `healthconnect-frontend/src/components/Login.tsx`

#### Change 1: Updated Interface
```typescript
interface LoginProps {
  onBack: () => void;
  role?: UserRole;
  onLogin: (role: UserRole) => void;
  onNewUser?: (userData: any) => void;  // NEW
}

const Login: React.FC<LoginProps> = ({ onBack, role = 'patient', onLogin, onNewUser }) => {
```

#### Change 2: Enhanced Google Auth Handler
Now checks `is_new_user` flag and routes appropriately:
```typescript
if (is_new_user) {
  // New user - redirect to profile completion
  if (onNewUser) {
    onNewUser(user);
  }
} else {
  // Existing user - login directly
  const userData = saveUserData(user, selectedRole);
  setLoggedIn(true);
  onLogin(userData.role);
}
```

**Full Handler Location:** Lines 210-261

---

### 4. Frontend: NEW FILE `healthconnect-frontend/src/components/ProfileCompletion.tsx`

**Purpose:** New user onboarding form for Google signup

**Features:**
- Collects user profile information (name, age, gender, blood group, allergies, role)
- Validates required fields
- Submits to `/api/users/complete-profile`
- Saves updated user data to localStorage
- Dispatches `user-updated` event
- Redirects to role-based dashboard

**Props:**
```typescript
interface ProfileCompletionProps {
  user: {
    user_id: number;
    email: string;
    name: string;
  };
  onComplete: (userData: any) => void;
}
```

**Form Fields:**
- Full Name (required)
- Age (required, 1-120)
- Gender (required: Male, Female, Other)
- Blood Group (required: O+, O-, A+, A-, B+, B-, AB+, AB-)
- Allergies (optional)
- Role (required: patient, doctor, pharmacy, admin)

---

## AUTHENTICATION FLOW

### Scenario 1: Existing User Google Login

```
1. User clicks "Sign in with Google"
   ↓
2. Google returns credential token
   ↓
3. Frontend sends: POST /api/users/google-login
   Header: Authorization: Bearer {token}
   Body: { role: "patient" }
   ↓
4. Backend:
   - Verifies token
   - Finds user in database (EXISTS)
   - Updates profile picture if needed
   - Returns: { user: {...}, is_new_user: false }
   ↓
5. Frontend:
   - Detects is_new_user: false
   - Saves user to localStorage
   - Calls onLogin(userData.role)
   - Redirects to role-based dashboard
   ↓
6. Dashboard loads (patient → /patient/home, doctor → /doctor/dashboard, etc.)
   ✅ SUCCESS
```

### Scenario 2: New User Google Signup

```
1. User clicks "Sign in with Google"
   ↓
2. Google returns credential token
   ↓
3. Frontend sends: POST /api/users/google-login
   Header: Authorization: Bearer {token}
   Body: { role: "patient" }
   ↓
4. Backend:
   - Verifies token
   - Searches database (NOT FOUND)
   - Creates temporary user with default role
   - Returns: { user: {...}, is_new_user: true }
   ↓
5. Frontend:
   - Detects is_new_user: true
   - Calls onNewUser(userData)
   - Redirects to /complete-profile
   ↓
6. ProfileCompletion component shows:
   - Full Name (pre-filled from Google)
   - Age (empty)
   - Gender (required)
   - Blood Group (required)
   - Allergies (optional)
   - Role selector (required)
   ↓
7. User fills form and clicks "Complete Profile & Continue"
   ↓
8. Frontend sends: POST /api/users/complete-profile
   Body: { user_id, name, age, gender, bloodgroup, allergy, role }
   ↓
9. Backend:
   - Validates role
   - Updates user profile
   - Returns updated user data
   ↓
10. Frontend:
    - Saves updated user to localStorage
    - Dispatches user-updated event
    - Calls onComplete(userData)
    - Redirects to role-based dashboard
    ↓
11. Dashboard loads with correct role
    ✅ SUCCESS
```

### Scenario 3: App Reload with Existing Session

```
1. Page reloads (user still has localStorage['user'])
   ↓
2. App.tsx mounts
   ↓
3. useEffect runs:
   - Checks localStorage['user']
   - Parses user data
   - Sets userRole
   - Updates currentView to 'dashboard'
   ↓
4. App renders dashboard based on role:
   - role: "patient" → PatientDashboard (which has /patient/home as default)
   - role: "doctor" → DoctorDashboard
   - role: "pharmacy" → PharmacyDashboard
   - role: "admin" → AdminPanel
   ✅ SUCCESS - User stays logged in
```

---

## ROLE-BASED ROUTING

After login, users are routed based on their role:

| Role | Landing Path | Component |
|------|-------------|-----------|
| `patient` | `/patient/home` | PatientDashboard |
| `doctor` | `/doctor/dashboard` | DoctorDashboard |
| `pharmacy` | `/pharmacy/dashboard` | PharmacyDashboard |
| `admin` | `/admin/dashboard` | AdminPanel |

**Important:** Patients ALWAYS land on `/patient/home`, not `/prescriptions`

---

## LOCALSTORAGE STRUCTURE

```javascript
// localStorage['user']
{
  "token": "",
  "user_id": "123",
  "email": "user@example.com",
  "name": "John Doe",
  "age": "30",
  "gender": "Male",
  "bloodgroup": "O+",
  "allergy": "Penicillin",
  "role": "patient",
  "profile_picture_url": "https://..."
}

// localStorage['auth_token']
// Google ID token stored here
```

---

## EVENT FLOW

### Custom Event: `user-updated`

Fired when user data changes within the same window:

```typescript
const ev = new CustomEvent('user-updated', { detail: userData });
window.dispatchEvent(ev);
```

**Listeners:**
- App.tsx useEffect listener catches this event
- Updates userRole state
- Redirects from login page if needed

---

## TESTING SCENARIOS

### Test 1: Existing Patient Login ✅
1. Click Google Sign In
2. Select account
3. **Expected:** Redirects to `/patient/home`
4. **Verify:** PatientDashboard shows with patient data

### Test 2: New Patient Signup ✅
1. Click Google Sign In with new account
2. Form shows for profile completion
3. Fill: Name, Age, Gender, Blood Group, keep role as "patient"
4. Click "Complete Profile & Continue"
5. **Expected:** Redirects to `/patient/home`
6. **Verify:** Profile data saved, user stays logged in after refresh

### Test 3: New Doctor Signup ✅
1. Click Google Sign In with new account
2. Form shows for profile completion
3. Fill: Name, Age, Gender, Blood Group, select role as "doctor"
4. Click "Complete Profile & Continue"
5. **Expected:** Redirects to `/doctor/dashboard`
6. **Verify:** Role changed to "doctor"

### Test 4: Session Persistence ✅
1. Login as patient
2. Refresh page (F5)
3. **Expected:** Still on `/patient/home`
4. **Verify:** No redirect to login page

### Test 5: Logout & Login Different Role ✅
1. Login as patient
2. Logout
3. Login as doctor (new account or different account)
4. **Expected:** Redirects to `/doctor/dashboard`
5. **Verify:** Role correctly changed

### Test 6: Profile Picture Update ✅
1. Login as existing user
2. Change Google profile picture
3. Logout and login again
4. **Expected:** Profile picture updated

---

## IMPLEMENTATION CHECKLIST

- [x] Backend: `/api/users/google-login` returns `is_new_user`
- [x] Backend: `/api/users/complete-profile` endpoint created
- [x] Frontend: ProfileCompletion component created
- [x] Frontend: App.tsx handles profile-completion view
- [x] Frontend: Login.tsx handles new user flow
- [x] Frontend: Role-based routing implemented
- [x] Frontend: localStorage persistence working
- [x] Frontend: All error handling in place
- [x] Frontend: Custom event dispatch for updates

---

## DEPLOYMENT NOTES

**Backend:**
- New endpoint: `/api/users/complete-profile`
- Updated endpoint: `/api/users/google-login`
- No database migrations needed (all fields already exist)

**Frontend:**
- New component: `ProfileCompletion.tsx`
- Updated: App.tsx, Login.tsx
- No new dependencies added
- Works with existing buildApiUrl config

**Environment:**
- No new environment variables needed
- All configurations use existing setup

---

## ERROR HANDLING

| Error | Handled By | Recovery |
|-------|-----------|----------|
| Invalid Google token | Backend returns 401 | User shown error, can retry |
| Missing profile fields | Frontend validation | Form won't submit until filled |
| Database error | Backend returns 500 | User shown generic error |
| Network error | Frontend try/catch | User shown retry message |
| Corrupted localStorage | App.tsx catch block | Clears corrupted data, resets to login |

---

## SUMMARY

✅ **Existing users**: Google login → Direct dashboard access
✅ **New users**: Google signup → Profile form → Dashboard
✅ **Session persistence**: localStorage restoration on reload
✅ **Role-based routing**: Patient gets /patient/home, Doctor gets /doctor/dashboard, etc.
✅ **Profile completion**: Required fields enforced, optional fields supported
✅ **No breaking changes**: Existing functionality preserved

The authentication system is now production-ready with proper onboarding, role-based routing, and session management.
