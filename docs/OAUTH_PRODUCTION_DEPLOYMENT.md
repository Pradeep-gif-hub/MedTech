# 🚀 Google OAuth Production Deployment Guide

## Overview

Your MedTech project has been successfully migrated to **pure Google OAuth 2.0** authentication. This guide covers secure deployment practices.

---

## ✅ Deployment Checklist

### 1. **Google Cloud Console Configuration**

Verify these settings in your Google Cloud Console:

```
Project: MedTech
OAuth 2.0 Client ID: 693090706948-2d1jp6de9otm6u70b6u7n196tn0mdepg.apps.googleusercontent.com
```

#### Authorized Origins (URIs auth redirects from)
- ✅ `http://localhost:5173` (development)
- ✅ `http://localhost:3000` (fallback dev)
- ✅ `https://medtech-4rjc.onrender.com` (production)
- ✅ `https://medtech-hcmo.onrender.com` (production)
- ⚠️ Add any custom domains used in production

#### Authorized Redirect URIs (where Google sends responses back)
- ✅ `http://localhost:5173` (Vite dev server)
- ✅ `http://localhost:3000` (alternative dev)
- ✅ `https://medtech-4rjc.onrender.com` (production app domain)
- ✅ `https://medtech-hcmo.onrender.com` (production backend domain)

### 2. **Environment Variables Setup**

#### Backend (Render, Docker, or Server)

Create `.env` file with:

```bash
# Google OAuth 2.0 Configuration
GOOGLE_CLIENT_ID=693090706948-2d1jp6de9otm6u70b6u7n196tn0mdepg.apps.googleusercontent.com

# Database Configuration
DATABASE_URL=postgresql://user:password@db-host:5432/medtech

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Use Gmail App Password, NOT your actual password

# Optional
OTP_DEBUG=0  # Set to 0 in production
```

**IMPORTANT: Never commit `.env` to git!**

#### Frontend (Vite/React)

The Client ID is already in [src/firebaseConfig.ts](healthconnect-frontend/src/firebaseConfig.ts):

```typescript
export const GOOGLE_CLIENT_ID = "693090706948-2d1jp6de9otm6u70b6u7n196tn0mdepg.apps.googleusercontent.com";
```

### 3. **Backend Deployment**

#### Option A: Render.com (Recommended)

1. Create new Web Service on Render
2. Connect your GitHub repository
3. **Build Command:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Start Command:**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```
5. **Environment Variables:** Add `.env` variables in Render dashboard
6. **CORS Settings:** Already configured in [main.py](healthconnect-backend/main.py) for production URLs

#### Option B: Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build & Run:
```bash
docker build -t medtech-backend:latest .
docker run -p 8000:8000 \
  -e GOOGLE_CLIENT_ID=693090706948-2d1jp6de9otm6u70b6u7n196tn0mdepg.apps.googleusercontent.com \
  -e DATABASE_URL=your_db_url \
  medtech-backend:latest
```

#### Option C: AWS Lambda + API Gateway

1. Package FastAPI for Lambda with Mangum server adapter
2. Set environment variables in Lambda console
3. Configure API Gateway CORS for frontend domains

### 4. **Frontend Deployment**

#### Vercel (Recommended for Next.js-style deployment)

```bash
npm install -g vercel
vercel
```

#### Netlify

```bash
npm run build
# Deploy build folder to Netlify
```

#### Manual Vite Build (Any Host)

```bash
npm run build  # Creates dist/ folder
# Deploy dist/ folder to your hosting
```

### 5. **API Endpoint Security**

Your backend endpoints are configured with:

```python
# From main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://medtech-4rjc.onrender.com",
        "https://medtech-hcmo.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)
```

**For Production:** Update `allow_origins` with your actual domain(s):

```python
allow_origins=["https://yourdomain.com"]  # Production domain only
```

### 6. **Authentication Flow (Production)**

```
User Browser
    ↓
1. Click "Sign in with Google"
    ↓
Google Authorization Dialog (popup)
    ↓
2. User accepts & receives ID token
    ↓
Frontend [src/components/Login.tsx]
    ↓
3. Send POST /api/users/login with Bearer token
    ↓
Backend [routers/users.py]
    ↓
4. verify_google_token() validates JWT
    ↓
5. Check if user exists, create if needed
    ↓
6. Return user data + success
    ↓
Frontend Auth Context + Dashboard
```

### 7. **Security Best Practices**

#### ✅ DO:

- Use HTTPS everywhere in production
- Store tokens only in httpOnly cookies (prevent XSS)
- Validate all tokens on backend before trusting
- Rotate Google OAuth credentials annually
- Keep `google-auth>=2.25.0` updated
- Monitor authentication logs
- Set up audit trail for user logins

#### ❌ DON'T:

- Commit `.env` files to git
- Expose Google Client ID in server logs
- Use old Firebase SDK
- Disable CORS entirely (use specific domains)
- Store Google tokens in localStorage (vulnerable to XSS)
- Use HTTP in production

### 8. **Token Validation on Backend**

Currently implemented in [utils/auth.py](healthconnect-backend/utils/auth.py):

```python
def verify_google_token(request: Request) -> dict:
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    
    token = auth_header.split(" ")[1]
    
    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        # Verify token issuer is Google
        if idinfo.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
            raise HTTPException(status_code=401, detail="Invalid token issuer")
        
        return {
            "google_id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
            "email_verified": idinfo.get("email_verified")
        }
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

### 9. **Monitoring & Debugging**

#### Check if token is valid:

```bash
# Backend logs show:
# [TOKEN_VERIFIED] google_id=1234567890, email=user@gmail.com
```

#### Common Issues:

| Issue | Solution |
|-------|----------|
| "Invalid token issuer" | Verify Google Cloud Client ID matches `GOOGLE_CLIENT_ID` env var |
| "CORS error" | Add your domain to `allow_origins` in main.py |
| "Missing token" | Ensure Authorization header: `Bearer <token>` |
| "Token expired" | User needs to sign in again (Google ID tokens expire ~1 hour) |

### 10. **Rollback Plan**

If issues occur:

1. **Revert to old auth:** Roll back git commit, deploy
2. **Kill sessions:** Clear user localStorage
3. **Test locally first:** `npm run dev` + `uvicorn main:app --reload`
4. **Check logs:** Review backend logs for verification errors

---

## 🔄 Migration Summary (What Changed)

### Before (Firebase)
```
Frontend: firebase-admin, firebase SDK (~1.2MB)
Backend: firebase_admin package
Auth: signInWithPopup(auth, provider)
Security: Firebase hosted identity
```

### After (Google OAuth)
```
Frontend: @react-oauth/google (~50KB)
Backend: google-auth library (official Google)
Auth: GoogleLogin component
Security: Google Identity Services (lighter, faster, official)
```

**Benefits:**
- 96% smaller bundle size
- Official Google library (better support)
- Zero Firebase infrastructure needed
- Lower maintenance overhead
- Direct Google token validation

---

## 📞 Support & Troubleshooting

### Issue: "Failed to verify token"
**Solution:**
1. Check `GOOGLE_CLIENT_ID` in .env matches frontend
2. Verify token hasn't expired (Google tokens valid ~1 hour)
3. Check Authorization header format: `Bearer <token>`

### Issue: "CORS blocked"
**Solution:**
- Add your frontend domain to `allow_origins` in [main.py](healthconnect-backend/main.py)
- Example: `"https://yourdomain.com"`

### Issue: "User not found"
**Solution:**
- First Google login auto-creates user with role "patient"
- Subsequent logins fetch existing user from database

### Issue: "Email not verified"
**Solution:**
- Not blocking login, but log shows `email_verified: false`
- Recommend users verify email in Google account settings

---

## ✨ Next Steps

1. Test OAuth flow in production environment
2. Monitor first week of logins for issues
3. Set up email alerts for authentication failures
4. Document domain-specific configurations
5. Plan Google OAuth credential rotation (annually)

---

**Last Updated:** April 3, 2026  
**Version:** 1.0 - Production Ready  
**Status:** ✅ Complete
