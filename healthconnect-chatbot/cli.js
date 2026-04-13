import * as readline from "readline";
import { chat, clearHistory, getHistory } from "./assistant.js";

console.log("\n🏥 MedTech AI Health Assistant (CLI Mode)");
console.log("========================================");
console.log("Type 'exit' to quit, 'clear' to reset conversation\n");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  const askQuestion = () => {
    rl.question("📝 You: ", async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === "exit") {
        console.log("\n✅ Goodbye!\n");
        rl.close();
        return;
      }

      if (trimmed.toLowerCase() === "clear") {
        clearHistory();
        console.log("🔄 Conversation cleared.\n");
        askQuestion();
        return;
      }

      if (!trimmed) {
        askQuestion();
        return;
      }

      try {
        console.log('\n⏳ Thinking...\n');
        const reply = await chat(trimmed);
        console.log(`🤖 Assistant: ${reply}\n`);
      } catch (err) {
        console.error(`❌ Error: ${err.message}\n`);
      }

      askQuestion();
    });
  };

  askQuestion();
}

main();
