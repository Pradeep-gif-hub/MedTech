# Google OAuth Origin Mismatch - Fix Summary

## Problem Statement
Custom domain `https://medtech.awasthi.tech` was failing with `Error 400: origin_mismatch` on Google OAuth login, while the Render backend `https://medtech-4rjc.onrender.com` worked fine.

## Root Cause
Google OAuth credentials registered only for `https://medtech-4rjc.onrender.com`. Custom domain requests were rejected by Google's OAuth servers because the origin was not in the registered list.

## Solution Type
**Temporary Workaround** - Routes OAuth through the registered backend domain while keeping frontend UI on custom domain.

## Files Modified

### 1. Backend Configuration
**File:** `healthconnect-backend/main.py` (lines 119-130)

**Change:** Added custom domain to CORS allowed origins
```python
cors_origins = [
    # ... existing origins ...
    "https://medtech.awasthi.tech",  # ← NEW
]
```

**Impact:** 
- ✅ Allows CORS preflight requests from custom domain
- ✅ Enables OAuth flow to complete
- ✅ No breaking changes to existing Render-based flows

---

### 2. Frontend OAuth Routing
**File:** `healthconnect-frontend/src/components/Login.tsx` (lines 291-312)

**Change:** Override OAuth endpoint to use Render backend explicitly
```typescript
// NEW: Route OAuth through Render backend where Google creds are registered
const oauthBackendUrl = 'https://medtech-4rjc.onrender.com';
const apiUrl = `${oauthBackendUrl}/api/users/google-login`;
```

**Impact:**
- ✅ OAuth requests bypass origin_mismatch error
- ✅ Uses domain with registered Google credentials
- ✅ Transparent to user experience
- ✅ No impact on other API calls

---

## Technical Explanation

### Why This Works
1. **Google OAuth validates request origin** → Uses registered domain (Render)
2. **CORS allows cross-domain requests** → Custom domain in allowed origins
3. **JWT tokens work cross-domain** → Stored in localStorage, sent via header
4. **Client-side routing handles navigation** → User redirected to custom domain dashboard

### Architecture Flow
```
https://medtech.awasthi.tech (User's Browser)
    ↓ Click "Sign in with Google"
    ↓
Google OAuth (validates against Render domain)
    ↓ User grants permission
    ↓
POST /api/users/google-login (to medtech-4rjc.onrender.com)
    ↓ Backend processes, creates user
    ↓
Response: { token: "local:123", user: {...} }
    ↓ Frontend stores JWT in localStorage
    ↓
Client-side route change (stays on custom domain)
    ↓
User sees dashboard at https://medtech.awasthi.tech/patient/home
    ↓
Subsequent API calls include JWT token in Authorization header
```

### Security Model
- **No cookies** → No CSRF vulnerability
- **JWT in header** → Standard OAuth pattern
- **localStorage scope** → Can't access Render domain storage
- **HTTP-only not needed** → Not using cookies

---

## Verification Checklist

Before deploying, verify:

- [ ] **Backend deployed** with updated CORS origins
- [ ] **Frontend deployed** with updated OAuth URL
- [ ] **Test on Chrome/Firefox/Safari** for cross-domain behavior
- [ ] **Network DevTools** shows OAuth request to Render backend
- [ ] **JWT token** present in localStorage after login
- [ ] **Dashboard loads** without errors
- [ ] **Subsequent API calls work** (e.g., fetch user profile)
- [ ] **No console errors** or CORS warnings

### Manual Test Steps

1. **On Custom Domain Frontend:**
   ```
   1. Visit https://medtech.awasthi.tech
   2. Click "Sign in with Google"
   3. Select/authenticate with Google account
   4. Verify redirect to dashboard completes
   5. Check Network tab: POST to medtech-4rjc.onrender.com
   6. Check console: No 401/403 errors
   7. Check localStorage: Has "token" key
   ```

2. **Verify JWT Works:**
   ```
   1. Open DevTools → Application → localStorage
   2. Confirm "token" and "role" keys exist
   3. Try page refresh → stays logged in
   4. Try API call in console:
      fetch('https://medtech-4rjc.onrender.com/api/users/me', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      })
   5. Should return current user object
   ```

3. **Regression Testing:**
   ```
   1. Test Render-only OAuth: https://medtech-4rjc.onrender.com
   2. Should still work as before
   3. No errors or warnings
   ```

---

## Why Not Permanent?

This is a **workaround**, not a permanent solution. A better long-term approach would be:

1. **Register custom domain with Google**
   - Add `https://medtech.awasthi.tech` to Google Cloud OAuth credentials
   - Remove hardcoded URL from frontend code
   - Let backend detect origin automatically

2. **Use OAuth abstraction layer**
   - Consider NextAuth.js or similar
   - Handles multi-domain OAuth automatically
   - Better error handling and refresh flows

3. **Separate backend instance**
   - Dedicated backend for custom domain
   - Frontend directs requests to appropriate backend
   - Cleaner separation of concerns

---

## Rollback Plan

If issues arise, can quickly revert:

```bash
# 1. Backend: Remove custom domain from CORS
git revert <commit-hash>

# 2. Frontend: Revert to buildApiUrl()
git revert <commit-hash>

# 3. No database migration needed
# 4. Render-only OAuth will continue working
```

---

## Performance Impact

- **Negligible** - OAuth flow adds only CORS preflight (cached for 1 hour)
- **Network**: 1 additional CORS OPTIONS request (cached)
- **Latency**: No impact - same backend endpoint
- **Throughput**: No impact - same request/response

---

## Support & Troubleshooting

### Common Issues

| Issue | Debug Steps | Solution |
|-------|------------|----------|
| `Error 400: origin_mismatch` after fix | Check CORS config deployed, restart backend | Redeploy backend with updated CORS |
| `No token in response` | Check browser console for error details | Verify Google token is valid |
| `Redirect loop` | Check URL bar - if stuck in loop | Clear localStorage, try incognito mode |
| `API calls fail with 401` | Verify localStorage has "token" key | Re-login, check JWT hasn't expired |
| `CORS error in console` | Check browser DevTools Network tab | Verify custom domain in backend cors_origins |

### Debug Console Commands
```javascript
// Check if logged in
localStorage.getItem('token')

// Check user role
localStorage.getItem('role')

// Check OAuth endpoint
console.log('OAuth endpoint: https://medtech-4rjc.onrender.com/api/users/google-login')

// Verify JWT works
fetch('https://medtech-4rjc.onrender.com/api/users/me', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
}).then(r => r.json()).then(console.log)
```

---

## Deployment Checklist

- [ ] All tests pass locally
- [ ] Backend CORS changes committed
- [ ] Frontend OAuth URL override committed
- [ ] Documentation reviewed
- [ ] Staging deployed and tested
- [ ] Production backend deployed first
- [ ] Wait 5 mins for backend startup
- [ ] Production frontend deployed
- [ ] Smoke test on production
- [ ] Monitor error logs for 30 mins

---

## Contact & Questions

For issues or questions about this fix:
1. Check `OAUTH_FIX_DOCUMENTATION.md` for detailed technical explanation
2. Review browser console and Network tab for specific errors
3. Check backend logs at Render dashboard for server-side issues

