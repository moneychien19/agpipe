import OpenAI from "openai";
import { buildSystemPrompt } from "./types.js";
import type { LLMProvider, Message } from "./types.js";

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;
  private language: string;

  constructor(apiKey: string, model: string, language: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.language = language;
  }

  async *stream(messages: Message[], context?: string): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      stream: true,
      messages: [
        { role: "system", content: buildSystemPrompt(this.language) },
        ...messages.map((m, i) => ({
          role: m.role as "user" | "assistant",
          // Prepend piped context to the first user message only
          content:
            i === 0 && context
              ? `<context>\n${context}\n</context>\n\n${m.content}`
              : m.content,
        })),
      ],
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        yield text;
      }
    }
  }
}
