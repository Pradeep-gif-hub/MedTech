import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory of this file
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file in this directory
dotenv.config({ path: path.join(__dirname, '.env') });

import express from "express";
import cors from "cors";
import { chat, clearHistory, getHistory } from "./assistant.js";

const app = express();
const PORT = process.env.PORT || 3001;

console.log('[Chatbot Server] Initializing...');
console.log('[Chatbot Server] Environment: NODE_ENV=' + process.env.NODE_ENV);
console.log('[Chatbot Server] API Key Present: ' + (process.env.GROQ_API_KEY ? 'YES' : 'NO'));

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://medtech-4rjc.onrender.com'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  const { message, userId, userEmail } = req.body;
  console.log(`[Chatbot API] /api/chat called - User: ${userEmail}, Message length: ${message?.length || 0}`);
  
  if (!message?.trim()) {
    console.warn('[Chatbot API] Empty message received');
    return res.status(400).json({ error: "Message is required" });
  }
  try {
    console.log('[Chatbot API] Sending to Groq AI...');
    const reply = await chat(message);
    console.log('[Chatbot API] Response received, length:', reply.length);
    res.json({ reply, history: getHistory() });
  } catch (err) {
    console.error('[Chatbot API] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Clear history
app.post("/api/clear", (req, res) => {
  console.log('[Chatbot API] /api/clear called - clearing conversation history');
  clearHistory();
  res.json({ success: true });
});

// Get history
app.get("/api/history", (req, res) => {
  const history = getHistory();
  console.log('[Chatbot API] /api/history called - history length:', history.length);
  res.json({ history });
});

app.listen(PORT, () => {
  console.log(`\n✅ [Chatbot Server] Running at http://localhost:${PORT}`);
  console.log(`[Chatbot Server] Health check: /api/history`);
});
