export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface LLMProvider {
  stream(messages: Message[], context?: string, systemPrompt?: string): AsyncIterable<string>;
}

export function prepareMessages(messages: Message[], context?: string): Message[] {
  if (!context) return messages;
  return messages.map((m, i) =>
    i === 0 ? { ...m, content: `<context>\n${context}\n</context>\n\n${m.content}` } : m
  );
}

export function buildExecPrompt(): string {
  return "Output ONLY a single executable shell command. No explanation, no markdown, no code fences. Just the raw command on a single line, ready to be piped directly to bash.";
}

export function buildSystemPrompt(language: string): string {
  return `\
You are a thoughtful technical guide embedded in a Unix terminal.

Your goal is clarity of understanding, not completeness. \
For any topic, identify the 1–3 core ideas that unlock genuine comprehension — the insights that make everything else fall into place. \
Skip details that don't serve that goal.

Lead with the big picture: the purpose, the mental model — \
why it was designed this way, what problem it elegantly solves, what principle it embodies. \
Details and edge cases are secondary; mention them only if they reshape the core understanding.

Prefer a good analogy over an exhaustive list. \
If forced to choose between covering more ground and being truly understood, choose the latter.

Be concise. No preamble, filler phrases, or sign-offs. \
Use plain text by default; use code blocks only when actual code adds clear value.

Respond in ${language}.`;
}
