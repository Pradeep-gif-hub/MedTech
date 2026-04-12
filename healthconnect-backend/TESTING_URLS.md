# 🚀 MedTech - Local Testing URLs

## ✅ SERVERS RUNNING

### Backend Server
```
🔗 http://localhost:8000
✅ Status: RUNNING
📧 Email: Brevo SMTP (Verified)
🔐 Auth: Ready
```

### Frontend Server  
```
🔗 http://localhost:5173
✅ Status: RUNNING
🎨 Framework: React + TypeScript + Vite
💻 Environment: Development
```

---

## 📍 Direct Test Links

Click on any of these links to test:

### Backend Endpoints (API Testing)

1. **Health Check**
   ```
   http://localhost:8000/health
   ```
   Shows backend status and configuration

2. **Email Configuration**
   ```
   http://localhost:8000/api/auth/email-health
   ```
   Check if SMTP is configured

3. **Root Endpoint**
   ```
   http://localhost:8000/
   ```
   Verify backend is running

### Frontend Application

1. **Main App**
   ```
   http://localhost:5173
   ```
   React application interface
   
2. **Login Page** (Usually default)
   ```
   http://localhost:5173/login
   ```
   Login form (if exists)

3. **Forgot Password**
   ```
   http://localhost:5173/forgot-password
   ```
   Password reset page (if exists)

---

## 🧪 API Testing with curl

### Test Email Sending
```bash
curl -X POST http://localhost:8000/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"pawasthi063@gmail.com\"}"
```

### Test Forgot Password
```bash
curl -X POST http://localhost:8000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"pawasthi063@gmail.com\"}"
```

### Check Health
```bash
curl http://localhost:8000/health
```

---

## 📊 Current Status

| Component | Port | Status | URL |
|-----------|------|--------|-----|
| Backend (Express) | 8000 | ✅ Running | http://localhost:8000 |
| Frontend (Vite) | 5173 | ✅ Running | http://localhost:5173 |
| CORS | - | ✅ Enabled | Both servers configured |
| Email (Brevo) | 587 | ✅ Verified | SMTP relay working |

---

## 🎯 What to Test

### 1. Backend Endpoints
Visit these in your browser to test the API:

- ✅ http://localhost:8000 → Shows JSON with server status
- ✅ http://localhost:8000/health → Shows health check
- ✅ http://localhost:8000/api/auth/email-health → Shows email config

### 2. Frontend Application  
Open this to test the UI:

- ✅ http://localhost:5173 → React app loads

### 3. Forgot Password Flow
In the frontend app:
1. Click "Forgot Password" button
2. Enter: `pawasthi063@gmail.com`
3. Click "Send Reset Email"
4. Check your email inbox for reset link

### 4. Email Reception
Check email for:
- **Test Email** → From "MedTech" ✅
- **Password Reset** → With reset link ✅

---

## 📱 Mobile Testing

If you want to test from another device:

### Get Your Computer's IP
```
Substitute "localhost" with your computer's IP
Example: http://192.168.1.100:8000
Example: http://192.168.1.100:5173
```

### Find IP Address
```
Windows: ipconfig
Mac: ifconfig
Linux: ip addr
```

---

## 🔍 Browser DevTools

Press **F12** to open Developer Tools:

1. **Console Tab** → See JavaScript errors
2. **Network Tab** → See API requests
3. **Application Tab** → Check localStorage, cookies

Look for:
- ✅ API responses from localhost:8000
- ✅ No CORS errors
- ✅ Email status messages

---

## 📧 Email Testing

### Real Emails Sent To
```
pawasthi063@gmail.com
```

### Email Provider
```
Brevo SMTP Relay
Server: smtp-relay.brevo.com:587
```

### What Gets Sent
1. **Test Email**
   - Subject: ✅ MedTech Test Email
   - Format: HTML + Plain text
   - Purpose: Verify SMTP works

2. **Password Reset**
   - Subject: Password Reset Request - MedTech
   - Format: HTML with button + Plain text
   - Contains: Reset token and link
   - Expires: 1 hour

---

## 🆘 Troubleshooting

### Frontend Shows "Connection Refused"
- ✅ Make sure Vite is running (check terminal)
- ✅ Try refreshing the page (Ctrl+R)
- ✅ Clear browser cache (Ctrl+Shift+Delete)
- ✅ Check port 5173 is free

### Backend Shows "Connection Refused"
- ✅ Make sure Node is running on port 8000
- ✅ Check `node "C:\Users\pawas\OneDrive\Documents\GitHub\MedTech\healthconnect-backend\app.js"` is running
- ✅ Check no other service is using port 8000

### Emails Not Arriving
- ✅ Check spam/junk folder
- ✅ Verify `.env` file has SMTP_USER and SMTP_PASS
- ✅ Check backend logs for email errors

### CORS Errors
- ✅ Make sure frontend is on port 5173
- ✅ Make sure backend is on port 8000
- ✅ Check browser console (F12) for error messages

---

## 🚀 Quick Commands

Kill all Node processes:
```powershell
taskkill /IM node.exe /F
```

Restart Backend:
```powershell
node "C:\Users\pawas\OneDrive\Documents\GitHub\MedTech\healthconnect-backend\app.js"
```

Restart Frontend:
```powershell
cd "C:\Users\pawas\OneDrive\Documents\GitHub\MedTech\healthconnect-frontend" ; npm run dev
```

---

## ✨ Summary

```
✅ Backend: http://localhost:8000
✅ Frontend: http://localhost:5173  
✅ Email: Brevo SMTP Working
✅ All systems operational!
```

**You're ready to test!** 🎉

Open **http://localhost:5173** in Chrome now!
