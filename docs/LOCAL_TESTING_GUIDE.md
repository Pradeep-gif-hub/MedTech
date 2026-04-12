# MedTech - Local Testing Guide

## Quick Start (5 minutes)

### 1. Start Backend
```bash
cd healthconnect-backend
node app.js
```

Expected output:
```
[STARTUP] ✅ MedTech Backend Running on Port 8000
[STARTUP] ✅ Nodemailer SMTP verification SUCCESS - ready to send emails
```

### 2. Run Test Suite (in another terminal)
```bash
cd healthconnect-backend
node test-suite.js
```

Expected: All 8 tests should pass ✅

### 3. Check Your Email
Look for two emails from `pawasthi063@gmail.com`:
1. **Test Email** - Plain text verification
2. **Password Reset** - With reset link (click to verify)

## Complete Testing Flow

### Part 1: Backend Only Testing (10 minutes)

```bash
# Terminal 1: Start backend
cd healthconnect-backend && node app.js

# Terminal 2: Run tests
cd healthconnect-backend && node test-suite.js
```

Verify:
- ✅ All tests pass
- ✅ Emails received in inbox
- ✅ Console logs show success

### Part 2: Frontend Integration Testing (20 minutes)

#### Start both servers:
```bash
# Terminal 1: Backend
cd healthconnect-backend && node app.js

# Terminal 2: Frontend
cd healthconnect-frontend && npm run dev
```

Frontend should open at: `http://localhost:5173`

#### Test Forgot Password Flow:
1. Go to login page
2. Click "Forgot Password" button
3. Enter: `pawasthi063@gmail.com`
4. Click "Send Reset Email"
5. Should see success message
6. Check email inbox
7. Click reset link in email
8. Reset password in form
9. Try logging in with new password

#### Verify in Console:
**Backend logs (Terminal 1):**
```
[FORGOT-PASSWORD] 📧 Request received for: pawasthi063@gmail.com
[FORGOT-PASSWORD] ✅ Reset email sent to pawasthi063@gmail.com
```

**Frontend logs (Browser DevTools):**
```
Request: POST /api/auth/forgot-password
Status: 200 OK
Response: { success: true, message: "Password reset email..." }
```

### Part 3: Email Verification (5 minutes)

1. Check Brevo mail logs (optional):
   - Go to Brevo account
   - Check SMTP logs
   - Verify delivery status

2. Verify email content:
   - HTML formatting correct
   - Links working
   - From address correct: `pawasthi063@gmail.com`

## Using the Test Suite

### Run Complete Test Suite
```bash
cd healthconnect-backend
node test-suite.js
```

### Manual Endpoint Testing with curl

**Test Email Sending:**
```bash
curl -X POST http://localhost:8000/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"pawasthi063@gmail.com"}'
```

**Forgot Password:**
```bash
curl -X POST http://localhost:8000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"pawasthi063@gmail.com"}'
```

**Check Health:**
```bash
curl http://localhost:8000/health
```

**Check Email Config:**
```bash
curl http://localhost:8000/api/auth/email-health
```

## What Gets Tested

### Test Suite Tests

1. **Health Check** - ✅ Endpoint responds correctly
2. **Root Endpoint** - ✅ Backend is accessible
3. **Email Config** - ✅ SMTP configuration loaded
4. **CORS Headers** - ✅ CORS headers set correctly
5. **Test Email** - ✅ Email sends via Brevo SMTP
6. **Forgot Password** - ✅ Reset email flows work
7. **Validation** - ✅ Missing email rejected
8. **404 Handler** - ✅ Non-existent routes handled

### Full Flow Tests

For complete testing you need:
- ✅ Backend running on port 8000
- ✅ Frontend running on port 5173
- ✅ Network connectivity to Brevo SMTP
- ✅ Email account to receive test emails

## Debugging Tips

### Check Backend Logs
```bash
# Look for these in Terminal 1:
[STARTUP] Configuration loaded
[TEST-EMAIL] ✅ Email sent successfully
[FORGOT-PASSWORD] ✅ Reset email sent
```

### Check Frontend Logs
```bash
# Press F12 in browser -> Console tab
# Look for:
POST /api/auth/forgot-password -> 200 OK
```

### Check Network Tab
```bash
# Press F12 -> Network tab
# Click an endpoint
# Headers:
  - access-control-allow-origin: ...
  - content-type: application/json
# Response:
  { "success": true, ... }
```

### Email Not Received?
1. Check spam/junk folder
2. Verify SMTP_USER and SMTP_PASS in `.env`
3. Check Brevo account status (not suspended)
4. Look at backend console for errors:
   ```
   [TEST-EMAIL] ❌ Failed to send test email: ...
   ```

### CORS Errors?
1. Make sure FRONTEND_URL in `.env` is set
2. Check browser console for error:
   ```
   Access to XMLHttpRequest at 'http://localhost:8000/api/auth/forgot-password'
   from origin 'http://localhost:5173' has been blocked by CORS policy
   ```
3. Make sure backend has CORS configured (check app.js line ~40)

### Port Conflicts?
```bash
# Kill all Node processes
taskkill /IM node.exe /F

# Use different port if needed
PORT=3001 node app.js
```

## Success Criteria

### All Tests Passing ✅
```
✅ Health check endpoint responded correctly
✅ Root endpoint is working
✅ Email configuration status recovered
✅ CORS header is set correctly
✅ Test email sent successfully!
✅ Forgot password request processed successfully!
✅ Validation working correctly
✅ 404 handler working correctly
```

### Emails Received ✅
You should receive 2 emails from `pawasthi063@gmail.com`:
1. Test email with simple format
2. Password reset email with HTML and reset link

### Frontend Works ✅
- Forgot password form submits
- Success message shown
- Email delivered
- No CORS errors in console

## Next: Deploy to Production

Once local testing is complete:

1. Commit changes:
   ```bash
   git add -A
   git commit -m "Test and verify complete Express backend locally"
   git push
   ```

2. Update Render environment variables

3. Deploy:
   ```bash
   # Render auto-deploys on push to main
   # Or manually in Render dashboard
   ```

4. Verify production:
   - Test email sending
   - Test forgot password flow
   - Check email delivery

5. Monitor:
   - Check Render logs
   - Monitor email delivery
   - Track user reports

## Troubleshooting Reference

| Issue | Solution |
|-------|----------|
| Port 8000 already in use | `taskkill /IM node.exe /F` |
| Email not sent | Check SMTP credentials in `.env` |
| CORS errors | Verify FRONTEND_URL in `.env` |
| Test fails | Check backend console logs |
| Email in spam | Verify sender reputation in Brevo |
| Links not working | Check FRONTEND_URL matches actual URL |

## Example Output Screenshots

### Successful Backend Start
```
[STARTUP] Configuring CORS with origins: [...]
[CONFIG] Email Configuration:
  SMTP_SERVER: smtp-relay.brevo.com
  SMTP_PORT: 587
  SMTP_USER: a79ff9001@...
  SMTP_PASS: [SET]

[STARTUP] ✅ MedTech Backend Running on Port 8000
[STARTUP] ✅ Nodemailer SMTP verification SUCCESS
```

### Successful Test Run
```
✅ Health check endpoint responded correctly
✅ Test email sent successfully!
  To: pawasthi063@gmail.com
  Message ID: <17154b3e-de4c-d7bd-8877-55e962555bc3@gmail.com>
✅ Forgot password request processed successfully!
  Email: pawasthi063@gmail.com
```

### Email Received
```
From: MedTech <pawasthi063@gmail.com>
To: pawasthi063@gmail.com
Subject: Password Reset Request - MedTech

[HTML formatted email with reset button and link]
```

## Continuous Testing

After deployment, periodically test:

1. **Weekly Manual Test**
   ```bash
   # From backend directory
   node test-suite.js
   ```

2. **Monitor Brevo Dashboard**
   - Check bounce rates
   - Monitor delivery status
   - Review bounce logs

3. **Track User Reports**
   - Any email delivery issues?
   - Any password reset issues?
   - Update `.env` if needed

Perfect! Your Express backend is ready for full production use! 🎉
