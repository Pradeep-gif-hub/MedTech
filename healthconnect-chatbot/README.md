# MedTech AI Chatbot Service

🏥 Medical AI Assistant powered by Groq API - Integrated with MedTech Platform

## ⚡ Quick Start

### 1. Setup
```bash
cd healthconnect-chatbot
cp .env.example .env
npm install
```

### 2. Add Your Groq API Key
Edit `.env` and add your key from [console.groq.com](https://console.groq.com) (free):
```env
GROQ_API_KEY=your_api_key_here
PORT=3001
```

### 3. Run
```bash
npm start        # Production
npm run dev      # Development (auto-reload)
npm run cli      # Terminal interface
```

Server runs at: **http://localhost:3001**

---

## 🌐 API Endpoints

| Method | Route | Body | Description |
|--------|-------|------|-------------|
| `POST` | `/api/chat` | `{ message }` | Send health question |
| `POST` | `/api/clear` | - | Clear conversation history |
| `GET` | `/api/history` | - | Get full chat history |

### Example
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What helps with a cold?"}'
```

---

## 🔌 Integration with MedTech

The chatbot automatically embeds in the patient dashboard via iframe:
- **Development**: `http://localhost:3001`
- **Production**: `https://chatbot.onrender.com` (configure in ChatbotPage.tsx)

Click the **💬 Chat** button on patient dashboard to open!

---

## 📋 Features

✅ Medical AI Assistant (Groq + Llama)  
✅ Conversation History  
✅ Markdown Support  
✅ Real-time Typing Indicator  
✅ CORS Enabled for MedTech  
✅ Comprehensive Logging  
✅ Responsive Design  

---

## 📝 System Prompt

Acts as a **responsible medical assistant** that:
- Suggests home remedies & lifestyle tips
- **NEVER prescribes medicines**
- Warns about serious conditions
- Always recommends consulting a doctor

---

## 🛠️ Environment Variables

```env
GROQ_API_KEY        # Your Groq API key (required)
GROQ_MODEL          # Model (default: llama-3.3-70b-versatile)
PORT                # Server port (default: 3001)
NODE_ENV            # development/production
```

---

## 🚀 Deployment

### Render Deployment
1. Push `healthconnect-chatbot/` to GitHub
2. Create new Render service from repository
3. Set environment variables
4. Deploy!

**Note**: Update ChatbotPage.tsx production URL after deployment.

---

## 🐛 Debugging

Console logs show:
- `[Chatbot Server]` - Server startup
- `[Chatbot API]` - Request/response logs
- `[Assistant]` - Groq AI calls
- `[ChatUI]` - Frontend interactions

Open browser console to see all logs!

---

## 📚 Available Models

- `llama-3.3-70b-versatile` (default, recommended)
- `llama-3.1-8b-instant` (faster)
- `mixtral-8x7b-32768`
- `gemma2-9b-it`

---

## 📞 Support

For issues, check:
1. Groq API key is valid
2. Server is running: `curl http://localhost:3001/api/history`
3. CORS is enabled
4. Port 3001 is not in use
5. Console logs for errors
