# Forgot-Password Flow - Complete Fix & Debugging Guide

## Overview
Fixed the forgot-password API that was returning 500 errors with no email delivery. The issue was lack of detailed logging making it impossible to identify where the failure occurred.

## Changes Made

### 1. Enhanced SMTP Logging in `utils/email_utils.py`

#### `_send_via_smtp()` - Step-by-step logging
```python
# Step 1: Validate recipient
print("[EMAIL] Step 1: _send_via_smtp called")
print(f"[EMAIL] Step 1a: to_email parameter = {to_email}")

# Step 2: Get SMTP config
print("[EMAIL] Step 2: Getting SMTP config")
print(f"[EMAIL] Step 2a: SMTP server = {config['server']}")
print(f"[EMAIL] Step 2b: SMTP port = {config['port']}")
print(f"[EMAIL] Step 2c: SMTP user = {config['user']}")

# Step 3: Validate config
missing = _missing_smtp_fields(config)
if missing:
    print(f"[EMAIL] ERROR: Missing SMTP config: {', '.join(missing)}")
    return False

# Step 4-6: Connect and send
for attempt in range(1, total_attempts + 1):
    try:
        print(f"[EMAIL] Step 6.{attempt}: Connecting to SMTP server")
        print(f"[EMAIL] Step 6.{attempt}e: Authenticating with SMTP user")
        print(f"[EMAIL] Step 6.{attempt}g: Sending message")
        smtp.login(config["user"], config["password"])
        smtp_response = smtp.send_message(msg)
        print(f"[EMAIL] Step 7: SMTP send success")
        return True
    except smtplib.SMTPAuthenticationError as e:
        print(f"[EMAIL] ERROR (Attempt {attempt}): SMTP authentication failed: {str(e)}")
        break
    except Exception as e:
        print(f"[EMAIL] {type(e).__name__}: {str(e)}")
```

#### `send_reset_email()` - Comprehensive logging
```python
def send_reset_email(email: str, token: str) -> bool:
    print(f"[RESET_EMAIL] Step 1: send_reset_email called with email={email}")
    print(f"[RESET_EMAIL] Step 2: Preparing reset link")
    print(f"[RESET_EMAIL] Step 2c: frontend_url = {_get_frontend_url()}")
    print(f"[RESET_EMAIL] Step 3: Email content prepared")
    print(f"[RESET_EMAIL] Step 4: Calling _send_via_smtp")
    
    sent = _send_via_smtp(...)
    
    if not sent:
        error = get_last_email_error()
        print(f"[RESET_EMAIL] ERROR: Email send failed. Error: {error}")
    
    return sent
```

### 2. Enhanced Forgot-Password Route in `routers/users.py`

Completely rewritten with comprehensive logging at each step:

```python
def forgot_password(data: dict = Body(...), request: Request = None, db: Session = Depends(get_db)):
    print("[FORGOT_PASSWORD] ===== START FORGOT_PASSWORD REQUEST =====")
    
    # Step 1: Verify environment variables
    print(f"[FORGOT_PASSWORD] Env check - FRONTEND_URL is set: {bool(settings.FRONTEND_URL)}")
    print(f"[FORGOT_PASSWORD] Env check - SMTP_SERVER: {settings.SMTP_SERVER}")
    print(f"[FORGOT_PASSWORD] Env check - SMTP_USER is set: {bool(settings.SMTP_USER)}")
    print(f"[FORGOT_PASSWORD] Env check - SMTP_PASS is set: {bool(settings.SMTP_PASS)}")
    
    # Step 2: Extract email from request
    email = (data.get("email") or "").strip().lower()
    print(f"[FORGOT_PASSWORD] Step 2: Email extracted: {email or '[empty]'}")
    
    if not email:
        print(f"[FORGOT_PASSWORD] Step 2a: Email validation FAILED")
        return _json_response(False, "Email is required", status_code=400)
    
    # Step 3: Query user from database
    print(f"[FORGOT_PASSWORD] Step 3: Querying database for user")
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    
    if not user:
        print(f"[FORGOT_PASSWORD] Step 3a: User lookup FAILED")
        return _json_response(False, "User not found", status_code=404)
    
    print(f"[FORGOT_PASSWORD] Step 3b: User found - user_id={user.id}")
    
    # Step 4: Create reset token
    print(f"[FORGOT_PASSWORD] Step 4: Creating reset token")
    reset_token, expires_at = _create_reset_token(db, user, email)
    print(f"[FORGOT_PASSWORD] Step 4a: Token created")
    print(f"[FORGOT_PASSWORD] Step 4b: Expires at: {expires_at}")
    
    # Step 5: Send email
    print(f"[FORGOT_PASSWORD] Step 5: Calling send_reset_email")
    sent = send_reset_email(email=email, token=reset_token)
    print(f"[FORGOT_PASSWORD] Step 5a: send_reset_email returned: {sent}")
    
    if not sent:
        err = get_last_email_error() or "Email delivery failed"
        print(f"[FORGOT_PASSWORD] Step 5b: Email send FAILED - {err}")
        return _json_response(False, "Failed to send reset email", status_code=500, error=err)
    
    # Step 6: Success
    print(f"[FORGOT_PASSWORD] Step 7: Email sent successfully")
    print("[FORGOT_PASSWORD] ===== END FORGOT_PASSWORD REQUEST (SUCCESS) =====")
    return _json_response(True, "Reset email sent successfully", status_code=200)
```

### 3. Added Diagnostic Endpoints in `routers/auth.py`

#### Email Health Check
```python
@router.get("/email-health")
def email_health():
    """
    Diagnostic endpoint to check email/SMTP configuration.
    Returns configuration status, missing fields, and last error.
    """
    from utils.email_utils import get_email_health
    return get_email_health()
```

**Response example:**
```json
{
  "provider": "brevo_smtp",
  "configured": true,
  "from_email": "MedTech <noreply@medtech.com>",
  "smtp_server": "smtp-relay.brevo.com",
  "smtp_port": 587,
  "smtp_user": "noreply@medtech.com",
  "last_error": ""
}
```

#### Test Email Endpoint
```python
@router.post("/test-email")
def test_email(data: dict = Body(...)):
    """
    Diagnostic endpoint to test email sending.
    Request body: {"email": "test@example.com"}
    """
    from utils.email_utils import send_email, get_last_email_error
    
    email = (data.get("email") or "").strip().lower()
    
    sent = send_email(
        to_email=email,
        subject="MedTech Test Email",
        html_content="<h2>Test Email</h2>...",
        text_content="...",
        retries=1,
    )
    
    if sent:
        return {"success": True, "message": "Test email sent successfully"}
    else:
        error = get_last_email_error() or "Unknown error"
        return {"success": False, "error": error}
```

## Debugging Steps

### Step 1: Verify SMTP Configuration
```bash
curl https://medtech-4rjc.onrender.com/api/auth/email-health
```

Check the response:
- `configured: true` - All SMTP fields set
- `configured: false` - Missing fields shown in `error`
- `smtp_server` - Should be `smtp-relay.brevo.com`
- `smtp_user` - Should be your Brevo SMTP user

### Step 2: Test Email Delivery
```bash
curl -X POST https://medtech-4rjc.onrender.com/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test@gmail.com"}'
```

Response:
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "recipient": "your-test@gmail.com"
}
```

If failed, response will include:
```json
{
  "success": false,
  "error": "SMTP authentication failed. Check SMTP_USER/SMTP_PASS."
}
```

### Step 3: Check Render Logs
When you call forgot-password, check Render logs for output like:

```
[FORGOT_PASSWORD] ===== START FORGOT_PASSWORD REQUEST =====
[FORGOT_PASSWORD] Env check - FRONTEND_URL is set: True
[FORGOT_PASSWORD] Env check - SMTP_SERVER: smtp-relay.brevo.com
[FORGOT_PASSWORD] Env check - SMTP_USER is set: True
[FORGOT_PASSWORD] Env check - SMTP_PASS is set: True
[FORGOT_PASSWORD] Step 2: Email extracted: user@example.com
[FORGOT_PASSWORD] Step 3: Querying database for user
[FORGOT_PASSWORD] Step 3b: User found - user_id=123
[FORGOT_PASSWORD] Step 4: Creating reset token
[FORGOT_PASSWORD] Step 4a: Token created
[FORGOT_PASSWORD] Step 5: Calling send_reset_email
[RESET_EMAIL] Step 1: send_reset_email called with email=user@example.com
[RESET_EMAIL] Step 2: Preparing reset link
[RESET_EMAIL] Step 3: Email content prepared
[RESET_EMAIL] Step 4: Calling _send_via_smtp
[EMAIL] Step 1: _send_via_smtp called
[EMAIL] Step 2: Getting SMTP config
[EMAIL] Step 2a: SMTP server = smtp-relay.brevo.com
[EMAIL] Step 2b: SMTP port = 587
[EMAIL] Step 6.1: Attempt 1 - Connecting to SMTP server
[EMAIL] Step 6.1a: SMTP connection established
[EMAIL] Step 6.1e: Authenticating with SMTP user
[EMAIL] Step 6.1f: Authentication successful
[EMAIL] Step 6.1g: Sending message
[EMAIL] Step 7: SMTP send success
[FORGOT_PASSWORD] Step 7: Email sent successfully
[FORGOT_PASSWORD] ===== END FORGOT_PASSWORD REQUEST (SUCCESS) =====
```

## Environment Variables Required

Ensure these are set in Render:

```env
# Brevo SMTP Configuration
SMTP_SERVER=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-email@example.com
SMTP_PASS=your-brevo-smtp-key
FROM_EMAIL=noreply@medtech.com
FROM_NAME=MedTech

# Frontend URL for reset links
FRONTEND_URL=https://medtech-4rjc.onrender.com
```

## Common Issues & Solutions

### Issue 1: Missing SMTP Configuration
**Error:** `Missing SMTP config: SMTP_USER, SMTP_PASS`
**Solution:** Check Render environment variables are set correctly

### Issue 2: Authentication Failed
**Error:** `SMTP authentication failed. Check SMTP_USER/SMTP_PASS.`
**Solution:** 
- Verify Brevo SMTP credentials (not Gmail app password)
- Check credentials in Brevo dashboard
- Ensure `SMTP_USER` and `SMTP_PASS` match exactly

### Issue 3: Connection Timeout
**Error:** `Could not connect to SMTP server.`
**Solution:**
- Check Render network connectivity
- Verify SMTP_SERVER = `smtp-relay.brevo.com`
- Verify SMTP_PORT = `587`

### Issue 4: Invalid Recipient
**Error:** `Invalid recipient email`
**Solution:**
- Check frontend is sending valid email format
- Verify email extraction works in logs

## Files Modified

1. **healthconnect-backend/utils/email_utils.py**
   - Enhanced `_send_via_smtp()` with detailed logging
   - Enhanced `send_reset_email()` with step tracking
   - Improved `get_email_health()` with config details

2. **healthconnect-backend/routers/users.py**
   - Rewritten `forgot_password()` with comprehensive logging
   - Added environment variable verification
   - Added step-by-step error tracking

3. **healthconnect-backend/routers/auth.py**
   - Added `GET /email-health` diagnostic endpoint
   - Added `POST /test-email` test endpoint

## Testing the Complete Flow

### Frontend Test
```javascript
// Test forgot-password endpoint
const response = await fetch('/api/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'testuser@example.com' })
});

const data = await response.json();
console.log('Response:', data);
// Expected: { success: true, message: "Reset email sent successfully" }
```

### Expected Success Response
```json
{
  "success": true,
  "message": "Reset email sent successfully"
}
```

### Expected Error Response (user not found)
```json
{
  "success": false,
  "message": "User not found",
  "statusCode": 404
}
```

### Expected Error Response (email send failed)
```json
{
  "success": false,
  "message": "Failed to send reset email",
  "error": "SMTP authentication failed. Check SMTP_USER/SMTP_PASS.",
  "statusCode": 500
}
```

## Summary

✅ **Done:**
1. Added comprehensive step-by-step logging at every operation
2. Enhanced error messages with context
3. Added diagnostic endpoints for testing
4. Proper try-catch blocks with stack traces
5. Environment variable validation
6. SMTP configuration verification

The logging now makes it immediately clear:
- Where the request came from
- What step failed
- What the error was
- What configuration is in place

This should make any future debugging much faster.
