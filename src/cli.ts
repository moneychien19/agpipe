#!/usr/bin/env node
import { loadConfig, persistModel, persistLanguage, ANTHROPIC_MODELS, OPENAI_MODELS, LANGUAGES } from "./config.js";
import { createProvider } from "./llm/index.js";
import type { Message } from "./llm/types.js";
import { readStdin } from "./stdin.js";
import { pickFromList } from "./terminal.js";
import { runInteractive } from "./interactive.js";

function parseArgs(argv: string[]): { instruction: string; pendingAction?: "set-model" | "set-lang" } {
  const args = argv.slice(2);
  const rest: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--model" || arg === "-m") {
      const config = loadConfig();
      process.stdout.write(`${config.model} (${config.provider})\n`);
      process.exit(0);
    } else if (arg === "--set-model") {
      if (i + 1 < args.length && !args[i + 1]!.startsWith("-")) {
        const modelName = args[++i]!;
        persistModel(modelName);
        process.stderr.write(`Default model set to "${modelName}".\n`);
        process.exit(0);
      } else {
        return { instruction: "", pendingAction: "set-model" };
      }
    } else if (arg === "--lang") {
      const config = loadConfig();
      process.stdout.write(`${config.language}\n`);
      process.exit(0);
    } else if (arg === "--set-lang") {
      if (i + 1 < args.length && !args[i + 1]!.startsWith("-")) {
        const lang = args[++i]!;
        persistLanguage(lang);
        process.stderr.write(`Response language set to "${lang}".\n`);
        process.exit(0);
      } else {
        return { instruction: "", pendingAction: "set-lang" };
      }
    } else if (arg === "--list-models" || arg === "-l") {
      process.stdout.write("Anthropic models:\n");
      for (const m of ANTHROPIC_MODELS) process.stdout.write(`  ${m}\n`);
      process.stdout.write("\nOpenAI models:\n");
      for (const m of OPENAI_MODELS) process.stdout.write(`  ${m}\n`);
      process.exit(0);
    } else {
      rest.push(arg);
    }
  }

  // Join all remaining tokens — works whether or not the user quoted the prompt
  return { instruction: rest.join(" ").trim() };
}

async function main() {
  const { instruction: argInstruction, pendingAction } = parseArgs(process.argv);

  // Validate config up front, before waiting for any input
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    process.stderr.write(`Config error: ${(err as Error).message}\n`);
    process.exit(1);
  }

  // Interactive pickers (don't need a provider)
  if (pendingAction === "set-model") {
    const all = [...ANTHROPIC_MODELS, ...OPENAI_MODELS];
    const chosen = await pickFromList(all, config.model);
    if (chosen) {
      persistModel(chosen);
      process.stderr.write(`Default model set to "${chosen}".\n`);
    }
    process.exit(0);
  }

  if (pendingAction === "set-lang") {
    const chosen = await pickFromList(LANGUAGES, config.language);
    if (chosen) {
      persistLanguage(chosen);
      process.stderr.write(`Response language set to "${chosen}".\n`);
    }
    process.exit(0);
  }

  let provider;
  try {
    provider = createProvider(config);
  } catch (err) {
    process.stderr.write(`Provider error: ${(err as Error).message}\n`);
    process.exit(1);
  }

  if (argInstruction) {
    // Single-turn: instruction from argv, piped stdin (if any) as context
    let context: string | undefined;
    try {
      context = await readStdin();
    } catch (err) {
      process.stderr.write(`stdin error: ${(err as Error).message}\n`);
      process.exit(1);
    }

    const messages: Message[] = [{ role: "user", content: argInstruction }];
    try {
      process.stdout.write(`[${config.model}] `);
      for await (const chunk of provider.stream(messages, context)) {
        process.stdout.write(chunk);
      }
      process.stdout.write("\n");
    } catch (err) {
      process.stderr.write(`LLM error: ${(err as Error).message}\n`);
      process.exit(1);
    }
  } else if (process.stdin.isTTY) {
    // Interactive multi-turn session
    await runInteractive(provider, config.model);
  } else {
    // Piped stdin with no argv instruction — treat pipe as single-turn instruction
    let instruction: string;
    try {
      instruction = ((await readStdin()) ?? "").trim();
    } catch (err) {
      process.stderr.write(`stdin error: ${(err as Error).message}\n`);
      process.exit(1);
    }

    if (!instruction) {
      process.stderr.write("No prompt provided.\n");
      process.exit(1);
    }

    const messages: Message[] = [{ role: "user", content: instruction }];
    try {
      process.stdout.write(`[${config.model}] `);
      for await (const chunk of provider.stream(messages)) {
        process.stdout.write(chunk);
      }
      process.stdout.write("\n");
    } catch (err) {
      process.stderr.write(`LLM error: ${(err as Error).message}\n`);
      process.exit(1);
    }
  }
}

main();
