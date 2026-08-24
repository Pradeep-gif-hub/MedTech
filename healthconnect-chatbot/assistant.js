import Groq from "groq-sdk";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const DEFAULT_GROQ_MODEL = "moonshotai/kimi-k2-instruct";
const MODEL_PREFERENCES = [
  DEFAULT_GROQ_MODEL,
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3-32b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.1-8b-instant",
];

// Get the directory of this file
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const configuredModel = process.env.GROQ_MODEL?.trim();
const groqModel = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"].includes(configuredModel)
  ? DEFAULT_GROQ_MODEL
  : (configuredModel || DEFAULT_GROQ_MODEL);

console.log('[Assistant] Initializing Groq SDK...');
console.log('[Assistant] API Key Status: ' + (process.env.GROQ_API_KEY ? 'PRESENT' : 'MISSING ⚠️'));
console.log('[Assistant] Model: ' + groqModel);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
let resolvedGroqModel;
let modelDiscovery;

async function getGroqModel() {
  if (resolvedGroqModel) return resolvedGroqModel;
  if (!modelDiscovery) {
    modelDiscovery = groq.models.list().then((response) => {
      const availableModels = new Set(response.data.map((model) => model.id));
      const requestedModel = configuredModel && ![
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
      ].includes(configuredModel) ? configuredModel : null;
      resolvedGroqModel = [requestedModel, ...MODEL_PREFERENCES]
        .find((model) => model && availableModels.has(model));

      if (!resolvedGroqModel) {
        throw new Error('No chat model is available for this Groq API key');
      }

      console.log('[Assistant] Accessible model selected: ' + resolvedGroqModel);
      return resolvedGroqModel;
    });
  }
  return modelDiscovery;
}

const SYSTEM_PROMPT = `You are a cautious and responsible medical assistant AI that helps users understand their symptoms and provides only safe, simple home remedies and lifestyle suggestions. Do not prescribe or recommend any medicines, drugs, or medical treatments, and avoid giving definite diagnoses—only suggest possible mild causes in a non-confirmatory way. Keep your responses clear, easy to understand, and ask follow-up questions if needed. Suggest practical remedies like rest, hydration, herbal drinks, or diet adjustments, while also mentioning precautions. If symptoms appear serious, worsening, or unusual, clearly advise seeking urgent medical attention. Always end your response by recommending the user consult a qualified doctor for proper diagnosis and treatment`;

let conversationHistory = [];

export async function chat(userMessage) {
  console.log('[Assistant] New message received, history length:', conversationHistory.length);
  conversationHistory.push({ role: "user", content: userMessage });

  try {
    const model = await getGroqModel();
    console.log('[Assistant] Calling Groq API with ' + model + '...');
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
