# Forgot-Password Quick Testing Guide

## Quick Diagnostics (Run These First)

### 1. Check SMTP Configuration
```bash
# Check if SMTP is configured correctly
curl https://medtech-4rjc.onrender.com/api/auth/email-health
```

Expected output:
```json
{
  "provider": "brevo_smtp",
  "configured": true,
  "from_email": "MedTech <noreply@medtech.com>",
  "smtp_server": "smtp-relay.brevo.com",
  "smtp_port": 587,
  "smtp_user": "your-brevo-email@example.com",
  "last_error": ""
}
```

If `configured: false`, check the `error` field for missing variables.

### 2. Send Test Email
```bash
# Send a test email to verify delivery
curl -X POST https://medtech-4rjc.onrender.com/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@gmail.com"}'
```

Expected success:
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "recipient": "your-test-email@gmail.com"
}
```

Expected failure:
```json
{
  "success": false,
  "error": "SMTP authentication failed. Check SMTP_USER/SMTP_PASS.",
  "recipient": "your-test-email@gmail.com"
}
```

### 3. Test Forgot-Password Flow
```bash
# Test with a real user email
curl -X POST https://medtech-4rjc.onrender.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "existing-user@example.com"}'
```

### 4. Check Render Logs
View logs in Render dashboard:
- Look for `[FORGOT_PASSWORD]` and `[EMAIL]` log entries
- Trace the exact step where it fails
- Note any error messages

## Detailed Log Output Examples

### Successful Flow (Check logs for this)
```
[FORGOT_PASSWORD] ===== START FORGOT_PASSWORD REQUEST =====
[FORGOT_PASSWORD] Env check - SMTP_SERVER: smtp-relay.brevo.com
[FORGOT_PASSWORD] Step 2: Email extracted: user@example.com
[FORGOT_PASSWORD] Step 3: Querying database for user
[FORGOT_PASSWORD] Step 3b: User found - user_id=123
[FORGOT_PASSWORD] Step 4: Creating reset token
[FORGOT_PASSWORD] Step 4a: Token created
[FORGOT_PASSWORD] Step 5: Calling send_reset_email
[RESET_EMAIL] Step 1: send_reset_email called
[RESET_EMAIL] Step 4: Calling _send_via_smtp
[EMAIL] Step 1: _send_via_smtp called
[EMAIL] Step 2: Getting SMTP config
[EMAIL] Step 2a: SMTP server = smtp-relay.brevo.com
[EMAIL] Step 2b: SMTP port = 587
[EMAIL] Step 2c: SMTP user = noreply@medtech.com
[EMAIL] Step 3: SMTP config validated
[EMAIL] Step 6.1: Attempt 1 - Connecting to SMTP server
[EMAIL] Step 6.1a: SMTP connection established
[EMAIL] Step 6.1e: Authenticating with SMTP user
[EMAIL] Step 6.1f: Authentication successful
[EMAIL] Step 6.1g: Sending message
[EMAIL] Step 7: SMTP send success
[FORGOT_PASSWORD] Step 7: Email sent successfully
[FORGOT_PASSWORD] ===== END FORGOT_PASSWORD REQUEST (SUCCESS) =====
```

### Missing SMTP Configuration (Check logs for this)
```
[FORGOT_PASSWORD] Env check - SMTP_SERVER: <empty>
[FORGOT_PASSWORD] Env check - SMTP_USER is set: False
[FORGOT_PASSWORD] Env check - SMTP_PASS is set: False
[EMAIL] Step 2: Getting SMTP config
[EMAIL] ERROR: Missing SMTP config: SMTP_USER, SMTP_PASS, SMTP_SERVER
```

### Authentication Failed (Check logs for this)
```
[EMAIL] Step 6.1: Connecting to SMTP server
[EMAIL] Step 6.1f: Authentication successful  <- NOT shown
[EMAIL] ERROR (Attempt 1): SMTP authentication failed: Authentication failed
[EMAIL] ERROR: Final failure message: SMTP authentication failed
```

## Environment Variables Checklist

Verify in Render dashboard:

- [ ] `SMTP_SERVER` = `smtp-relay.brevo.com`
- [ ] `SMTP_PORT` = `587`
- [ ] `SMTP_USER` = Your Brevo SMTP username (usually your email)
- [ ] `SMTP_PASS` = Your Brevo SMTP password (from API tokens/SMTP)
- [ ] `FROM_EMAIL` = Valid email address (usually matches SMTP_USER or different address)
- [ ] `FRONTEND_URL` = `https://medtech-4rjc.onrender.com`

## Brevo Configuration

1. Go to Brevo dashboard
2. Settings → SMTP & API
3. Generate SMTP credentials if not already done
4. Copy the **SMTP Relay** username and password (NOT the main password)
5. Add to Render environment variables

## Step-by-Step Debugging

### If test-email succeeds but forgot-password fails:
1. Check if user exists in database
2. Look for "User not found" in logs
3. Verify email matches database exactly

### If test-email fails:
1. Check SMTP_USER and SMTP_PASS
2. Verify Brevo credentials are correct
3. Check Render network connectivity
4. Look for "SMTP authentication failed" in logs

### If connection timeout:
1. Check SMTP_SERVER = `smtp-relay.brevo.com`
2. Check SMTP_PORT = `587`
3. Render may have network issues - try redeploy

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `SMTP authentication failed` | Wrong credentials | Check Brevo SMTP user/pass in Render |
| `Missing SMTP config` | Env vars not set | Set SMTP_USER, SMTP_PASS in Render |
| `Could not connect to SMTP server` | Network issue | Verify SMTP_SERVER and SMTP_PORT |
| `Invalid recipient email` | Bad email format | Check frontend is sending valid email |
| `User not found` | Email doesn't match DB | Verify user exists with that email |

## Frontend Integration

After fixing backend, test from frontend:

```javascript
// Forgot password page
const handleForgotPassword = async (email) => {
  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Show: "Check your email for reset link"
    console.log('Email sent successfully');
  } else {
    // Show error from data.message or data.error
    console.error('Error:', data.error || data.message);
  }
};
```

## Still Stuck?

1. Check Render deployment logs (all output from backend)
2. Search for `[EMAIL]` and `[FORGOT_PASSWORD]` in logs
3. Look for the step number where it stops
4. Check error message next to the failed step
5. Verify that step's required environment variables
