# LOCAL DEVELOPMENT SETUP

## To test Google login locally, follow these steps:

### 1. Start the Backend Server

From the `healthconnect-backend` directory:

```bash
# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see output like:
```
Uvicorn running on http://0.0.0.0:8000
```

### 2. Start the Frontend Dev Server

From the `healthconnect-frontend` directory:

```bash
# Install dependencies (if not already done)
npm install

# Start the dev server
npm run dev
```

You should see output like:
```
➜  Local:   http://localhost:5173
```

### 3. Test Google Login

1. Open http://localhost:5173 in your browser
2. Click the Google sign-in button
3. Select your Google account
4. You should see:
   - ✅ Google token sent to `http://localhost:8000/api/users/google-login`
   - ✅ Backend verifies token and creates or finds user
   - ✅ Login succeeds (no "Email and password required" error)

### 4. API Endpoints Available

- **Local**: `http://localhost:8000/api/users/google-login`
- **Local**: `http://localhost:8000/api/users/login`
- **Production**: `https://medtech-hcmo.onrender.com/api/users/google-login`
- **Production**: `https://medtech-hcmo.onrender.com/api/users/login`

The frontend automatically detects which to use based on the environment.

### 5. Troubleshooting

**Error: "Google login failed: Not Found"**
- Ensure the backend is running on port 8000
- Check browser console for the actual request URL
- Verify CORS is enabled in the backend

**Error: "Invalid Google token"**
- Make sure you're using a valid Google OAuth token
- Check that `GOOGLE_CLIENT_ID` environment variable is set in the backend

**Error: "Email and password required"**
- This should NOT happen with the new endpoint - you're using the Google endpoint correctly
- If it does occur, check that you're calling `/api/users/google-login`, not `/api/users/login`

### 6. Environment Variables

Make sure these are set in your backend `.env` file:

```
GOOGLE_CLIENT_ID=your_google_client_id_here
DATABASE_URL=sqlite:///./test.db  # or your actual database URL
```
