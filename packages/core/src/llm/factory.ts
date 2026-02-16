// packages/core/src/llm/factory.ts

import type { LlmProvider } from "./types";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { OllamaProvider } from "./ollama";

export type ProviderType = "anthropic" | "openai" | "ollama";

export interface ProviderConfig {
  provider: ProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export function createProvider(config: ProviderConfig): LlmProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider({
        apiKey: config.apiKey,
        defaultModel: config.model,
      });
    case "openai":
      return new OpenAIProvider({
        apiKey: config.apiKey,
        defaultModel: config.model,
      });
    case "ollama":
      return new OllamaProvider({
        baseUrl: config.baseUrl,
        defaultModel: config.model,
      });
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Create a provider from environment variables.
 *
 * Reads:
 * - BASESIGNAL_LLM_PROVIDER (default: "anthropic")
 * - ANTHROPIC_API_KEY / OPENAI_API_KEY (depending on provider)
 * - BASESIGNAL_LLM_MODEL (optional, overrides provider default)
 */
export function createProviderFromEnv(): LlmProvider {
  const providerName = (process.env.BASESIGNAL_LLM_PROVIDER ?? "anthropic") as ProviderType;

  const apiKeyMap: Record<string, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    ollama: undefined,
  };

  return createProvider({
    provider: providerName,
    apiKey: apiKeyMap[providerName],
    model: process.env.BASESIGNAL_LLM_MODEL,
    baseUrl: process.env.BASESIGNAL_OLLAMA_URL ?? process.env.OLLAMA_HOST,
  });
}
