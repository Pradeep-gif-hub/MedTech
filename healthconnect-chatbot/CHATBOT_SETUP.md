# 🚀 MedTech Chatbot Integration - Setup Guide

## Overview
The MedTech Patient Dashboard now features an integrated AI-powered health chatbot using **Groq API** and **Llama 3.3 70B** model.

### What's New
✅ **Chat Button** on patient dashboard header  
✅ **Groq AI Assistant** for health-related questions  
✅ **Separate Microservice** (runs independently)  
✅ **Full Console Logging** for debugging  
✅ **Zero Breaking Changes** - All existing features intact  

---

## 🎯 Quick Start

### Step 1: Install & Run Chatbot Service
```bash
# Navigate to chatbot directory
cd healthconnect-chatbot

# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Start chatbot server (port 3001)
npm start
```

**Expected Output:**
```
✅ [Chatbot Server] Running at http://localhost:3001
[Chatbot Server] Health check: /api/history
```

### Step 2: Start Frontend
In a new terminal:
```bash
cd healthconnect-frontend
npm run dev
```

### Step 3: Test Chatbot Integration
1. Navigate to Patient Dashboard (`/patient/home`)
2. Click the **💬 Chat** button (top-right corner)
3. Ask a health question: "What helps with a cold?"
4. **Open browser console** (F12) to see detailed logs

---

## 📋 Features

### Patient Dashboard
- **New "💬 Chat" Button** in header (purple gradient)
- Opens fullscreen chatbot modal
- Clean back button to return
- User context passed securely

### Chatbot Service
- **Groq AI Backend** - Fast, free LLaMA inference
- **Medical System Prompt** - Focuses on home remedies & wellness
- **Live Conversation History** - Maintains context within session
- **Clear Chat** button to reset
- **Markdown Support** - Formatted responses
- **Typing Indicator** - Shows when AI is thinking

---

## 🔧 Development

### Console Logs
Open browser `F12` to see real-time logs:

```
[PatientDashboard] 💬 Chat button clicked
[App] Navigating to chatbot...
[ChatbotPage] Component mounted, initializing...
[ChatbotPage] Using base URL: http://localhost:3001
[ChatbotPage] ✅ Chatbot iframe loaded successfully
[ChatUI] Initializing chatbot UI...
[ChatUI] Sending message, length: 15
[Chatbot Server] Request received
[Assistant] Calling Groq API...
[ChatUI] Response data received, reply length: 287
```

### File Structure
```
MedTech/
├── healthconnect-frontend/
│   └── src/
│       ├── pages/
│       │   └── ChatbotPage.tsx        ← iframe component
│       ├── components/
│       │   └── PatientDashboard.tsx   ← Chat button
│       └── App.tsx                     ← routing
│
└── healthconnect-chatbot/              ← Separate service
    ├── server.js                       ← Express server
    ├── assistant.js                    ← Groq AI logic
    ├── public/index.html               ← UI interface
    ├── package.json
    └── .env                            ← API keys
```

---

## ⚙️ Configuration

### Update Production Chatbot URL
In `healthconnect-frontend/src/pages/ChatbotPage.tsx` (line 23):
```typescript
const prodUrl = 'https://medtech-chatbot.onrender.com'; // ← Update this
```

### Add Groq API Key
In `healthconnect-chatbot/.env`:
```env
GROQ_API_KEY=your_key_from_console.groq.com
PORT=3001
NODE_ENV=development
```

### Change Chatbot Port (optional)
In `healthconnect-chatbot/.env`:
```env
PORT=3002  # Use different port if 3001 is taken
```

---

## 🧪 Testing Checklist

- [ ] **Chat Button Appears** on dashboard header (purple)
- [ ] **Click Button** - loads chatbot modal
- [ ] **Send Message** - "What is the capital of France?"
- [ ] **AI Responds** - markdown formatted, markdown links, code blocks render
- [ ] **Button Again** - sends another message, maintains conversation
- [ ] **Clear Chat** - button at bottom clears history
- [ ] **Back Button** - returns to dashboard without errors
- [ ] **Logout** - works normally, doesn't show chatbot
- [ ] **F12 Console** - see all logs with [ChatUI], [Chatbot], [Assistant] prefixes
- [ ] **Mobile** - responsive design works on phone

---

## 🐛 Troubleshooting

### Chatbot Shows "Connection Failed"
1. ✓ Is port 3001 running? `curl http://localhost:3001/api/history`
2. ✓ Is `.env` file present with `GROQ_API_KEY`?
3. ✓ Check browser console for `[ChatbotPage] Error:` messages
4. ✓ Check Terminal for `[Chatbot Server]` error logs

### Chat Button Not Appearing
1. ✓ Are you on patient dashboard? (/patient/home)
2. ✓ Are you logged in as patient role?
3. ✓ Check console for `[PatientDashboard]` logs

### Messages Not Sending
1. ✓ Is chatbot iframe loaded? (should see `[ChatbotPage] ✅ Chatbot iframe loaded`)
2. ✓ Is Groq API key valid?
3. ✓ Check `[ChatUI] Calling /api/chat` in server logs
4. ✓ Check for CORS errors in browser console

### "Cannot pass type arguments to untyped function" TypeScript Errors
- These are pre-existing. Won't affect runtime.
- Safe to ignore or suppress in `tsconfig.json` if needed.

---

## 🚀 Deployment

### Deploy Chatbot to Render
1. Push `healthconnect-chatbot/` folder to GitHub
2. Create new Render Web Service from repo
3. Set `PORT` environment variable
4. Add `GROQ_API_KEY` secret
5. Deploy!
6. Note the `.onrender.com` URL
7. Update `ChatbotPage.tsx` production URL

### Deploy Frontend Updates
1. Frontend changes auto-deploy via Render
2. New ChatbotPage and App.tsx changes included
3. Ensure Chat button doesn't break anything

---

## 📝 System Prompt (Medical Focus)

The chatbot is configured to:
- ✓ Suggest home remedies and lifestyle tips
- ✓ Ask clarifying questions about symptoms
- ✗ **Never** prescribe medicines/drugs
- ✗ **Never** provide definite diagnoses
- ✓ Always recommend consulting a doctor
- ✓ Warn about serious symptoms

Example response structure:
> "Based on your symptoms, this could be a simple cold or mild flu. Try rest, hydration, and honey tea. However, if your fever exceeds 103°F or persists beyond 3 days, please see a doctor immediately."

---

## 💬 Next Steps

1. **Get Groq API Key** (free at https://console.groq.com)
2. **Add to chatbot .env**
3. **Run both services**
4. **Test from dashboard**
5. **Monitor console logs**
6. **Push to production!**

---

## ✨ Integration Details

### No Breaking Changes
- ✅ Existing dashboard features untouched
- ✅ WebRTC/real-time chat still works
- ✅ Auth system unchanged
- ✅ All routes preserved
- ✅ Logout handler intact
- ✅ Role-based access maintained

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Chatbot Backend**: Node.js + Express + Groq SDK
- **Communication**: iframe + fetch API
- **Styling**: Tailwind CSS + Custom CSS
- **Logging**: Console logs with prefixes

---

## 📞 Support

Check logs for:
- `[App]` - Routing and navigation
- `[PatientDashboard]` - Dashboard interactions
- `[ChatbotPage]` - iframe loading
- `[ChatUI]` - Frontend interactions
- `[Chatbot Server]` - Backend connections  
- `[Assistant]` - Groq API calls

All with timestamps and detailed context! 🎯
