import OpenAI from "openai";
import { buildSystemPrompt, prepareMessages } from "./types.js";
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
        ...prepareMessages(messages, context).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
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
