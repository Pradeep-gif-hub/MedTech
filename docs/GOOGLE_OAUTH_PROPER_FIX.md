# Google OAuth Origin Mismatch - PROPER FIX (NOT Workaround)

## 🎯 THE REAL ISSUE

**Google is rejecting requests from `https://medtech.awasthi.tech` because this domain is NOT registered in Google Cloud Console.**

That's it. That's the entire problem.

---

## ✅ WHY YOUR FRONTEND USES `@react-oauth/google`

Your project uses:
```typescript
import { GoogleLogin } from '@react-oauth/google';
```

This means:
- **Google Identity Services (GIS) popup-based authentication**
- **Frontend origin validation** (not backend)
- **Google checks:** `window.location.origin` = `https://medtech.awasthi.tech`
- **Google validates against:** OAuth credentials' "Authorized JavaScript Origins"

### The Key Point:
> Google validates the **FRONTEND ORIGIN**, not the backend API endpoint. The backend URL is completely irrelevant for popup authentication.

---

## 🔴 WHY THE PREVIOUS WORKAROUND WAS WRONG

The previous "fix" tried to route OAuth through:
```typescript
const oauthBackendUrl = 'https://medtech-4rjc.onrender.com';
const apiUrl = `${oauthBackendUrl}/api/users/google-login`;
```

**Why this was wrong:**
1. Google doesn't care about backend URLs for popup auth
2. The error happens BEFORE the backend is even involved
3. Google pops up a dialog at `window.location.origin`
4. Google says: "Is `medtech.awasthi.tech` registered? NO → Error 400"
5. The browser never gets to call any backend URL

---

## ✅ THE PROPER FIX (ONLY STEP REQUIRED)

### Step 1: Add Custom Domain to Google Cloud Console

**Path:** Google Cloud Console → OAuth Consent Screen → OAuth 2.0 Client ID

#### Detailed Steps:

```
1. Go to: https://console.cloud.google.com/
2. Select your project (MedTech)
3. Go to: "APIs & Services" → "Credentials"
4. Find your OAuth 2.0 Client ID (looks like: 693090706948-XXXXX.apps.googleusercontent.com)
5. Click on it to open edit view
6. Scroll to: "Authorized JavaScript Origins"
7. Click: "ADD URI"
8. Enter: https://medtech.awasthi.tech
9. Save
10. Wait 30-60 seconds for changes to propagate
```

**Important:** 
- ✅ Keep existing Render origin: `https://medtech-4rjc.onrender.com`
- ✅ No trailing slash: `https://medtech.awasthi.tech` (not `https://medtech.awasthi.tech/`)
- ✅ HTTPS only (no HTTP for production)
- ✅ Exact domain (no wildcards like `*.awasthi.tech`)

---

## 📊 CURRENT (CORRECT) ARCHITECTURE

### Frontend: `https://medtech.awasthi.tech`
```typescript
// GoogleOAuthProvider wraps app
<GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
  <App />
</GoogleOAuthProvider>

// GoogleLogin button
<GoogleLogin
  onSuccess={handleGoogleLoginSuccess}
  onError={() => handleGoogleError()}
/>
```

**What happens:**
1. User clicks "Sign in with Google"
2. Google popup opens
3. Google checks: "Is `https://medtech.awasthi.tech` registered?"
4. ✅ YES (after we add it to console) → Continues
5. User signs in → Returns credential token to frontend

### Backend: `https://medtech-4rjc.onrender.com` (or AWS EC2)
```python
@router.post("/google-login")
async def google_login(
    request: Request,
    data: dict = Body(None),
    db: Session = Depends(get_db)
):
    # Backend only receives the token AFTER Google validates it
    # Backend then:
    # 1. Verifies the token with Google
    # 2. Creates/updates user
    # 3. Returns JWT
```

**What happens:**
1. Frontend sends credential token (AFTER Google validated it)
2. Backend receives token
3. Backend verifies token is valid
4. Backend creates JWT for user
5. User logs in with JWT

---

## 🔐 TOKEN FLOW (CORRECT IMPLEMENTATION)

```
┌─────────────────────────────────────────────────────────┐
│ User at: https://medtech.awasthi.tech                  │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│ Clicks "Sign in with Google"                            │
│ <GoogleLogin onSuccess={...} />                         │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│ Google popup opens                                       │
│ Google checks origin: window.location.origin            │
│ = "https://medtech.awasthi.tech"                        │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│ Is this origin registered in Google Cloud?              │
│ ✅ YES (after we add it) → PROCEED                      │
│ ❌ NO (before we add it) → ERROR 400: origin_mismatch   │
└─────────────────────────────────────────────────────────┘
           ↓ (after adding to Google Console)
┌─────────────────────────────────────────────────────────┐
│ User signs in with Google account                       │
│ User grants permission                                  │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│ Google returns credential (JWT token)                   │
│ Frontend receives in: onSuccess callback                │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│ Frontend sends credential to backend:                   │
│ POST /api/users/google-login                            │
│ Authorization: Bearer <credential>                      │
│ To: Backend API (any domain)                            │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│ Backend receives credential                             │
│ Backend verifies with Google                            │
│ ✅ Valid → Continue                                      │
│ ❌ Invalid → Return 401                                  │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│ Backend creates user in database                        │
│ Backend generates JWT token                             │
│ Backend returns JWT to frontend                         │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│ Frontend stores JWT in localStorage                     │
│ Frontend redirects to dashboard                         │
│ ✅ User is logged in                                     │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│ User sees: https://medtech.awasthi.tech/patient/home   │
│ Session continues with JWT token                        │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 CODE VERIFICATION

### ✅ Frontend is Correct

**File:** `healthconnect-frontend/src/main.tsx`
```typescript
import { GoogleOAuthProvider } from '@react-oauth/google';

<GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
  <App />
</GoogleOAuthProvider>
```
✅ Correct - provider wraps entire app

**File:** `healthconnect-frontend/src/firebaseConfig.ts`
```typescript
export const GOOGLE_CLIENT_ID = 
  import.meta.env.VITE_GOOGLE_CLIENT_ID || 
  "693090706948-2d1jp6de9otm6u70b6u7n196tn0mdepg.apps.googleusercontent.com";
```
✅ Correct - uses environment variable or fallback

**File:** `healthconnect-frontend/src/components/Login.tsx`
```typescript
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

const handleGoogleLoginSuccess = (credentialResponse: CredentialResponse) => {
  if (credentialResponse.credential) {
    handleGoogleAuth(credentialResponse.credential, false);
  }
};

<GoogleLogin
  onSuccess={handleGoogleLoginSuccess}
  onError={() => handleGoogleError()}
/>
```
✅ Correct - using GoogleLogin component properly

### ✅ Backend Token Verification is Correct

**File:** `healthconnect-backend/utils/auth.py`
```python
async def verify_google_token(request: Request):
    # Extracts token from Authorization header
    # Verifies with Google's servers
    # Returns payload if valid
```
✅ Correct - backend verifies token

**File:** `healthconnect-backend/routers/users.py`
```python
@router.post("/google-login")
async def google_login(request: Request, data: dict = Body(None), db: Session = Depends(get_db)):
    # Receives credential from frontend
    # Verifies token
    # Creates/updates user
    # Returns JWT
```
✅ Correct - endpoint design is proper

---

## ❌ WHAT'S NOT NEEDED

The following are NOT required:

```typescript
// ❌ DO NOT DO THIS - Hardcoded backend URL
const oauthBackendUrl = 'https://medtech-4rjc.onrender.com';
const apiUrl = `${oauthBackendUrl}/api/users/google-login`;

// ❌ DO NOT DO THIS - Custom CORS for custom domain
cors_origins = ["https://medtech.awasthi.tech"]  // Only if you have other reasons

// ❌ DO NOT DO THIS - Extra redirect configuration
// The popup flow handles it automatically
```

---

## ✅ WHAT'S ACTUALLY NEEDED

**ONLY:**

1. Add `https://medtech.awasthi.tech` to Google Cloud Console
2. That's it.

**Why?**
- Frontend domain is recognized by Google ✓
- Popup authentication works ✓
- Credential is returned to frontend ✓
- Frontend sends to backend ✓
- Backend verifies ✓
- Session created ✓

---

## 🧪 TESTING AFTER FIX

### Step 1: Verify Google Console Updated
```
1. Go to Google Cloud Console
2. Find your OAuth 2.0 Client ID
3. Verify "Authorized JavaScript Origins" includes:
   - https://medtech-4rjc.onrender.com ✓
   - https://medtech.awasthi.tech ✓ (newly added)
4. Wait 30-60 seconds for propagation
```

### Step 2: Clear Browser Cache
```
1. Open DevTools (F12)
2. Settings → Clear site data
3. Or: Hard refresh (Ctrl+Shift+R on Windows)
4. Or: Incognito window
```

### Step 3: Test OAuth Flow
```
1. Navigate to: https://medtech.awasthi.tech
2. Click: "Sign in with Google"
3. ✅ Google popup should open (not error)
4. Select your Google account
5. Grant permissions
6. ✅ Redirect to dashboard should work
7. Check localStorage for JWT token
```

### Step 4: Verify in DevTools

**Network Tab:**
```
POST /api/users/google-login
Status: 200
Response: { token: "...", user: {...} }
```

**Console:**
```
No CORS errors
No 401 errors
No origin_mismatch errors
```

**Storage Tab:**
```
localStorage:
- token: local:user_id
- role: patient/doctor/pharmacy/etc
```

---

## 📋 DEPLOYMENT CHECKLIST

- [ ] Verified frontend uses `@react-oauth/google` correctly
- [ ] Verified `GoogleOAuthProvider` wraps app in `main.tsx`
- [ ] Verified `GOOGLE_CLIENT_ID` is from `.env` or `firebaseConfig.ts`
- [ ] Verified backend `google-login` endpoint exists
- [ ] Verified backend calls `verify_google_token`
- [ ] Added `https://medtech.awasthi.tech` to Google Console
- [ ] Waited 30-60 seconds for propagation
- [ ] Cleared browser cache
- [ ] Tested OAuth flow manually
- [ ] Confirmed no CORS/origin_mismatch errors
- [ ] Confirmed JWT token is created
- [ ] Confirmed JWT persists after page reload

---

## 🚨 COMMON MISTAKES TO AVOID

❌ **MISTAKE 1:** Hardcoding backend URL in OAuth handler
```typescript
// WRONG
const oauthBackendUrl = 'https://medtech-4rjc.onrender.com';
const apiUrl = `${oauthBackendUrl}/api/users/google-login`;

// RIGHT
const apiUrl = buildApiUrl('/api/users/google-login');
```

❌ **MISTAKE 2:** Forgetting to add domain to Google Console
- This is 99% of the time the actual issue

❌ **MISTAKE 3:** Using HTTP instead of HTTPS
- Google only accepts HTTPS
- `https://medtech.awasthi.tech` ✓
- `http://medtech.awasthi.tech` ✗

❌ **MISTAKE 4:** Adding trailing slash
- `https://medtech.awasthi.tech` ✓
- `https://medtech.awasthi.tech/` ✗

❌ **MISTAKE 5:** Removing old domain
- Keep both:
  - `https://medtech-4rjc.onrender.com` ✓
  - `https://medtech.awasthi.tech` ✓

---

## 🎓 WHY GOOGLE VALIDATES FRONTEND ORIGIN

### For Popup-Based Auth (Your Case)
```javascript
// Google checks window.location.origin
// This is: https://medtech.awasthi.tech
// Google validates against registered origins
// If not found → Error 400: origin_mismatch
```

### Why?
- Security: Prevents unauthorized origins from stealing OAuth tokens
- OAuth 2.0 spec: Redirect URIs must be pre-registered
- Frontend origin is a form of redirect URI for popup auth

### What This Means:
- The origin must be exactly registered
- No wildcards
- No subdomains (unless explicitly added)
- No trailing slashes

---

## 🔍 TROUBLESHOOTING IF STILL BROKEN

### Issue 1: Still Getting "origin_mismatch"
```
Check 1: Did you add domain to Google Console? (most common)
Check 2: Did you wait 30-60 seconds? (propagation time)
Check 3: Did you clear browser cache?
Check 4: Are you using HTTPS?
Check 5: Is the domain exactly correct? (no trailing slash)
```

### Issue 2: CORS Error in Console
```
Check 1: Is backend deployed?
Check 2: Can you reach backend API directly?
Check 3: Check backend logs for errors
Check 4: Verify token verification isn't failing
```

### Issue 3: Token Not in localStorage After Redirect
```
Check 1: Did backend return token in response?
Check 2: Is handleGoogleLoginSuccess being called?
Check 3: Check browser console for JavaScript errors
Check 4: Check Response body in Network tab
```

### Issue 4: JWT Token Not Working for API Calls
```
Check 1: Is token stored with correct key? (should be "token")
Check 2: Is Authorization header being sent?
Check 3: Is backend verifying JWT correctly?
Check 4: Has JWT expired? (try logging in again)
```

---

## ✅ FINAL VERIFICATION

After adding the domain to Google Console:

```
┌────────────────────────────────────────────┐
│ VERIFICATION CHECKLIST                     │
├────────────────────────────────────────────┤
│ ✓ Frontend uses @react-oauth/google        │
│ ✓ GoogleOAuthProvider wraps app            │
│ ✓ GOOGLE_CLIENT_ID is correct              │
│ ✓ GoogleLogin component used               │
│ ✓ Backend endpoint exists                  │
│ ✓ Backend verifies token with Google       │
│ ✓ Custom domain in Google Console ← KEY    │
│ ✓ HTTPS used (not HTTP)                    │
│ ✓ No trailing slashes                      │
│ ✓ Cache cleared                            │
│ ✓ 60 seconds waited for propagation        │
└────────────────────────────────────────────┘

Result: ✅ OAuth login should work!
```

---

## 🎉 EXPECTED RESULT

After completing this fix:

1. User opens: `https://medtech.awasthi.tech`
2. User clicks: "Sign in with Google"
3. ✅ Google popup opens (NO error)
4. User signs in
5. ✅ Credential returned to frontend
6. ✅ Frontend sends to backend
7. ✅ Backend verifies and creates JWT
8. ✅ User redirected to dashboard
9. ✅ User stays logged in on refresh

**Status: WORKING ✅**

