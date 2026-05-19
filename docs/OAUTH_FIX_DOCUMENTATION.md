# Google OAuth Origin Mismatch - Domain Routing Fix

## Problem
The custom domain frontend `https://medtech.awasthi.tech` was failing with `Error 400: origin_mismatch` when attempting Google OAuth login, because Google credentials are registered only for `https://medtech-4rjc.onrender.com`.

## Root Cause
Google Cloud Console OAuth credentials can only authenticate requests from registered origins. The custom domain was not registered, causing rejection from Google's servers.

## Solution Implemented
Instead of modifying Google Cloud configuration (which is permanent), we implemented a **temporary cross-domain OAuth routing workaround**:

```
User visits: https://medtech.awasthi.tech
     ↓
Clicks "Sign in with Google"
     ↓
Frontend sends OAuth request to: https://medtech-4rjc.onrender.com/api/users/google-login
     ↓
Backend processes OAuth using registered credentials
     ↓
JWT token returned to frontend
     ↓
Frontend redirects user to: https://medtech.awasthi.tech/dashboard
     ↓
Session established using JWT (stored in localStorage)
```

## Changes Made

### 1. Backend Changes (FastAPI)
**File:** `healthconnect-backend/main.py`

**Change:** Added custom domain to CORS allowed origins

```python
cors_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "https://medtech-4rjc.onrender.com",
    "https://medtech-hcmo.onrender.com",
    "https://medtech.awasthi.tech",  # ← NEW: Custom domain for OAuth workaround
]
```

**Reason:** Enables CORS preflight requests from the custom domain to the Render backend during OAuth flow.

### 2. Frontend Changes (React/TypeScript)
**File:** `healthconnect-frontend/src/components/Login.tsx`

**Change:** Override OAuth endpoint URL to use Render backend explicitly

```typescript
// Before:
const apiUrl = buildApiUrl('/api/users/google-login');

// After:
const oauthBackendUrl = 'https://medtech-4rjc.onrender.com';
const apiUrl = `${oauthBackendUrl}/api/users/google-login`;
```

**Reason:** Ensures Google OAuth request goes to the domain where credentials are registered, bypassing the origin_mismatch error.

## Why This Works

### Security
- **JWT Tokens**: The system uses JWT tokens in `localStorage`, not cookies
- **No CSRF Risk**: JWT tokens are sent via `Authorization` header, immune to CSRF
- **Cross-Domain Safe**: localStorage is origin-specific (medtech.awasthi.tech can't access Render's storage)

### Technical Details
1. **OAuth Request**: Cross-domain POST to Render backend is allowed by CORS preflight
2. **Token Response**: Backend returns JWT in response body (not set-cookie)
3. **Session Persistence**: Frontend stores JWT in localStorage
4. **API Calls**: All subsequent API calls include JWT via Authorization header
5. **No Cookies**: No cookies to manage across domains; no SameSite configuration needed

### Flow Diagram
```
Timeline of OAuth Flow:
┌─────────────────────────────────────────┐
│ 1. User at medtech.awasthi.tech         │
│    Clicks "Sign in with Google"         │
└─────────────────────────────────────────┘
           ↓ (Google SDK - same domain)
┌─────────────────────────────────────────┐
│ 2. Google OAuth popup                   │
│    (medtech.awasthi.tech origin ok)     │
└─────────────────────────────────────────┘
           ↓ (User grants permission)
┌─────────────────────────────────────────┐
│ 3. Frontend gets Google ID token        │
│    (JWT from Google)                    │
└─────────────────────────────────────────┘
           ↓ (Cross-domain CORS + Auth header)
┌─────────────────────────────────────────┐
│ 4. POST to Render backend               │
│    /api/users/google-login              │
│    Authorization: Bearer <google-token> │
└─────────────────────────────────────────┘
           ↓ (Google validates token)
┌─────────────────────────────────────────┐
│ 5. Backend creates/updates user         │
│    in database                          │
└─────────────────────────────────────────┘
           ↓ (Returns JWT token)
┌─────────────────────────────────────────┐
│ 6. Frontend receives JWT token          │
│    Stores in localStorage               │
└─────────────────────────────────────────┘
           ↓ (Client-side routing)
┌─────────────────────────────────────────┐
│ 7. User redirected to custom domain:    │
│    https://medtech.awasthi.tech/        │
│    patient/home (or dashboard)          │
└─────────────────────────────────────────┘
           ↓ (JWT from localStorage)
┌─────────────────────────────────────────┐
│ 8. Subsequent API calls with JWT        │
│    Authorization: Bearer <jwt-token>    │
│    to either backend (via VITE_API_URL) │
└─────────────────────────────────────────┘
```

## Limitations & Future Improvements

### Current Workaround Limitations
1. **OAuth hardcoded to Render**: Tight coupling to Render backend domain
2. **API calls also to Render**: All API traffic goes through Render backend (via VITE_API_URL)
3. **Not permanent**: This is a temporary solution until Google credentials can be updated

### Permanent Solution (Future)
When ready to make this production-grade, follow these steps:
1. Add `https://medtech.awasthi.tech` to Google Cloud Console OAuth credentials
2. Update backend CORS origins to support multiple backends if needed
3. Consider using OAuth provider abstraction (NextAuth.js) for better multi-domain support

## Testing Checklist

- [x] Backend CORS configuration updated
- [x] Frontend OAuth endpoint overridden
- [ ] Test OAuth login on `https://medtech.awasthi.tech`
- [ ] Verify redirect to dashboard completes
- [ ] Confirm JWT token persists and works for API calls
- [ ] Test on both new users (profile completion) and existing users
- [ ] Verify Render-only OAuth still works (no breaking changes)
- [ ] Check browser console for errors/warnings

## Network Trace Expected

When testing, check the Network tab in browser DevTools:

```
1. POST /api/users/google-login (to medtech-4rjc.onrender.com)
   Status: 200
   Response includes: { token: "local:user_id", user: {...}, is_new_user: bool }

2. GET /patient/home or /doctor/dashboard (to medtech.awasthi.tech)
   URL changes to custom domain path

3. GET /api/users/me (to medtech-4rjc.onrender.com)
   Header: Authorization: Bearer local:user_id
```

## Environment Notes

**Production Frontend Config** (`.env`):
```
VITE_API_URL=https://medtech-4rjc.onrender.com
VITE_WS_URL=wss://medtech-4rjc.onrender.com
```

**Render Backend** (continuously running):
- CORS configured to accept custom domain
- Google OAuth endpoint active and registered with Google

**Custom Domain**:
- Points to frontend (possibly via Vercel, Netlify, etc.)
- Frontend served from custom domain
- OAuth requests routed back to Render backend

## Rollback Instructions

If issues arise, rollback is simple:

1. Remove custom domain from `cors_origins` in `main.py`
2. Revert Login.tsx to use `buildApiUrl('/api/users/google-login')`
3. No database changes required

## Questions or Issues?

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| `Error 400: origin_mismatch` | Custom domain not in CORS | Verify CORS config includes custom domain |
| `No token in response` | OAuth failed | Check browser console for details |
| `JWT token expires` | Token timeout | Normal - token refresh on next login |
| `Redirect loop` | Wrong redirect URL | Check `roleRoutes` in Login.tsx |
| `API calls fail after login` | CORS issue | Verify VITE_API_URL and backend CORS config |
