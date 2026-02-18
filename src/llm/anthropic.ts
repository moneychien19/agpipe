import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, prepareMessages } from "./types.js";
import type { LLMProvider, Message } from "./types.js";

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;
  private language: string;

  constructor(apiKey: string, model: string, language: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.language = language;
  }

  async *stream(messages: Message[], context?: string): AsyncIterable<string> {
    const anthropicMessages = prepareMessages(messages, context).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 8096,
      system: buildSystemPrompt(this.language),
      messages: anthropicMessages,
    });

    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        yield chunk.delta.text;
      }
    }
  }
}
