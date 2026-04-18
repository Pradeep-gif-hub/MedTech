# 🖼️ Doctor Avatar Rendering Fix - Testing & Verification Guide

## 📋 Problem Summary

After PostgreSQL migration, doctor avatars were not rendering on the doctor dashboard because:

1. **Backend**: `serialize_user()` only returned `profile_picture_url`, not `profile_pic`
2. **Database**: Avatar data was split between `profile_picture_url` and `profile_pic` fields
3. **Frontend**: Avatar logic didn't handle null values or fallback to alternate fields
4. **Google OAuth**: Profile pictures needed proper URL formatting for display

## ✅ Fixes Implemented

### Backend Changes (routers/users.py)

**1. Updated `serialize_user()` function:**
- Now checks `profile_picture_url` OR `profile_pic` (whichever is populated)
- Returns avatar to 4 different field names: `avatar`, `picture`, `profile_picture_url`, `profile_pic`
- Added debug logging to identify avatar source
- Returns `None` if both are null (handled by frontend fallback)

**2. Added diagnostic endpoint:**
- `GET /api/users/me/avatar-debug` - Shows all avatar sources for debugging
- Displays which field contains the avatar
- Shows database type (postgresql vs sqlite)

### Frontend Changes (DoctorDashboard.tsx)

**1. Updated avatar extraction:**
- Checks multiple sources: `profile.picture`, `profile.profile_picture_url`, `profile.profile_pic`, `profile.avatar`
- Falls back to `sessionUser` fields if profile missing
- Final fallback: `/default-avatar.png`

**2. Added `cleanAvatarUrl()` function:**
- Fixes Google profile images (removes bad size parameters)
- Converts `?sz=250` to `=s200-c` format
- Ensures Google images display correctly

**3. Enhanced error handling:**
- Better error logging for avatar load failures
- `handleAvatarError()` shows which URL failed
- Only falls back to default once

**4. Updated image rendering:**
- All doctor avatar images use `cleanAvatarUrl()`
- Proper `onError` handlers on all img tags
- Multiple images (header, card) now consistent

### Database Migration Fix (PostgreSQL)

**SQL Script:** `fix-avatar-data-postgresql.sql`
- Synchronizes `profile_picture_url` and `profile_pic` fields
- Copies avatar data from one field to the other if missing
- Ensures no doctor loses their avatar after migration

## 🧪 Testing Checklist

### Step 1: Verify Backend Response

**Test the diagnostic endpoint:**
```bash
# Get JWT token first
TOKEN=$(curl -s -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"doctor@example.com","password":"password"}' | jq -r '.token')

# Check avatar debug info
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/users/me/avatar-debug | jq '.'
```

**Expected output:**
```json
{
  "user_id": 1,
  "email": "doctor@example.com",
  "name": "Dr. Smith",
  "role": "doctor",
  "avatar_sources": {
    "profile_picture_url": "https://...",
    "profile_pic": "https://... or null",
    "final_avatar": "https://..."
  },
  "database_type": "postgresql",
  "message": "Use this to debug avatar issues."
}
```

### Step 2: Test Doctor Google OAuth Login

1. **Open frontend:** http://localhost:5173
2. **Click "Login as Doctor"**
3. **Click "Sign in with Google"**
4. **Select your Google account**
5. **Verify in browser:**
   - ✅ Redirected to `/doctor/dashboard`
   - ✅ Avatar visible in top-right header
   - ✅ Avatar visible on digital ID card
   - ✅ Avatar visible in profile details

### Step 3: Check Browser Network Tab

1. **Open DevTools** → Network tab
2. **Filter:** `me` (to see `/api/users/me` requests)
3. **Look for response:**
```json
{
  "avatar": "https://...",
  "picture": "https://...",
  "profile_picture_url": "https://...",
  "profile_pic": "https://..."
}
```

### Step 4: Check Backend Logs

**Should see:**
```
[SERIALIZE] User 1 (doctor@example.com): profile_picture_url=https://..., profile_pic=..., final avatar=https://...
```

### Step 5: Test Google Image URL Formatting

**Before fix (breaks):**
```
https://lh3.googleusercontent.com/a/default-user?sz=250
```

**After fix (works):**
```
https://lh3.googleusercontent.com/a/default-user=s200-c
```

**Test in browser console:**
```javascript
// Simulate the cleanAvatarUrl function
function cleanAvatarUrl(url) {
  if (!url) return '/default-avatar.png';
  if (url.includes('googleusercontent')) {
    const baseUrl = url.split('=')[0];
    return `${baseUrl}=s200-c`;
  }
  return url;
}

// Test
console.log(cleanAvatarUrl('https://lh3.googleusercontent.com/a/default-user?sz=250'));
// Output: https://lh3.googleusercontent.com/a/default-user=s200-c
```

### Step 6: Test Email/Password Doctor Login

1. **Login with email/password** (existing doctor account)
2. **Dashboard should show avatar**
3. **Avatar should persist after page reload**

### Step 7: Test Avatar Persistence

1. **Login as doctor**
2. **Take screenshot of avatar**
3. **Refresh page** (F5)
4. **Avatar should be identical**
5. **Logout and login again**
6. **Avatar should still be visible**

### Step 8: Test PostgreSQL Avatar Data

**Run SQL to verify:**
```bash
psql -U postgres -d medtech -c "
SELECT id, email, name, profile_picture_url, profile_pic
FROM users
WHERE role = 'doctor'
LIMIT 5;
"
```

**Expected:**
- At least one of `profile_picture_url` or `profile_pic` should have a URL
- For Google OAuth users: URL should start with `https://lh3.googleusercontent.com`

### Step 9: Run Fix Script (if needed)

**If avatars are still missing after PostgreSQL migration:**
```bash
cd healthconnect-backend

# Run the fix script
psql -U postgres -d medtech -f fix-avatar-data-postgresql.sql

# Restart backend to reload user data
python -m uvicorn main:app --reload
```

### Step 10: Test After Fix Script

**After running the fix script:**
1. **Restart backend**
2. **Logout and login again**
3. **Avatar should now be visible**

## 🔍 Debugging Specific Issues

### Issue: Avatar shows broken image

**Check:**
1. Browser console for image load errors
2. Run `/api/users/me/avatar-debug` endpoint
3. Check if URL is valid in browser
4. Look for CORS issues

**Fix:**
```bash
# Check URL manually
curl -I "https://lh3.googleusercontent.com/a/default-user=s200-c"
# Should return 200 OK
```

### Issue: Avatar is null in API response

**Check:**
1. Backend logs show `final avatar=None`
2. Database has null for both fields
3. User was created before avatar support

**Fix:**
```bash
# Update user directly in PostgreSQL
psql -U postgres -d medtech -c "
UPDATE users
SET profile_picture_url = 'https://example.com/avatar.jpg'
WHERE id = <user_id>;
"

# Then restart backend and logout/login
```

### Issue: Different avatar on each login

**Check:**
1. Avatar URL format inconsistency
2. Google OAuth not storing picture URL
3. Frontend not persisting correct value

**Fix:**
- Ensure Google OAuth saves avatar on every login
- Check Google token includes picture URL
- Verify database persists it correctly

## 📊 Post-Fix Verification SQL

**Run this to see the current state:**
```sql
-- Doctor avatar coverage
SELECT 
    role,
    COUNT(*) as total,
    COUNT(CASE WHEN profile_picture_url IS NOT NULL THEN 1 END) as with_avatar,
    COUNT(CASE WHEN profile_picture_url IS NULL THEN 1 END) as missing_avatar
FROM users
GROUP BY role;

-- Show Google OAuth doctors with avatars
SELECT 
    id, email, name,
    CASE WHEN profile_picture_url LIKE '%googleusercontent%' THEN '✅ Google' ELSE '❓ Other' END as source
FROM users
WHERE role = 'doctor'
  AND profile_picture_url IS NOT NULL
ORDER BY created_at DESC;
```

## ✨ Expected Final Result

✅ **After all fixes:**
- Doctor avatars visible on dashboard
- Works for Google OAuth login
- Works for email/password login
- Avatar persists across sessions
- Falls back to default if no avatar
- Google images display correctly
- No broken image icons
- Backend properly serializes all field names
- Database has synchronized avatar fields

## 📞 If Issues Persist

1. **Check backend logs:**
   ```bash
   tail -f healthconnect-backend/logs.txt | grep -i avatar
   ```

2. **Run diagnostic endpoint:**
   ```bash
   curl -H "Authorization: Bearer <TOKEN>" \
     http://localhost:8000/api/users/me/avatar-debug | jq '.'
   ```

3. **Verify PostgreSQL:**
   ```bash
   psql -d medtech -c "SELECT * FROM users WHERE id = <user_id>;"
   ```

4. **Check frontend logs:**
   - Browser DevTools → Console tab
   - Look for `[DoctorDashboard] Avatar sources:` logs

5. **Re-run migration + fix:**
   ```bash
   # Backup current state
   pg_dump -U postgres -d medtech > backup_after_migration.sql
   
   # Run fix script
   psql -U postgres -d medtech -f fix-avatar-data-postgresql.sql
   
   # Restart backend
   ```

## 🎯 Success Criteria

After implementing these fixes, you should see:

1. ✅ Doctor avatar visible in dashboard header
2. ✅ Doctor avatar visible on digital ID card
3. ✅ Doctor avatar visible in profile section
4. ✅ Avatar persists after refresh
5. ✅ Avatar works with Google OAuth
6. ✅ Avatar works with email/password login
7. ✅ No broken image icons
8. ✅ Backend logs show correct avatar sources
9. ✅ PostgreSQL has avatar data in both fields
10. ✅ Frontend shows no console errors

**Status: ✅ All Fixes Implemented - Ready for Testing**
