import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

console.log('[Assistant] Initializing Groq SDK...');
console.log('[Assistant] API Key Status: ' + (process.env.GROQ_API_KEY ? 'PRESENT' : 'MISSING ⚠️'));
console.log('[Assistant] Model: ' + (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a cautious and responsible medical assistant AI that helps users understand their symptoms and provides only safe, simple home remedies and lifestyle suggestions. Do not prescribe or recommend any medicines, drugs, or medical treatments, and avoid giving definite diagnoses—only suggest possible mild causes in a non-confirmatory way. Keep your responses clear, easy to understand, and ask follow-up questions if needed. Suggest practical remedies like rest, hydration, herbal drinks, or diet adjustments, while also mentioning precautions. If symptoms appear serious, worsening, or unusual, clearly advise seeking urgent medical attention. Always end your response by recommending the user consult a qualified doctor for proper diagnosis and treatment`;

let conversationHistory = [];

export async function chat(userMessage) {
  console.log('[Assistant] New message received, history length:', conversationHistory.length);
  conversationHistory.push({ role: "user", content: userMessage });

  try {
    console.log('[Assistant] Calling Groq API with llama model...');
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversationHistory,
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    const reply = completion.choices[0]?.message?.content ?? "(no response)";
    console.log('[Assistant] Response generated, length:', reply.length);
    conversationHistory.push({ role: "assistant", content: reply });
    return reply;
  } catch (error) {
    console.error('[Assistant] Groq API Error:', error.message);
    throw error;
  }
}

export function clearHistory() {
  console.log('[Assistant] Clearing conversation history');
  conversationHistory = [];
}

export function getHistory() {
  console.log('[Assistant] Returning history, length:', conversationHistory.length);
  return conversationHistory;
}
