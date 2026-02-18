#!/usr/bin/env node
import { emitKeypressEvents } from "readline";
import { loadConfig, persistModel, persistLanguage, ANTHROPIC_MODELS, OPENAI_MODELS, LANGUAGES } from "./config.js";
import { createProvider, type LLMProvider } from "./llm/index.js";
import type { Message } from "./llm/types.js";
import { readStdin } from "./stdin.js";

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

const PROMPT = "▶️  ";
const PROMPT_COLS = 4; // visual width: ▶️ (2) + 2 spaces

interface KeyInfo {
  name: string;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
}

/**
 * Interactive up/down picker. Returns the selected item, or null if cancelled.
 * Pre-selects `current` if it appears in the list.
 */
function pickFromList(items: readonly string[], current?: string): Promise<string | null> {
  return new Promise((resolve) => {
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    let selected = Math.max(0, current ? items.indexOf(current as string) : 0);

    const render = (initial = false) => {
      if (!initial) {
        // Move cursor up to the first item line
        process.stderr.write(`\x1b[${items.length}A`);
      }
      for (let i = 0; i < items.length; i++) {
        const prefix = i === selected ? "❯ " : "  ";
        process.stderr.write(`\x1b[2K${prefix}${items[i]}\r\n`);
      }
    };

    const cleanup = () => {
      process.stdin.removeListener("keypress", onKeypress);
      process.stdin.setRawMode(false);
    };

    const onKeypress = (_ch: string | undefined, key: KeyInfo | undefined) => {
      if (!key) return;
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.stderr.write("\n");
        resolve(null);
      } else if (key.name === "up") {
        selected = Math.max(0, selected - 1);
        render();
      } else if (key.name === "down") {
        selected = Math.min(items.length - 1, selected + 1);
        render();
      } else if (key.name === "return") {
        cleanup();
        process.stderr.write("\n");
        resolve(items[selected] as string);
      }
    };

    process.stdin.on("keypress", onKeypress);
    render(true);
  });
}

/**
 * Reads multiline input from a TTY using raw mode.
 * - Enter        → submit
 * - Shift+Enter  → insert newline (requires a terminal that sends CSI u sequences)
 * - Backspace    → delete last character, or merge with previous line
 * - Ctrl+C       → exit process
 * - Ctrl+D       → return null (EOF) if input is empty
 */
function readMultilineInput(): Promise<string | null> {
  return new Promise((resolve) => {
    process.stderr.write(PROMPT);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const lines: string[] = [""];

    const cleanup = () => {
      process.stdin.removeListener("keypress", onKeypress);
      process.stdin.setRawMode(false);
    };

    // 1-based terminal column of the cursor for a given line
    const cursorCol = (lineIdx: number) =>
      (lineIdx === 0 ? PROMPT_COLS : 0) + lines[lineIdx]!.length + 1;

    const onKeypress = (ch: string | undefined, key: KeyInfo | undefined) => {
      if (!key) {
        if (ch && ch >= " ") {
          lines[lines.length - 1] += ch;
          process.stderr.write(ch);
        }
        return;
      }

      // Ctrl+C → exit
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.stderr.write("\n");
        process.exit(0);
      }

      // Ctrl+D → EOF when input is empty
      if (key.ctrl && key.name === "d") {
        if (lines.length === 1 && lines[0] === "") {
          cleanup();
          process.stderr.write("\n");
          resolve(null);
        }
        return;
      }

      // Shift+Enter → insert newline within input
      if (key.name === "return" && key.shift) {
        lines.push("");
        process.stderr.write("\n");
        return;
      }

      // Enter → submit
      if (key.name === "return") {
        cleanup();
        process.stderr.write("\n");
        resolve(lines.join("\n").trimEnd() || "");
        return;
      }

      // Backspace → delete last char, or merge with previous line
      if (key.name === "backspace") {
        const lastIdx = lines.length - 1;
        const cur = lines[lastIdx]!;
        if (cur.length > 0) {
          lines[lastIdx] = cur.slice(0, -1);
          process.stderr.write("\b \b");
        } else if (lastIdx > 0) {
          lines.pop();
          // Move cursor up one line, then to end of that line
          process.stderr.write(`\x1b[A\x1b[${cursorCol(lines.length - 1)}G`);
        }
        return;
      }

      // Printable character
      if (!key.ctrl && !key.meta && ch) {
        lines[lines.length - 1] += ch;
        process.stderr.write(ch);
      }
    };

    process.stdin.on("keypress", onKeypress);
  });
}

/** Persistent interactive session: loops until Ctrl+C or EOF, keeping full history. */
async function runInteractive(provider: LLMProvider, model: string): Promise<void> {
  emitKeypressEvents(process.stdin);

  const history: Message[] = [];

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
      process.stdout.write(`\n[${model}] `);
      for await (const chunk of provider.stream(messages)) {
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
      instruction = await new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
        process.stdin.on("end", () =>
          resolve(Buffer.concat(chunks).toString("utf-8").trim())
        );
        process.stdin.on("error", reject);
      });
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
