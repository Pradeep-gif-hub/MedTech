import Groq from "groq-sdk";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const MODEL_PREFERENCES = [
  DEFAULT_GROQ_MODEL,
  "openai/gpt-oss-20b",
  "qwen/qwen3.6-27b",
  "moonshotai/kimi-k2-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct",
];

// Get the directory of this file
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const configuredModel = process.env.GROQ_MODEL?.trim();
const effectiveConfiguredModel = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"].includes(configuredModel)
  ? DEFAULT_GROQ_MODEL
  : (configuredModel || DEFAULT_GROQ_MODEL);

console.log('[Assistant] Initializing Groq SDK...');
console.log('[Assistant] API Key Status: ' + (process.env.GROQ_API_KEY ? 'PRESENT' : 'MISSING ⚠️'));
console.log('[Assistant] Primary Model: ' + effectiveConfiguredModel);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
let cachedCandidateModels = null;

async function getCandidateModels() {
  if (cachedCandidateModels) return cachedCandidateModels;
  try {
    const response = await groq.models.list();
    const availableSet = new Set(response.data.map((m) => m.id));

    // Filter candidate list: effective configured model first, then MODEL_PREFERENCES
    const candidates = [effectiveConfiguredModel, ...MODEL_PREFERENCES]
      .filter((m, index, self) => m && availableSet.has(m) && self.indexOf(m) === index);

    if (candidates.length === 0) {
      // Fallback: pick any available model from Groq
      candidates.push(...Array.from(availableSet));
    }

    if (candidates.length === 0) {
      throw new Error("No active models found for this Groq API key");
    }

    console.log('[Assistant] Available candidate models:', candidates.join(', '));
    cachedCandidateModels = candidates;
    return cachedCandidateModels;
  } catch (err) {
    console.error('[Assistant] Failed to list Groq models:', err.message);
    // Fallback array if listing fails
    return [configuredModel || DEFAULT_GROQ_MODEL, ...MODEL_PREFERENCES];
  }
}

const SYSTEM_PROMPT = `You are a cautious and responsible medical assistant AI that helps users understand their symptoms and provides only safe, simple home remedies and lifestyle suggestions. Do not prescribe or recommend any medicines, drugs, or medical treatments, and avoid giving definite diagnoses—only suggest possible mild causes in a non-confirmatory way. Keep your responses clear, easy to understand, and ask follow-up questions if needed. Suggest practical remedies like rest, hydration, herbal drinks, or diet adjustments, while also mentioning precautions. If symptoms appear serious, worsening, or unusual, clearly advise seeking urgent medical attention. Always end your response by recommending the user consult a qualified doctor for proper diagnosis and treatment`;

let conversationHistory = [];

export async function chat(userMessage) {
  console.log('[Assistant] New message received, history length:', conversationHistory.length);
  conversationHistory.push({ role: "user", content: userMessage });

  const candidateModels = await getCandidateModels();
  let lastError = null;

  for (const model of candidateModels) {
    try {
      console.log('[Assistant] Attempting chat completion with model:', model);
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...conversationHistory,
        ],
        temperature: 0.7,
        max_tokens: 2048,
      });

      const reply = completion.choices[0]?.message?.content ?? "(no response)";
      console.log(`[Assistant] Success with model ${model}! Response length:`, reply.length);
      conversationHistory.push({ role: "assistant", content: reply });
      return reply;
    } catch (error) {
      lastError = error;
      console.warn(`[Assistant] Model ${model} failed (${error.message}). Trying backup model...`);
    }
  }

  // Remove the failed user message from history if all models failed
  conversationHistory.pop();
  console.error('[Assistant] All candidate Groq models failed. Last error:', lastError?.message);
  throw new Error(`All available Groq models failed. Last error: ${lastError?.message}`);
}

export function clearHistory() {
  console.log('[Assistant] Clearing conversation history');
  conversationHistory = [];
}

export function getHistory() {
  console.log('[Assistant] Returning history, length:', conversationHistory.length);
  return conversationHistory;
}
