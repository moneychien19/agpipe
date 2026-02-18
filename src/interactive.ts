import { emitKeypressEvents } from "readline";
import type { LLMProvider } from "./llm/index.js";
import type { Message } from "./llm/types.js";
import { buildExecPrompt } from "./llm/types.js";
import { readMultilineInput } from "./terminal.js";

/** Persistent interactive session: loops until Ctrl+C or EOF, keeping full history. */
export async function runInteractive(provider: LLMProvider, model: string, exec = false): Promise<void> {
  emitKeypressEvents(process.stdin);

  const history: Message[] = [];
  const systemPrompt = exec ? buildExecPrompt() : undefined;

  while (true) {
    const instruction = await readMultilineInput();
    if (instruction === null) process.exit(0);
    if (!instruction) continue; // empty submit — re-prompt

    const messages: Message[] = [
      ...history,
      { role: "user", content: instruction },
    ];

    let assistantResponse = "";
    try {
      if (exec) {
        process.stderr.write(`\n[${model}]\n`);
      } else {
        process.stdout.write(`\n[${model}] `);
      }
      for await (const chunk of provider.stream(messages, undefined, systemPrompt)) {
        process.stdout.write(chunk);
        assistantResponse += chunk;
      }
      process.stdout.write("\n\n");
    } catch (err) {
      process.stderr.write(`LLM error: ${(err as Error).message}\n`);
      continue;
    }

    history.push({ role: "user", content: instruction });
    history.push({ role: "assistant", content: assistantResponse });
  }
}
