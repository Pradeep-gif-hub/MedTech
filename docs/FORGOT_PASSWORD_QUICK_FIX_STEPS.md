# Forgot-Password Debugging: Step-by-Step Execution Guide

## Root Cause Summary
**500 Error = SMTP Authentication Failure**

Your `.env` has Gmail credentials but the backend expects **Brevo SMTP credentials**. This causes authentication to fail silently.

---

## IMMEDIATE FIX: Update .env

Edit `healthconnect-backend/.env` and replace:

```env
SMTP_USER=pawasthi063@gmail.com
SMTP_PASS=fwbe uxbe gcke bbhw
```

With your **actual Brevo SMTP credentials** from https://app.brevo.com/settings/smtp-api:

```env
SMTP_USER=your_brevo_smtp_user
SMTP_PASS=your_brevo_smtp_password
```

**Save file. Backend will auto-reload (if using --reload mode).**

---

## Test Sequence (Run These Commands in Order)

### Command 1: Check SMTP Configuration

```bash
curl -X GET http://localhost:8000/api/auth-debug/smtp-test
```

**✅ Success (SMTP configured):**
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
    "error": null
  }
}
```

**❌ Failure (Missing/wrong credentials):**
```json
{
  "status": "error",
  "configured": false,
  "error": "Missing SMTP env vars: SMTP_USER, SMTP_PASS",
  "health": { ... }
}
```

**What to do if Command 1 fails:**
1. Check `.env` file - are SMTP_USER and SMTP_PASS actually set?
2. Verify no extra spaces in SMTP_PASS
3. Go to https://app.brevo.com/settings/smtp-api and copy credentials again
4. Restart Python backend (press Ctrl+C, then run uvicorn again)
5. Re-run Command 1

---

### Command 2: Test Forgot-Password with Full Debugging

Replace `testuser123@gmail.com` with a real user email in your database:

```bash
curl -X POST http://localhost:8000/api/auth-debug/forgot-password-debug \
  -H "Content-Type: application/json" \
  -d '{"email": "testuser123@gmail.com"}'
```

**Check the response AND the backend console output (VERY IMPORTANT):**

**✅ Success Response:**
```json
{
  "success": true,
  "message": "Password reset email sent successfully. Check your inbox."
}
```

**✅ Console Output (Look for these lines):**
```
[FP-DEBUG] L1.6: Email validation PASSED
[FP-DEBUG] L2.10: All critical env vars present
[FP-DEBUG] L3.3: USER FOUND
[FP-DEBUG] L4.9: PasswordResetToken committed successfully
[FP-DEBUG] L6.5: send_reset_email returned: True
[FP-DEBUG] L7.1: ALL STEPS COMPLETED SUCCESSFULLY
```

---

**❌ Failure Scenarios & How to Fix:**

#### Scenario A: User Not Found

**Response:**
```json
{
  "success": false,
  "message": "User not found",
  "error": "user_not_found"
}
```

**Console:**
```
[FP-DEBUG] L3.2: USER NOT FOUND in database
```

**Fix:** 
- Check email address exists in your database
- Make sure you're using exact email that's registered
- Try with a different email from your database

---

#### Scenario B: SMTP Configuration Missing

**Response:**
```json
{
  "success": false,
  "message": "Server configuration error",
  "error": "Missing env vars: SMTP_USER, SMTP_PASS"
}
```

**Console:**
```
[FP-DEBUG] L2.5: SMTP_PASS set = False
[FP-DEBUG] L2.9: CRITICAL MISSING ENV VARS: SMTP_USER, SMTP_PASS
```

**Fix:**
1. Edit `.env` file
2. Add: `SMTP_USER=your_brevo_username`
3. Add: `SMTP_PASS=your_brevo_password`
4. Save file
5. Restart backend
6. Re-run Command 2

---

#### Scenario C: Email Send Failed (Auth Error)

**Response:**
```json
{
  "success": false,
  "message": "Failed to send password reset email",
  "error": "SMTP authentication failed. Check SMTP_USER and SMTP_PASS."
}
```

**Console:**
```
[FP-DEBUG] L6.5: send_reset_email returned: False
[EMAIL] ERROR: Final failure message: SMTP authentication failed
[EMAIL] ERROR (Attempt 1): SMTP authentication failed: 535 5.7.8 Error: authentication failed
```

**Fix:**
- **This is the most common error**
- Your SMTP_USER and SMTP_PASS are WRONG
- Go to https://app.brevo.com/settings/smtp-api
- Copy the **SMTP Relay** credentials (NOT account password)
- Update `.env` with exact credentials
- Make sure there are NO extra spaces
- Restart backend
- Re-run Command 2

---

### Command 3: Test Actual Frontend Endpoint

Once Command 2 succeeds, test the actual endpoint:

```bash
curl -X POST http://localhost:8000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "testuser123@gmail.com"}'
```

**✅ Success:**
```json
{
  "success": true,
  "message": "Reset email sent successfully"
}
```

---

## What to Check If Still Getting 500

1. **Backend Terminal**: Do you see ANY logs? No logs = backend crashed on startup
   - Fix: Restart with `uvicorn main:app --reload --port 8000`

2. **Check .env file exists**: 
   - File: `healthconnect-backend/.env`
   - Contains: `SMTP_USER` and `SMTP_PASS`

3. **Check Brevo dashboard**: 
   - https://app.brevo.com/settings/smtp-api
   - Copy SMTP Relay username and password exactly as shown

4. **Look for Python errors**:
   - Are there any `ModuleNotFoundError` or `ImportError` in the terminal?
   - Run: `pip install -r requirements.txt` to ensure all packages installed

5. **Check email is valid**:
   - Use an email that definitely exists in your database
   - Test with: `SELECT * FROM users WHERE email = 'your-email@example.com';`

---

## Correct Credentials Format

**What they look like in Brevo dashboard:**
```
SMTP Server:     smtp-relay.brevo.com
SMTP Port:       587
SSL/TLS:         Yes
Authentication:  Yes
Username:        contact@sendinblue.com  (or similar format)
Password:        xsmtpauth-abc123xyz789  (long alphanumeric string)
```

**Update .env like this:**
```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=contact@sendinblue.com
SMTP_PASS=xsmtpauth-abc123xyz789
```

---

## If Backend Won't Start

**Error: `ModuleNotFoundError` or `ImportError`**

Run this in the backend directory:
```bash
pip install -r requirements.txt
```

**Then restart:**
```bash
uvicorn main:app --reload --port 8000
```

---

## Deployed to Render?

1. Go to https://dashboard.render.com
2. Select your `MedTech-backend` service  
3. Click **Environment**
4. Update `SMTP_USER` and `SMTP_PASS` with correct Brevo credentials
5. Click **Save**
6. Wait for auto-deploy (Watch the Logs tab)
7. Test the endpoint once deployed

---

## Final Checklist

- [ ] Got Brevo SMTP credentials from https://app.brevo.com/settings/smtp-api
- [ ] Updated `.env` with correct SMTP_USER and SMTP_PASS
- [ ] Backend is running (`uvicorn main:app --reload --port 8000`)
- [ ] Command 1 (`/smtp-test`) returns `"configured": true`
- [ ] Command 2 (`/forgot-password-debug`) returns `"success": true`
- [ ] Command 3 (`/forgot-password`) returns `"success": true`
- [ ] Email was received in inbox
- [ ] Frontend form now works without 500 error

Once all checks pass, your forgot-password flow is fixed! 🎉

---

## Additional Resources

- Brevo SMTP Setup: https://help.brevo.com/hc/en-us/articles/209462506
- Debug endpoints available:
  - `GET /api/auth-debug/smtp-test` - Check SMTP config
  - `POST /api/auth-debug/forgot-password-debug` - Full debugging with logs
- Python backend logs shown in terminal running `uvicorn`
- Production logs viewable in Render dashboard

Still stuck? Check the full root cause document:
`docs/FORGOT_PASSWORD_FIX_ROOT_CAUSE.md`
