# agpipe

A Unix-style command-line tool that pipes your instruction — and optionally piped stdin — to an LLM and streams the response to stdout.

## Requirements

- **Node.js** ≥ 18
- An API key for your chosen provider: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`

## Installation

### Global (recommended)

```bash
npm install -g agpipe
```

### Local development

```bash
git clone https://github.com/your-username/agpipe.git
cd agpipe
npm install
npm run build
npm link      # makes `ag` available globally
```

## Usage

```
ag [flags] [instruction...]
<command> | ag [flags] [instruction...]
```

| Invocation           | Instruction source       | Context     |
| -------------------- | ------------------------ | ----------- |
| `ag "..."`           | argv                     | —           |
| `cmd \| ag "..."`    | argv                     | piped stdin |
| `ag` _(in terminal)_ | interactive `▶️` prompt  | —           |
| `cmd \| ag`          | piped stdin              | —           |

In interactive mode, the session persists across turns (full conversation history is kept). Press **Enter** to submit, **Shift+Enter** to insert a newline, **Ctrl+C** or **Ctrl+D** (on empty input) to exit.

## Flags

| Flag                 | Alias | Description                                                        |
| -------------------- | ----- | ------------------------------------------------------------------ |
| `--model`            | `-m`  | Show the current active model and provider, then exit.             |
| `--set-model <name>` |       | Persist a model as the new default in `~/.agpipe.json`, then exit. |
| `--lang`             |       | Show the current response language, then exit.                     |
| `--set-lang <lang>`  |       | Persist a response language in `~/.agpipe.json`, then exit.        |
| `--list-models`      | `-l`  | Print all available models grouped by provider, then exit.         |

### `--model` / `-m`

```bash
$ ag -m
claude-haiku-4-5-20251001 (anthropic)
```

### `--set-model <name>`

Persists a model to `~/.agpipe.json`. The provider is inferred automatically from the model name.

```bash
ag --set-model gpt-4o
ag --set-model claude-sonnet-4-6
```

### `--lang` / `--set-lang`

```bash
$ ag --lang
English

ag --set-lang 繁體中文
ag --set-lang Japanese
ag --set-lang English
```

### `--list-models` / `-l`

```bash
$ ag -l
Anthropic models:
  claude-opus-4-6
  claude-sonnet-4-6
  claude-haiku-4-5-20251001
  ...

OpenAI models:
  gpt-4o
  gpt-4o-mini
  o1
  ...
```

## Configuration

Settings are stored in `~/.agpipe.json` and updated by `--set-model` and `--set-lang`.

```json
{
  "provider": "anthropic",
  "model": "claude-haiku-4-5-20251001",
  "language": "English"
}
```

### Environment variables

| Variable            | Description                          |
| ------------------- | ------------------------------------ |
| `ANTHROPIC_API_KEY` | Required when using Anthropic models |
| `OPENAI_API_KEY`    | Required when using OpenAI models    |

### Defaults

| Provider    | Default model               |
| ----------- | --------------------------- |
| `anthropic` | `claude-haiku-4-5-20251001` |
| `openai`    | `gpt-4o-mini`               |

## Examples

```bash
# Ask a question
ag "What is the Unix pipe philosophy?"

# Pipe file contents as context
cat notes.txt | ag "Summarize this."
ag "Summarize this." < notes.txt

# Chain with other tools
cat file.ts | ag "Explain this code" | less -R
cat file.txt | ag "Translate to Japanese" | pbcopy

# Redirect output to a file
ag "Explain TCP handshake" >> notes.txt

# Switch models
ag -m
ag --set-model claude-sonnet-4-6
ag -m
```
