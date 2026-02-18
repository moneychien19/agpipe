import type { LLMProvider } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import type { ResolvedConfig } from "../config.js";

export function createProvider(config: ResolvedConfig): LLMProvider {
  switch (config.provider) {
    case "anthropic": {
      if (!config.anthropicApiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY is required when using the anthropic provider."
        );
      }
      return new AnthropicProvider(config.anthropicApiKey, config.model, config.language);
    }
    case "openai": {
      if (!config.openaiApiKey) {
        throw new Error(
          "OPENAI_API_KEY is required when using the openai provider."
        );
      }
      return new OpenAIProvider(config.openaiApiKey, config.model, config.language);
    }
    default: {
      throw new Error(
        `Unknown provider "${config.provider}". Supported providers: anthropic, openai.`
      );
    }
  }
}

export type { LLMProvider };
