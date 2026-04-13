# COOP Fix - Code Changes Summary

## Backend Changes

### File: `healthconnect-backend/app.js`

**Location:** After CORS configuration (lines 59-79)

**Change:** Added security headers middleware for COOP (Cross-Origin-Opener-Policy) and COEP (Cross-Origin-Embedder-Policy)

```javascript
// ============ SECURITY HEADERS FOR COOP/COEP ============
// These headers allow cross-origin popup communication (Google Auth, postMessage, etc.)
app.use((req, res, next) => {
  // COOP: same-origin-allow-popups allows popups to communicate back via postMessage
  // This is required for Google OAuth popup to communicate with the opener window
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  
  // COEP: unsafe-none allows loading cross-origin resources
  // Necessary for WebRTC, analytics, and other cross-origin features
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  console.log('[SECURITY] Headers set - COOP:', res.getHeader('Cross-Origin-Opener-Policy'), 
              'COEP:', res.getHeader('Cross-Origin-Embedder-Policy'));
  
  next();
});
```

**Why:** 
- `same-origin-allow-popups` allows Google OAuth popup to post messages back to opener
- `unsafe-none` allows WebRTC and cross-origin media resources to load
- Additional headers enhance security against other attacks

---

## Frontend Changes

### File 1: `healthconnect-frontend/index.html`

**Location:** In the `<head>` section (lines 5-8)

**Change:** Added COOP and COEP meta tags

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!-- COOP and COEP headers allow cross-origin popup communication (Google OAuth) -->
    <!-- same-origin-allow-popups: allows popups opened by this page to communicate back -->
    <!-- unsafe-none: allows loading resources from other origins -->
    <meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin-allow-popups" />
    <meta http-equiv="Cross-Origin-Embedder-Policy" content="unsafe-none" />
    
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MedTech</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Why:**
- Backend headers take precedence, but HTML meta tags provide fallback
- Ensures compatibility across different browser versions
- Some browsers require both to be set

---

### File 2: `healthconnect-frontend/src/hooks/useBackendProfile.ts`

**Location:** After the `getAuthHeaders()` function (after line 51)

**Change:** Added new `getFetchOptions()` helper function for cross-origin requests with credentials

```typescript
/**
 * Get fetch options with auth headers and credentials for cross-origin requests
 * Includes credentials: 'include' to allow cookies and auth tokens to be sent
 */
export const getFetchOptions = (method = 'GET'): RequestInit => {
  return {
    method,
    headers: getAuthHeaders(),
    credentials: 'include', // Important for CORS + auth + COOP policies
  };
};
```

**Why:**
- `credentials: 'include'` is essential for COOP policies to work with authentication
- Allows authentication tokens to be sent with cross-origin fetch requests
- Maintains session cookies across origins

**Usage example** (for future use):
```typescript
const response = await fetch(url, getFetchOptions('POST'));
// Instead of:
const response = await fetch(url, {
  method: 'POST',
  headers: getAuthHeaders(),
  // Missing credentials: 'include' would fail with COOP policies
});
```

---

## No Changes Required (Already Correct)

### Google OAuth Handler: `healthconnect-frontend/src/components/Login.tsx`
- ✅ Token is correctly stored in localStorage
- ✅ CORS credentials handling is already proper
- ✅ No postMessage issues in current codebase
- **Action:** No changes needed

### CORS Configuration: `healthconnect-backend/app.js` (lines 40-51)
- ✅ Already has `credentials: true`
- ✅ Already has correct origin whitelist
- ✅ Already has proper methods and headers
- **Action:** No changes needed

### AuthContext: `healthconnect-frontend/src/contexts/AuthContext.tsx`
- ✅ Token persistence with localStorage is correct
- ✅ logout function properly clears token
- **Action:** No changes needed

---

## Deployment Steps

### For Backend (Node.js/Express)
1. Edit `healthconnect-backend/app.js`
2. Add the security headers middleware after CORS setup (shown above)
3. Commit and push to GitHub
4. Render will auto-deploy
5. Verify: `curl -i https://medtech-4rjc.onrender.com/health` shows COOP headers

### For Frontend (React/Vite)
1. Edit `healthconnect-frontend/index.html` - add meta tags in head
2. Edit `healthconnect-frontend/src/hooks/useBackendProfile.ts` - add getFetchOptions helper
3. Commit and push to GitHub
4. Render will auto-deploy (runs `npm install && npm run build`)
5. Verify: Open DevTools → Elements → check head for COOP meta tags
6. **Important:** Hard refresh browser cache (Ctrl+Shift+Delete)

---

## Testing Checklist

After deployment:

- [ ] Backend shows `[SECURITY] Headers set...` in startup logs
- [ ] `curl -i` shows `Cross-Origin-Opener-Policy: same-origin-allow-popups`
- [ ] Google OAuth popup opens and closes without COOP errors
- [ ] Doctor dashboard receives real-time patient updates
- [ ] Patient dashboard receives doctor assignment messages
- [ ] WebRTC video streams establish successfully
- [ ] Browser console has no "Cross-Origin-Opener-Policy" error messages
- [ ] Network tab shows requests to correct backend domain

---

## Quick Reference

### COOP Header Values
- `same-origin-allow-popups` = ✅ Our choice (secure but allows OAuth popups)
- `same-origin` =  Most restrictive, breaks OAuth
- `unsafe-none` = Least secure

### COEP Header Values  
- `unsafe-none` = ✅ Our choice (allows WebRTC media loading)
- `require-corp` = Most restrictive, breaks WebRTC

### Why Both Backend + Frontend Settings Needed
1. **Backend headers** are the authoritative source
2. **HTML meta tags** provide fallback for edge cases
3. **Fetch credentials** ensure tokens work in cross-origin requests
4. Together they cover all browser versions and scenarios

---

## Files Summary

| File | Type | Change | Lines |
|------|------|--------|-------|
| `app.js` | Backend | Add COOP/COEP middleware | 59-79 |
| `index.html` | Frontend | Add COOP/COEP meta tags | 5-8 |
| `useBackendProfile.ts` | Frontend | Add getFetchOptions helper | After line 51 |

**Total Changes:** 3 files, ~40 lines of code

---

## Verification Commands

```bash
# Check backend headers
curl -i https://medtech-4rjc.onrender.com/health

# Check specific header
curl -I https://medtech-4rjc.onrender.com/health | grep Cross-Origin

# View all response headers
curl -v https://medtech-4rjc.onrender.com/health 2>&1 | grep "<"
```

**Expected output includes:**
```
Cross-Origin-Opener-Policy: same-origin-allow-popups
Cross-Origin-Embedder-Policy: unsafe-none
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
```

---

## Browser Console Verification

After loading https://medtech-4rjc.onrender.com, check console for:

```javascript
// ✅ Should see (no COOP errors)
// ❌ Should NOT see
"Cross-Origin-Opener-Policy policy would block..."
```

---

## Impact Analysis

### Security Impact
- ✅ **Improves security** by allowing only necessary cross-origin access
- ✅ Maintains protection against clickjacking and MIME sniffing
- ✅ Uses strict referrer policy for privacy

### Performance Impact
- ✅ **Zero performance impact** - headers are just metadata
- ✅ ~100 bytes added to HTTP response size (negligible)
- ✅ No JavaScript processing overhead

### Compatibility Impact
- ✅ Works with all modern browsers (Chrome 83+, Firefox 79+, Safari 15.1+)
- ✅ Older browsers ignore the headers gracefully
- ✅ No version-specific code required

---

## Rollback Instructions

If needed, revert the changes:

```bash
# Option 1: Revert specific commits
git revert <backend-commit-hash>
git revert <frontend-commit-hash>

# Option 2: Manual revert
# - Remove the security headers middleware from app.js
# - Remove the COOP meta tags from index.html
# - Keep the getFetchOptions helper (it's harmless)

git push origin main
```

**Note:** Without these fixes, COOP will default to `same-origin`, which breaks:
- Google OAuth popup communication
- Some cross-origin features
- Real-time synchronization

---

**Status:** ✅ All fixes implemented and ready for deployment
**Date:** April 14, 2026
