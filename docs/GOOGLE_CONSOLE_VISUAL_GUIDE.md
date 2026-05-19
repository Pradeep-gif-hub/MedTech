# Google OAuth Fix - Visual Google Console Guide

## 🎯 WHAT YOU NEED TO DO (ONLY)

Add ONE line to Google Cloud Console:

```
https://medtech.awasthi.tech
```

That's it. That solves the problem.

---

## 📍 STEP-BY-STEP VISUAL GUIDE

### STEP 1: Open Google Cloud Console

```
Go to: https://console.cloud.google.com/
       ↓
Sign in (if needed)
       ↓
Make sure project is: MedTech
```

**Screenshot would show:**
```
┌──────────────────────────────────────────────────┐
│  Google Cloud                                    │
│  console.cloud.google.com                       │
├──────────────────────────────────────────────────┤
│  MedTech    ✓ (project dropdown at top)         │
└──────────────────────────────────────────────────┘
```

---

### STEP 2: Navigate to Credentials

```
Left Sidebar:
└─ APIs & Services
   └─ [Click here]
```

**Then:**
```
Left Menu:
└─ Credentials
   └─ [Click here]
```

**Screenshot would show:**
```
┌────────────────────────────────────────┐
│ APIs & Services                        │
├────────────────────────────────────────┤
│ Dashboard                              │
│ Enabled APIs & Services                │
│ Credentials ← CLICK THIS               │
│ OAuth consent screen                   │
│ Libraries                              │
└────────────────────────────────────────┘
```

---

### STEP 3: Find Your OAuth Client

```
In the Credentials page, you should see:

┌─────────────────────────────────────────────────┐
│ OAuth 2.0 Client IDs                            │
├─────────────────────────────────────────────────┤
│ Name: MedTech Client                            │
│ Client ID: 693090706948-2d1jp6de9o...          │
│ Created: Jan 1, 2026                            │
│ [Click on this row to edit]                     │
└─────────────────────────────────────────────────┘
```

**Click on it** to open the edit screen.

---

### STEP 4: Edit OAuth Client

After clicking, you'll see the full details:

```
┌─────────────────────────────────────────────────┐
│ OAuth 2.0 Client ID                             │
│ (Web application)                               │
├─────────────────────────────────────────────────┤
│                                                 │
│ Client ID:                                      │
│ 693090706948-2d1jp6de9otm6u70b6u7n196tn0mdepg │
│                                                 │
│ Client secret:                                  │
│ ••••••••••••••••••••                           │
│                                                 │
│ JavaScript origins:                             │
│ https://medtech-4rjc.onrender.com               │
│ http://localhost:3000                           │
│                                                 │
│ [SCROLL DOWN to see Authorized origins]        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### STEP 5: Scroll to "Authorized JavaScript Origins"

```
Scroll down to see:

┌─────────────────────────────────────────────────┐
│ Authorized JavaScript Origins                   │
├─────────────────────────────────────────────────┤
│ https://medtech-4rjc.onrender.com               │
│ http://localhost:3000                           │
│ http://localhost:5173                           │
│                                                 │
│ [+ ADD URI]                                     │
│    ↑ CLICK THIS                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### STEP 6: Add New URI

Click the **"+ ADD URI"** button:

```
A new input field appears:

┌─────────────────────────────────────────────────┐
│ Authorized JavaScript Origins                   │
├─────────────────────────────────────────────────┤
│ https://medtech-4rjc.onrender.com               │
│ http://localhost:3000                           │
│ http://localhost:5173                           │
│ [New empty input field] ← CURSOR HERE          │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Type:**
```
https://medtech.awasthi.tech
```

**Result:**
```
┌─────────────────────────────────────────────────┐
│ Authorized JavaScript Origins                   │
├─────────────────────────────────────────────────┤
│ https://medtech-4rjc.onrender.com               │
│ http://localhost:3000                           │
│ http://localhost:5173                           │
│ https://medtech.awasthi.tech  ← NEWLY ADDED   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### STEP 7: Save Changes

Look for the save button at the bottom:

```
┌─────────────────────────────────────────────────┐
│ [← Back]                    [SAVE] or [UPDATE]  │
│                                ↑ CLICK THIS     │
└─────────────────────────────────────────────────┘
```

**The button might say:**
- "SAVE"
- "UPDATE CLIENT"
- "UPDATE"
- "APPLY"

Click whichever one appears.

---

### STEP 8: Confirmation

You should see a success message:

```
┌─────────────────────────────────────────────────┐
│ ✓ OAuth client updated successfully             │
│                                                 │
│ Changes may take 30-60 seconds to propagate.   │
└─────────────────────────────────────────────────┘
```

---

## ⏱️ WAIT 30-60 SECONDS

Google takes time to propagate your changes.

```
While waiting:
└─ Clear browser cache
   ├─ OR: Use incognito window
   └─ OR: Press Ctrl+Shift+R (hard refresh)
```

---

## ✅ TEST THE FIX

### Test Location

```
Open: https://medtech.awasthi.tech
      ↓
Click: "Sign in with Google"
```

### Expected Behavior

**BEFORE (Broken):**
```
Error 400: origin_mismatch
❌ FAILS
```

**AFTER (Fixed):**
```
Google popup opens
User selects account
User grants permissions
Redirected to dashboard
✅ SUCCESS
```

---

## 🔍 VERIFY IN BROWSER DEVTOOLS

### DevTools Console
```
No errors should appear

Correct messages:
✓ [Google Auth] Attempting login at: https://medtech-4rjc.onrender.com/api/users/google-login
✓ [Google Auth] Backend response: {...}
✓ [Login] Existing user, logging in with token: local:...

Incorrect (should NOT see):
❌ origin_mismatch
❌ CORS error
❌ 401 Unauthorized
```

### DevTools Network Tab
```
Look for:
POST /api/users/google-login
Status: 200 ✓
Response: { token: "local:123", user: {...} }
```

### DevTools Storage
```
Application → Storage → localStorage

Should contain:
token: local:user_id
role: patient (or doctor, pharmacy, etc)
```

---

## 🚨 TROUBLESHOOTING

### Problem: Still Getting origin_mismatch

```
Checklist:
1. Did you save in Google Console? ✓
2. Did you wait 30-60 seconds? ✓
3. Did you clear browser cache? ✓
4. Did you type it exactly?
   ✓ https://medtech.awasthi.tech (correct)
   ✗ https://medtech.awasthi.tech/ (wrong - trailing slash)
   ✗ http://medtech.awasthi.tech (wrong - http not https)
5. Are you using the right project?
```

### Solution If Still Broken

1. **Verify in Google Console:**
   ```
   Credentials → Your OAuth Client → Authorized JavaScript Origins
   Look for: https://medtech.awasthi.tech
   
   If not there:
   └─ Add it again and SAVE
   ```

2. **Clear Everything:**
   ```
   ├─ Close all browser tabs
   ├─ Clear all site data (DevTools → Settings)
   ├─ Close and reopen browser
   └─ Try again
   ```

3. **Try Incognito Window:**
   ```
   Ctrl+Shift+N (Windows)
   Cmd+Shift+N (Mac)
   
   Go to: https://medtech.awasthi.tech
   Try login again
   ```

---

## ✨ EXPECTED FINAL STATE

After completing this guide:

```
Your OAuth configuration:

┌─────────────────────────────────────────────┐
│ Authorized JavaScript Origins               │
├─────────────────────────────────────────────┤
│ https://medtech-4rjc.onrender.com          │
│ https://medtech.awasthi.tech ← NEWLY ADDED │
│ http://localhost:3000                       │
│ http://localhost:5173                       │
└─────────────────────────────────────────────┘

Result: ✅ Custom domain OAuth works!
```

---

## 📝 IMPORTANT NOTES

### ✓ DO Keep Both Domains
```
✓ Keep: https://medtech-4rjc.onrender.com
✓ Add: https://medtech.awasthi.tech
Result: Both will work
```

### ✗ DO NOT Remove Old Domain
```
✗ DON'T: Remove https://medtech-4rjc.onrender.com
Result: Render domain will break
```

### ✗ DO NOT Add Trailing Slash
```
✗ Wrong: https://medtech.awasthi.tech/
✓ Right: https://medtech.awasthi.tech
```

### ✗ DO NOT Use HTTP
```
✗ Wrong: http://medtech.awasthi.tech
✓ Right: https://medtech.awasthi.tech
```

### ✗ DO NOT Add Wildcards
```
✗ Wrong: https://*.awasthi.tech
✓ Right: https://medtech.awasthi.tech
```

---

## 🎉 THAT'S IT!

You've just fixed the Google OAuth origin_mismatch issue.

The solution is:
1. ✓ Add domain to Google Console
2. ✓ Save
3. ✓ Wait 30-60 seconds
4. ✓ Test

**Time: ~3 minutes**
**Cost: $0**
**Difficulty: Very Easy**
**Result: ✅ Complete**

