import { emitKeypressEvents } from "readline";

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
export function pickFromList(items: readonly string[], current?: string): Promise<string | null> {
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
export function readMultilineInput(): Promise<string | null> {
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
