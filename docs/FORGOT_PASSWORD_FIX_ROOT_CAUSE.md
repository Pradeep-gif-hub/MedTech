# CRITICAL: Forgot-Password 500 Error - Root Cause & Fix

## Issue Identified

Your forgot-password API returns 500 because **Brevo SMTP credentials are misconfigured in .env**

### Current Problem in `.env`:

```env
SMTP_USER=pawasthi063@gmail.com          # ❌ WRONG - This is a Gmail address
SMTP_PASS=fwbe uxbe gcke bbhw           # ❌ Likely Gmail app password, not Brevo
```

**This will NOT work** because:
- Brevo SMTP relay requires **Brevo-specific SMTP credentials**, NOT Gmail credentials
- The SMTP_PASS looks like a Gmail app password format
- Brevo will reject authentication with wrong credentials → 500 error

---

## What's Happening

When you click "Forgot Password":
1. ✅ Frontend calls `/api/auth/forgot-password` 
2. ✅ Backend receives request
3. ✅ Backend validates email & queries database
4. ✅ Backend creates reset token
5. ❌ **Backend tries to send email via SMTP**
6. ❌ **Brevo SMTP authentication FAILS** (wrong credentials)
7. ❌ **Exception is thrown → 500 error returned**
8. ❌ **Frontend shows "Error: Failed to send reset email"**
9. ❌ **Brevo logs show NOTHING** (never authenticated, so never logged in)

---

## 3-Step Fix

### Step 1: Get Correct Brevo SMTP Credentials

1. Go to **Brevo Dashboard** → https://app.brevo.com/
2. Click **Settings** (bottom left)
3. Click **SMTP & API**
4. Under **SMTP Relay**, you'll see:
   - **SMTP Relay Username** (looks like an email or ID, NOT your main email)
   - **SMTP Relay Password** (long API key, NOT your account password)

Example what you should see:
```
SMTP Relay Host: smtp-relay.brevo.com
SMTP Relay Port: 587
SMTP Relay Username: brevo_abc123@example.com  (or similar, NOT your Gmail)
SMTP Relay Password: xsmtpauth-abc123xyz...   (long API key)
```

### Step 2: Update .env with Correct Credentials

Replace `healthconnect-backend/.env`:

**BEFORE (❌ Wrong):**
```env
SMTP_USER=pawasthi063@gmail.com
SMTP_PASS=fwbe uxbe gcke bbhw
SENDER_EMAIL=pawasthi063@gmail.com
FROM_EMAIL=pawasthi063@gmail.com
```

**AFTER (✅ Correct):**
```env
SMTP_USER=your_brevo_smtp_username_here
SMTP_PASS=your_brevo_smtp_password_here
SENDER_EMAIL=noreply@medtech.com
FROM_EMAIL=noreply@medtech.com
```

**Important:**
- `SMTP_USER` = Brevo SMTP username (from Brevo dashboard)
- `SMTP_PASS` = Brevo SMTP password (from Brevo dashboard) - DO NOT use Gmail credentials
- `FROM_EMAIL` = Can be any valid email (recommendation: use a noreply address)

### Step 3: Restart Backend & Test

Locally:
```bash
# Kill uvicorn server (Ctrl+C)
# Restart with: 
uvicorn main:app --reload --port 8000
```

On Render:
- Render detects `.env` changes automatically
- Just redeploy from Render dashboard

---

## Testing the Fix

### Test 1: SMTP Configuration Status

```bash
curl http://localhost:8000/api/auth-debug/smtp-test
```

**Expected Response (✅ Working):**
```json
{
  "status": "ok",
  "configured": true,
  "health": {
    "provider": "brevo_smtp",
    "configured": true,
    "from_email": "MedTech <noreply@medtech.com>",
    "smtp_server": "smtp-relay.brevo.com",
    "smtp_port": 587,
    "brevo_api_configured": false,
    "smtp_pass_sanitized": false,
    "error": null
  },
  "message": "SMTP is configured and ready"
}
```

**Expected Response (❌ Still Broken) - Missing credentials:**
```json
{
  "status": "error",
  "configured": false,
  "error": "Missing SMTP env vars: SMTP_USER, SMTP_PASS",
  "health": { ... }
}
```

### Test 2: Full Forgot-Password with Debug Logging

```bash
curl -X POST http://localhost:8000/api/auth-debug/forgot-password-debug \
  -H "Content-Type: application/json" \
  -d '{"email": "testuser@example.com"}'
```

**Check Console Output for each step:**

```
[FP-DEBUG] L1.1: Raw request body type: <class 'dict'>
[FP-DEBUG] L1.4: Extracted email: 'testuser@example.com'
[FP-DEBUG] L1.6: Email validation PASSED
[FP-DEBUG] L2.2: SMTP_SERVER = smtp-relay.brevo.com
[FP-DEBUG] L2.5: SMTP_PASS set = True              ← Should be True now!
[FP-DEBUG] L2.10: All critical env vars present
[FP-DEBUG] L3.1: Querying database for user
[FP-DEBUG] L3.3: USER FOUND
[FP-DEBUG] L4.1: Generating reset token
[FP-DEBUG] L4.9: PasswordResetToken committed successfully
[FP-DEBUG] L5.1: Preparing email content
[FP-DEBUG] L6.1: Initializing email sending
[FP-DEBUG] L6.5: send_reset_email returned: True   ← Should be True!
[FP-DEBUG] L7.1: ALL STEPS COMPLETED SUCCESSFULLY
```

---

## Common Issues & Solutions

### Issue 1: "SMTP authentication failed"

**Cause:** Wrong Brevo credentials

**Fix:** 
- Double-check SMTP_USER and SMTP_PASS in Brevo dashboard
- Make sure you're using **SMTP Relay** credentials, not your account password
- Remove any spaces from SMTP_PASS

### Issue 2: "Missing SMTP env vars: SMTP_USER, SMTP_PASS"

**Cause:** Environment variables not set in .env or not loaded

**Fix:**
- Check `.env` file exists and is readable
- Verify SMTP_USER and SMTP_PASS are not empty
- Restart uvicorn: `Ctrl+C` then restart

### Issue 3: "Could not connect to SMTP server"

**Cause:** SMTP_SERVER or SMTP_PORT incorrect

**Fix:**
- Ensure `SMTP_SERVER=smtp-relay.brevo.com` (not smtp.gmail.com)
- Ensure `SMTP_PORT=587` (not 465 or 25)

### Issue 4: Connection timeout

**Cause:** Network issue or firewall blocking port 587

**Fix:**
- Test locally first before deploying to Render
- If Render has timeout, try redeploy or clear cache in Render dashboard

---

## Complete Working .env Template

```env
# Google OAuth 2.0 Configuration
GOOGLE_CLIENT_ID=693090706948-2d1jp6de9otm6u70b6u7n196tn0mdepg.apps.googleusercontent.com

# SMTP configuration - USE BREVO CREDENTIALS
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_brevo_smtp_username_here
SMTP_PASS=your_brevo_smtp_password_here
SENDER_EMAIL=noreply@medtech.com
FROM_EMAIL=noreply@medtech.com

# Frontend URL for password reset links
FRONTEND_URL=https://medtech-4rjc.onrender.com

# OTP Debug mode (set to 0 in production)
OTP_DEBUG=1

# Database URL (if needed)
# DATABASE_URL=sqlite:///./healthconnect.db
```

---

## How to Verify SMTP Credentials in Brevo

**Step-by-step:**

1. Log in to https://app.brevo.com/
2. Click **Settings** (gear icon, bottom left)
3. Click **SMTP & API** in the left menu
4. Look for **SMTP Relay** section (NOT the main SMTP settings)
5. You should see something like:
   ```
   SMTP Configuration
   Server: smtp-relay.brevo.com
   Port: 587
   TLS: Enabled
   Username: [COPY THIS]
   Password: [COPY THIS]
   ```
6. Copy Username → set as `SMTP_USER` in .env
7. Copy Password → set as `SMTP_PASS` in .env

---

## Files Modified

1. **`healthconnect-backend/.env`** - Update SMTP credentials
2. **`healthconnect-backend/main.py`** - Added debug routes (already done)
3. **`healthconnect-backend/routers/auth_debug.py`** - New debug endpoints (already created)

---

## Next Steps

1. ✅ Get correct Brevo SMTP credentials from Brevo dashboard
2. ✅ Update `.env` with correct SMTP_USER and SMTP_PASS
3. ✅ Restart backend (or redeploy to Render)
4. ✅ Test `/api/auth-debug/smtp-test` endpoint
5. ✅ Test `/api/auth-debug/forgot-password-debug` endpoint
6. ✅ Verify console logs show "ALL STEPS COMPLETED SUCCESSFULLY"
7. ✅ Test actual `/api/auth/forgot-password` endpoint from frontend
8. ✅ Verify email arrives in inbox

---

## Still Stuck?

1. **Check console logs** - Look for exact error message
2. **Verify .env** - Make sure SMTP_USER and SMTP_PASS are set and not empty
3. **Test SMTP** - Call `/api/auth-debug/smtp-test` endpoint
4. **Check Brevo** - Verify you copied credentials correctly
5. **Check spaces** - Remove any extra spaces from SMTP_PASS

Once you update the credentials, it should work! The 500 error is almost certainly due to SMTP authentication failure with wrong credentials.
