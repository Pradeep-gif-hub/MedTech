# 🚀 Render Production Deployment Guide

## Current Status

✅ **Code committed to GitHub** (commit `ec3e1dd`)  
✅ **render.yaml updated** with all three services  
✅ **Frontend configured** with correct API URLs  
✅ **Chatbot service ready** with GROQ_API_KEY support  
❌ **Chatbot service NOT YET deployed to Render** (needs manual setup)

---

## 🔴 CRITICAL: Deploy Chatbot Service to Render

### Step 1: Create Chatbot Web Service on Render

1. **Go to:** https://dashboard.render.com
2. **Click:** "New +" → "Web Service"
3. **Connect Repository:**
   - Select: `Pradeep-gif-hub/MedTech`
   - Branch: `main`
   - Root Directory: `healthconnect-chatbot`
4. **Configure Service:**
   - **Name:** `medtech-chatbot`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free (or paid if preferred)

5. **Environment Variables:**
   - **GROQ_API_KEY:** Get from https://console.groq.com (your personal key)
     *Don't commit actual keys to GitHub - set in Render dashboard only*
   - **NODE_ENV:** `production`
   - **PORT:** `3001` (Render will auto-assign, but set this for consistency)

6. **Click:** "Create Web Service"
7. **Wait:** Service builds and deploys (2-5 minutes)

### Step 2: Verify Chatbot Service is Running

Once deployed, you'll get a URL like: `https://medtech-chatbot-xxxxx.onrender.com`

1. **Open in browser:** `https://medtech-chatbot-xxxxx.onrender.com`
2. **You should see:** Dark-themed chatbot UI
3. **Test API:** `https://medtech-chatbot-xxxxx.onrender.com/api/history`
   - Should return: `{}`

---

## 🟢 Frontend Setup (If Not Already Deployed)

### Check If Frontend Exists

1. **Go to:** https://dashboard.render.com
2. **Look for:** A service named `medtech` or similar (should be running at medtech-4rjc.onrender.com)

### If Frontend NOT Deployed:

1. **Click:** "New +" → "Static Site"
2. **Connect Repository:**
   - Select: `Pradeep-gif-hub/MedTech`
   - Branch: `main`
   - Root Directory: `healthconnect-frontend`
3. **Configure:**
   - **Name:** `medtech-frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. **Environment Variables:**
   - **VITE_API_URL:** `https://medtech-backend.onrender.com`
   - **VITE_WS_URL:** `wss://medtech-backend.onrender.com`
5. **Click:** "Create Static Site"

---

## 🟠 Backend Setup (If Not Already Deployed)

1. **Go to:** https://dashboard.render.com
2. **Look for:** `medtech-backend` (should exist)

### If Backend NOT Deployed:

1. **Click:** "New +" → "Web Service"
2. **Connect Repository:**
   - Select: `Pradeep-gif-hub/MedTech`
   - Branch: `main`
   - Root Directory: `healthconnect-backend`
3. **Configure:**
   - **Name:** `medtech-backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables:**
   - Configure database, JWT secret, etc. (existing setup)
5. **Click:** "Create Web Service"

---

## ✅ After Deployment: Verification Checklist

### 1. Check All Services Are Running

| Service | URL | Status |
|---------|-----|--------|
| Frontend | https://medtech-4rjc.onrender.com | ✅ Check health |
| Backend | https://medtech-backend.onrender.com | ✅ Check health |
| Chatbot | https://medtech-chatbot-xxxxx.onrender.com | ✅ Check health |

### 2. Test Chat Button Flow in Production

1. **Open:** https://medtech-4rjc.onrender.com
2. **Log in** as patient
3. **Look for:** 💬 Chat button in navbar
4. **Click Chat button**
5. **Verify:**
   - Browser shows loading spinner
   - After 3-5 seconds, chatbot UI loads in iframe
   - Dark theme chatbot interface appears
   - Type a message and get AI response

### 3. Check Console for Errors

Press `F12` → **Console Tab** → Look for:

✅ **Expected logs:**
```
[ChatbotPage] Using base URL: https://medtech-chatbot-xxxxx.onrender.com ( Mode: PROD )
[ChatbotPage] ✅ Chatbot iframe loaded successfully
```

❌ **If you see errors:**
```
Failed to load resource: the server responded with a status of 404
```
→ Chatbot service NOT running or URL is wrong

### 4. Test Chatbot AI Response

1. **In chatbot iframe, type:** "I have a headache"
2. **Within 5-10 seconds, you should see:**
   - Groq AI response with medical advice
   - Example: "Rest in a dark, quiet room. Drink water..."

---

## 🔧 If Chatbot Doesn't Load in Production

### Issue 1: Service Not Deployed
- ✅ Solution: Follow "Step 1: Create Chatbot Web Service" above

### Issue 2: GROQ_API_KEY Missing
- **Fix:** Go to Render Dashboard → medtech-chatbot → Settings → Environment
- Add/Update: `GROQ_API_KEY=gsk_...`
- Click "Deploy" to restart service

### Issue 3: Wrong URL in Frontend
- **Fix:** Update [ChatbotPage.tsx](healthconnect-frontend/src/pages/ChatbotPage.tsx) line 25:
  ```typescript
  const prodUrl = 'https://medtech-chatbot-XXXXX.onrender.com'; // Use actual URL
  ```
- Commit and push to trigger frontend redeploy

### Issue 4: CORS Error
- **Check:** ChatbotPage will show error with deployment instructions
- **Fix:** The error message will guide you through setup

---

## 📋 Service Status Command

To check all services from terminal:

```bash
# Check Render services via API (if you have CLI installed)
render services list

# Or just visit dashboard: https://dashboard.render.com
```

---

## 🎯 Production Flow Diagram

```
User (https://medtech-4rjc.onrender.com)
  ↓
  Clicks "Chat" button
  ↓
  ChatbotPage.tsx detects production mode
  ↓
  Loads iframe from: https://medtech-chatbot-XXXXX.onrender.com
  ↓
  Chatbot microservice (Node.js/Express)
  ↓
  Initiates /api/chat endpoint
  ↓
  Calls Groq API (external)
  ↓
  Returns AI response
  ↓
  Iframe displays to user
```

---

## 🚨 REQUIRED ACTIONS NOW

1. **✅ Git changes pushed** - DONE
2. **✅ render.yaml updated** - DONE
3. **⏳ Deploy chatbot to Render** - YOU MUST DO THIS
4. **⏳ Verify GROQ_API_KEY is set** - YOU MUST DO THIS
5. **⏳ Test production chat flow** - YOU MUST DO THIS

---

## 📞 Support

If services fail to deploy:
1. Check [Render Logs](https://dashboard.render.com) for errors
2. Verify environment variables are set
3. Ensure GitHub branch is main
4. Check build commands match render.yaml

---

**Last Updated:** April 14, 2026  
**Status:** Ready for production deployment  
**Next Step:** Deploy chatbot service to Render (Step 1 above)
