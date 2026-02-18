import { existsSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export const ANTHROPIC_MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
  "claude-3-haiku-20240307",
] as const;

export const OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
  "o1",
  "o1-mini",
  "o3",
  "o3-mini",
  "o4-mini",
] as const;

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
};

export const DEFAULT_LANGUAGE = "English";

export interface ResolvedConfig {
  provider: string;
  model: string;
  language: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
}

interface FileConfig {
  provider?: string;
  model?: string;
  language?: string;
}

function loadFileConfig(): FileConfig {
  const configPath = join(homedir(), ".agpipe.json");
  if (!existsSync(configPath)) return {};
  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as FileConfig;
  } catch {
    return {};
  }
}

function writeFileConfig(config: FileConfig): void {
  const configPath = join(homedir(), ".agpipe.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/** Infer provider from model name prefix. Returns undefined if unknown. */
function inferProvider(model: string): string | undefined {
  if (model.startsWith("claude-")) return "anthropic";
  if (
    model.startsWith("gpt-") ||
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4") ||
    model.startsWith("text-")
  )
    return "openai";
  return undefined;
}

/** Persist a model (and its inferred provider) to ~/.agpipe.json. */
export function persistModel(model: string): void {
  const existing = loadFileConfig();
  const provider = inferProvider(model) ?? existing.provider ?? "anthropic";
  writeFileConfig({ ...existing, provider, model });
}

/** Persist the response language to ~/.agpipe.json. */
export function persistLanguage(language: string): void {
  const existing = loadFileConfig();
  writeFileConfig({ ...existing, language });
}

export function loadConfig(): ResolvedConfig {
  const fileConfig = loadFileConfig();

  const provider = fileConfig.provider ?? "anthropic";
  const model = fileConfig.model ?? DEFAULT_MODELS[provider] ?? "gpt-4o-mini";
  const language = fileConfig.language ?? DEFAULT_LANGUAGE;

  return {
    provider,
    model,
    language,
    anthropicApiKey: process.env["ANTHROPIC_API_KEY"],
    openaiApiKey: process.env["OPENAI_API_KEY"],
  };
}
