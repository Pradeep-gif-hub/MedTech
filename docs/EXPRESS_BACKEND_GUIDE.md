# MedTech Express.js Backend - Documentation

## Overview

This is the complete **Node.js/Express REST API backend** for MedTech, replacing the previous FastAPI implementation. It provides:

- ✅ Complete REST API endpoints
- ✅ Brevo SMTP email integration via Nodemailer
- ✅ Forgot password flow with email verification
- ✅ CORS support for development and production
- ✅ Comprehensive error handling and logging

## File Structure

```
healthconnect-backend/
├── app.js                 # Main Express server (NEW - replaces server.js)
├── test-suite.js          # Comprehensive test suite
├── package.json           # Dependencies (updated with cors)
├── .env                   # Environment variables (NOT in git)
├── .env.example           # Template for env setup
└── node_modules/          # Dependencies (nodemailer, express, cors, etc.)
```

## Installation

### 1. Navigate to backend directory
```bash
cd healthconnect-backend
```

### 2. Install dependencies
```bash
npm install
```

This installs:
- `express` - HTTP server framework
- `cors` - Cross-Origin Resource Sharing
- `nodemailer` - Email sending
- `dotenv` - Environment variable management

### 3. Configure environment variables
Create `.env` file with:
```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id

# SMTP Configuration (Brevo)
SMTP_SERVER=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_brevo_account_smtp_user
SMTP_PASS=your_brevo_smtp_password
FROM_EMAIL=your_verified_sender_email
FROM_NAME=MedTech

# Frontend URL for password reset links
FRONTEND_URL=https://your-frontend-domain.com

# Optional: Port (defaults to 8000)
PORT=8000
```

## Running the Backend

### Development
```bash
npm start
# or
npm run dev
# or
node app.js
```

Server will start on `http://localhost:8000`

### Health Check
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "backend": "Express.js + Nodemailer",
  "cors_enabled": true,
  "email_configured": true,
  "timestamp": "2024-04-12T10:30:00.000Z"
}
```

## API Endpoints

### 1. Health Check
**GET** `/health`

Returns backend status and configuration.

### 2. Email Health Check
**GET** `/api/auth/email-health`

Check if email configuration is properly loaded.

### 3. Test Email
**POST** `/api/auth/test-email`

Send a test email to verify SMTP configuration.

Request body:
```json
{
  "email": "user@example.com"
}
```

Response:
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "to": "user@example.com",
  "messageId": "<unique-message-id>"
}
```

### 4. Forgot Password
**POST** `/api/auth/forgot-password`

Initiate password reset flow and send reset email.

Request body:
```json
{
  "email": "user@example.com"
}
```

Response:
```json
{
  "success": true,
  "message": "Password reset email sent successfully. Check your inbox.",
  "email": "user@example.com"
}
```

### 5. Reset Password
**POST** `/api/auth/reset-password`

Complete the password reset process.

Request body:
```json
{
  "token": "reset_token_from_email",
  "email": "user@example.com",
  "new_password": "secure_new_password"
}
```

Response:
```json
{
  "success": true,
  "message": "Password reset successfully. You can now login with your new password."
}
```

## Testing

### Run Comprehensive Test Suite
```bash
node test-suite.js
```

This runs 8 tests:
1. ✅ Health check endpoint
2. ✅ Root endpoint  
3. ✅ Email configuration status
4. ✅ CORS headers verification
5. ✅ Test email sending
6. ✅ Forgot password flow
7. ✅ Input validation
8. ✅ 404 error handling

### Expected Output
```
✅ All 8 tests passed!
✅ Test email sent successfully!
✅ Forgot password email sent successfully!
```

## CORS Configuration

The backend is configured to accept requests from:

**Development:**
- `http://localhost:3000`  
- `http://localhost:5173` (Vite default)
- `http://localhost:4173`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:3000`

**Production:**
- `https://medtech-4rjc.onrender.com`
- `https://medtech-hcmo.onrender.com`

## Email Configuration (Brevo)

### SMTP Credentials
- **SMTP Host:** `smtp-relay.brevo.com`
- **SMTP Port:** `587`
- **Username:** Your Brevo SMTP account (e.g., `a79ff9001@smtp-brevo.com`)
- **Password:** Your Brevo SMTP password
- **From Email:** Any verified sender in Brevo
- **TLS/SSL:** Enabled

### Getting Brevo Credentials
1. Sign up at [Brevo](https://www.brevo.com)
2. Go to SMTP & API settings
3. Copy SMTP login credentials
4. Add a verified sender email
5. Add credentials to `.env`

### Testing Email Setup
```bash
curl -X POST http://localhost:8000/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com"}'
```

## Console Logging

The backend includes detailed console logging for debugging:

```
[STARTUP] ✅ MedTech Backend Running on Port 8000
[CONFIG] Email Configuration: SMTP_SERVER, PORT, USER, etc.
[TEST-EMAIL] 📧 Sending test email to: user@example.com
[TEST-EMAIL] ✅ Email sent successfully!
[TEST-EMAIL] Message ID: <message-id>
[FORGOT-PASSWORD] 📧 Request received for: user@example.com
[FORGOT-PASSWORD] 🔐 Generated reset token
[FORGOT-PASSWORD] ✅ Reset email sent
[ERROR] Error message if something fails
```

## Common Issues & Solutions

### Issue: "EADDRINUSE: address already in use :::8000"
**Solution:** Port 8000 is already in use
```bash
# Kill all Node processes
taskkill /IM node.exe /F

# Or use a different port
PORT=3001 node app.js
```

### Issue: "Failed to send test email"
**Solution:** Check SMTP credentials in `.env`
```bash
# Verify configuration
curl http://localhost:8000/api/auth/email-health
```

Show output should have `"configured": true`

### Issue: CORS errors in frontend
**Solution:** Make sure your frontend URL is in `FRONTEND_URL` env var
```env
FRONTEND_URL=http://localhost:5173
```

And that your frontend is making requests to `http://localhost:8000`

## Frontend Integration

### TypeScript/React Example
```typescript
// Forgot password request
const response = await fetch('http://localhost:8000/api/auth/forgot-password', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email: userEmail }),
});

const data = await response.json();

if (data.success) {
  console.log('Reset email sent!');
} else {
  console.error('Error:', data.message);
}
```

## Deployment to Render

### 1. Update Environment Variables on Render
```
SMTP_SERVER=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_brevo_smtp_user
SMTP_PASS=your_brevo_smtp_password
FROM_EMAIL=your_verified_sender
FROM_NAME=MedTech
FRONTEND_URL=https://your-production-domain.com
PORT=8000
```

### 2. Update Start Command
In `Procfile` or Render settings:
```
web: node app.js
```

### 3. Deploy
```bash
git push origin main
# Render will auto-deploy
```

## Architecture Changes

### Before (FastAPI)
- Python FastAPI server on port 8000
- Python `email_utils.py` for nodemailer
- Express server only for emails
- Mixed architecture with complexity

### After (Express.js - Current)
- Single Node.js Express server on port 8000
- All endpoints in Express
- Nodemailer integrated for emails
- Clean, unified architecture
- Better performance
- Easier maintenance

## Next Steps

1. ✅ **Backend is built and tested locally**
2. ✅ **All endpoints working with nodemailer + Brevo**
3. ✅ **CORS properly configured**
4. ⏳ **Test with React frontend**
5. ⏳ **Deploy to Render production**
6. ⏳ **Verify email delivery in production**

## Support

For issues or questions:
1. Check console logs (detailed logging enabled)
2. Review `.env` configuration
3. Test with `test-suite.js`
4. Check Brevo email delivery status
5. Verify CORS in browser DevTools Network tab
