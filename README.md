# agpipe

A Unix-style CLI that pipes your instruction — and optionally piped stdin — to an LLM and streams the response to stdout.

## Installation

```bash
npm install -g agpipe
export ANTHROPIC_API_KEY="sk-ant-..."  # or OPENAI_API_KEY
```

## Usage

```bash
ag "What is the Unix pipe philosophy?"
cat file.ts | ag "Explain this code"
cat notes.txt | ag "Summarize this." | pbcopy
ag   # interactive session
```

| Invocation        | Instruction source      | Context     |
| ----------------- | ----------------------- | ----------- |
| `ag "..."`        | argv                    | —           |
| `cmd \| ag "..."` | argv                    | piped stdin |
| `ag`              | interactive `▶️` prompt | —           |
| `cmd \| ag`       | piped stdin             | —           |

> **Tip:** Quote argv instructions to avoid shell metacharacter expansion (`?`, `*`, `[`).

## Flags

| Flag                  | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| `-m`, `--model`       | Show the current model and provider.                            |
| `--set-model [name]`  | Set the default model; interactive picker if no name given.     |
| `--lang`              | Show the current response language.                             |
| `--set-lang [lang]`   | Set the response language; interactive picker if no lang given. |
| `-l`, `--list-models` | List all available models.                                      |

## Models

| Provider    | Default model    | Available models                                                                                                                    |
| ----------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `anthropic` | `claude-opus-4-6` | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-3-7-sonnet-20250219`, `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229`, `claude-3-haiku-20240307` |
| `openai`    | `gpt-5.2`        | `gpt-5.2`, `gpt-5.1`, `gpt-5`, `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-4`, `gpt-3.5-turbo`, `o1`, `o1-mini`, `o3`, `o3-mini`, `o4-mini` |

## Configuration

Settings are stored in `~/.agpipe.json` and updated by `--set-model` / `--set-lang`.

```json
{
  "provider": "anthropic",
  "model": "claude-haiku-4-5-20251001",
  "language": "English"
}
```

## Development

```bash
git clone https://github.com/moneychien19/agpipe.git
cd agpipe
npm install
npm run build
npm link      # makes `ag` available globally
```
