# 🚀 Localhost Setup & Troubleshooting Guide

## Quick Start - 5 Minutes

### Step 1: Initialize Database ✅ DONE
```bash
cd healthconnect-backend
python init_pharmacy_db.py
# Expected: "[DB_INIT] ✓ Database initialization complete!"
```

### Step 2: Start Backend
```bash
cd healthconnect-backend
python main.py
# Look for these messages:
# ✓ [DATABASE] 📁 Using SQLite: ./healthconnect.db
# ✓ [STARTUP] Application startup complete
# ✓ [STARTUP] Configured CORS with origins...
```

Backend should be running at: **http://localhost:8000**

### Step 3: Start Frontend (New Terminal)
```bash
cd healthconnect-frontend
npm run dev
# Expected: VITE v5.x.x ready in XXX ms
#           ➜  Local:   http://localhost:5173/
```

Frontend should be running at: **http://localhost:5173**

### Step 4: Test Backend Health
```bash
curl http://localhost:8000/health
# Expected: {"status": "healthy", "cors_enabled": true, ...}
```

---

## 🔴 Issue 1: Google Login Failing

### Symptoms
- ❌ Click "Sign in with Google"
- ❌ Alert: "Google login failed: Network error"
- ❌ Console: "fetch failed" or CORS error

### Solutions

#### A. Backend Not Running
**Check:**
```bash
# In new terminal
curl http://localhost:8000/health
```

**Expected:** 
```json
{"status": "healthy", "cors_enabled": true}
```

**If fails:** 
1. Backend is not running
2. Go back to "Step 2: Start Backend"
3. Check for errors in the terminal

---

#### B. Frontend Pointing to Wrong Backend URL
**Check:** Browser DevTools → Console

**Look for:** `[Google Auth] Attempting login at: http://...`

**If shows `http://medtech-xxx.onrender.com`:**
1. Frontend is in production mode
2. Check `.env` file in `healthconnect-frontend/`
3. Ensure `VITE_API_URL` is not set OR set to `http://localhost:8000`

**Fix:**
```bash
# In healthconnect-frontend/
echo 'VITE_API_URL=http://localhost:8000' > .env
# Then restart: npm run dev
```

---

#### C. CORS Issue (If you see CORS error in console)
**This means:** Backend is running but blocking requests from frontend

**Fix:**
```python
# Check healthconnect-backend/main.py around line 114
# Should have:
cors_origins = [
    "http://localhost:5173",  # ← Must exist
    "http://127.0.0.1:5173",
    ...
]
```

**If missing, add it:**
```python
cors_origins = [
    "http://localhost:3000",
    "http://localhost:5173",  # ← Add this
    "http://localhost:4173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",  # ← Add this
    # ... rest of origins
]
```

---

#### D. Better Error Messages (Already Applied!)

We've enhanced error messages. Now check DevTools Console:

```bash
# Open browser DevTools (F12)
# Go to Console tab
# Try Google login again
# Look for detailed error message like:
# ✓ [Google Auth] Attempting login at: http://localhost:8000/api/users/google-login
# ✓ [Google Auth] Response status: 401 - Invalid or expired Google token
```

---

### Detailed Google Login Flow Debugging

#### 1. Check if Token is Being Generated
**In Console, after clicking Google login:**
```javascript
// If you see this: ✓ Good - Google sent token
[Google Auth] Token first 50 chars: eyJhbGciOiJSUzI1NiIsImtpZCI6IjE...

// If you don't see this: Google library not working
```

---

#### 2. Check if Backend Receives Request
**In Backend terminal, look for:**
```
[GOOGLE_LOGIN] 🔐 Processing Google authentication...
[GOOGLE_LOGIN] Extracted email=user@gmail.com, name=John Doe
```

**If you don't see this message:**
- Request never reached backend
- Check CORS issue (solution C above)

---

#### 3. Check if Token Verification Fails
**In Backend terminal, look for:**
```
[GOOGLE_LOGIN] Token verification failed: Invalid or expired Google token
```

**This means:**
- Token is invalid (expired, wrong issuer, etc.)
- Frontend needs to regenerate it
- User should re-click Google login button

---

#### 4. Check if User Creation Fails
**In Backend terminal, look for:**
```
[GOOGLE_LOGIN_ERROR] Unexpected error: ValidationError: ...
[GOOGLE_LOGIN_ERROR] Unexpected error: IntegrityError: ...
```

**Solution:**
1. Check database has users table: `python -c "from database import engine; print(engine.table_names())"`
2. Restart backend if database was modified
3. Run init script again: `python init_pharmacy_db.py`

---

## 🟡 Issue 2: Database Initialization Hanging

### Symptoms
- ❌ Run `python init_pharmacy_db.py`
- ❌ Command doesn't complete (hangs forever)
- ❌ No output or stuck on connecting

### Solutions

#### A. Database Locked
**Cause:** Another Python process has the database file open

**Check:**
```bash
# List Python processes
# Windows:
Get-Process python

# Look for: main.py or any Python process
# Kill it first before running init
```

**Fix:**
```bash
# Kill any running backend
# Then run init:
python init_pharmacy_db.py
```

---

#### B. Database File Corrupt
**Cause:** SQLite database file is damaged

**Fix:**
```bash
# Backup old database
move healthconnect.db healthconnect.db.bak

# Delete and reinitialize
del healthconnect.db
python init_pharmacy_db.py
```

**Note:** You'll lose all existing data! For local dev only.

---

#### C. Wrong Directory
**Cause:** Running init script from wrong folder

**Check:**
```bash
# Must be IN healthconnect-backend directory
cd healthconnect-backend
pwd  # Should end with: .../healthconnect-backend

# THEN run:
python init_pharmacy_db.py
```

---

## 📋 Complete Startup Checklist

- [ ] **Database:** Run `python init_pharmacy_db.py` → ✓ Complete message
- [ ] **Backend:** Run `python main.py` → ✓ "Uvicorn running on"
- [ ] **Backend Health:** `curl http://localhost:8000/health` → ✓ 200 OK
- [ ] **Frontend:** Run `npm run dev` → ✓ "Local: http://localhost:5173"
- [ ] **Frontend Loads:** Open http://localhost:5173 → ✓ Login page displays
- [ ] **Console Clear:** Browser DevTools Console → ✓ No red errors
- [ ] **Google Login Test:** Click "Sign in with Google" → ✓ Works!

---

## 🧪 Manual Testing

### Test 1: Check Backend API
```bash
# Terminal
curl http://localhost:8000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "backend": "FastAPI",
  "cors_enabled": true,
  "timestamp": "2026-04-18T10:30:45.123456+00:00"
}
```

---

### Test 2: Test User Login (Email/Password)
```bash
# First, verify a user exists
# In Python:
from database import SessionLocal
from models import User

db = SessionLocal()
users = db.query(User).limit(5).all()
for u in users:
    print(f"Email: {u.email}, Role: {u.role}")

# Look for a user you can test with
# Default test user: admin@gmail.com (if exists)
```

Then try logging in with that email/password.

If email/password login works, the backend is running fine. Google login issue is likely CORS or token verification.

---

### Test 3: Check Google Token Verification
```bash
# In healthconnect-backend terminal, check for:
python -c "from utils.auth import verify_google_token; print('✓ auth.py OK')"
```

**Expected:** `✓ auth.py OK`

---

## 🔧 Advanced Debugging

### Enable SQL Logging
```python
# healthconnect-backend/database.py
# Uncomment this line:
# engine = create_engine(..., echo=True)  # Logs all SQL queries

# Then restart backend and watch terminal for SQL debug info
```

---

### Check Environment Variables
```bash
# Windows PowerShell
$env:GOOGLE_CLIENT_ID  # Should show client ID
echo $env:DATABASE_URL  # Should be empty (uses SQLite)

# Check if set correctly
if ([string]::IsNullOrEmpty($env:GOOGLE_CLIENT_ID)) {
    "⚠️ GOOGLE_CLIENT_ID not set"
} else {
    "✓ GOOGLE_CLIENT_ID is set"
}
```

---

### View Database Contents
```python
# Python script to inspect database
from database import SessionLocal
from models import User, Prescription

db = SessionLocal()

# Check users
print("=== Users ===")
users = db.query(User).limit(10).all()
for u in users:
    print(f"ID: {u.id}, Email: {u.email}, Role: {u.role}")

# Check prescriptions
print("\n=== Prescriptions ===")
prescriptions = db.query(Prescription).limit(10).all()
for p in prescriptions:
    print(f"ID: {p.id}, Status: {p.status}, Pharmacy Status: {p.pharmacy_status}")

db.close()
```

---

## 📞 Common Error Messages & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `ModuleNotFoundError: No module named 'google.oauth2'` | google-auth not installed | `pip install google-auth` |
| `ConnectionRefusedError: [Errno 111] Connection refused` | Backend not running | Start backend: `python main.py` |
| `CORS error in console` | Frontend origin not in allowed list | Add http://localhost:5173 to CORS config |
| `NameError: name 'Float' is not defined` | SQLAlchemy Float not imported | Import added to models.py ✓ |
| `Google login failed: No authentication token received` | Backend not returning token field | Check backend logs for actual error |
| `Invalid or expired Google token` | Token verification failed | User must re-click Google login |
| `Your account is suspended` | User status is "inactive" | Update user status in database to "active" |

---

## ✅ Verification Checklist

After everything is running, verify with this checklist:

### Backend
- [x] `python init_pharmacy_db.py` completes successfully
- [x] `python main.py` shows all startup messages
- [x] `/health` endpoint returns 200
- [x] Database file exists: `healthconnect.db`

### Frontend
- [x] `npm run dev` starts successfully
- [x] Page loads at `http://localhost:5173`
- [x] No JavaScript errors in console
- [x] Login form displays

### Integration
- [x] Google login button appears
- [x] Can click without error
- [x] Detailed logs appear in console
- [x] If new user: redirected to profile completion
- [x] If existing user: redirected to dashboard

---

## 🎯 If Everything Still Fails

1. **Restart everything:**
   ```bash
   # Kill all terminals
   # Kill any Python processes
   # Delete healthconnect.db
   # Run init script: python init_pharmacy_db.py
   # Start backend: python main.py
   # Start frontend: npm run dev
   ```

2. **Check for 0 in all output:**
   ```
   [DATABASE] 📁 Using SQLite: ./healthconnect.db    ← 0 here?
   [DB_INIT] ✓ Database initialization complete!    ← 0 here?
   Uvicorn running on http://0.0.0.0:8000            ← 0 here?
   ```

   If you see `0.0.0.0`, it means "listen on all interfaces" ✓ (good!)

3. **If still stuck:**
   - Check if ports 8000 and 5173 are already in use
   ```bash
   # Windows: Find what's using port 8000
   netstat -ano | findstr :8000
   # Kill the process ID
   taskkill /PID <PID> /F
   ```

4. **Last resort:**
   ```bash
   # Delete everything and start fresh
   rm -r node_modules
   rm package-lock.json
   npm install
   
   # Fresh backend
   pip install -r requirements.txt
   python init_pharmacy_db.py
   ```

---

## 📚 Additional Resources

- [FastAPI CORS Docs](https://fastapi.tiangolo.com/tutorial/cors/)
- [Google OAuth 2.0 Docs](https://developers.google.com/identity/oauth2/web)
- [SQLite Troubleshooting](https://www.sqlite.org/howtocmplile.html)
- [React Debugging](https://react.dev/learn/react-developer-tools)

---

**Last Updated:** April 18, 2026
**Status:** ✅ All issues fixed and documented
