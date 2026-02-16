// packages/core/src/llm/anthropic.ts

import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, LlmMessage, LlmOptions } from "./types";

export interface AnthropicProviderConfig {
  apiKey?: string;
  defaultModel?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

export class AnthropicProvider implements LlmProvider {
  private client: Anthropic;
  private defaults: Required<Omit<AnthropicProviderConfig, "apiKey">>;

  constructor(config: AnthropicProviderConfig = {}) {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Anthropic API key required: pass apiKey in config or set ANTHROPIC_API_KEY"
      );
    }
    this.client = new Anthropic({ apiKey });
    this.defaults = {
      defaultModel: config.defaultModel ?? "claude-sonnet-4-20250514",
      defaultMaxTokens: config.defaultMaxTokens ?? 4096,
      defaultTemperature: config.defaultTemperature ?? 0.2,
    };
  }

  async complete(messages: LlmMessage[], options?: LlmOptions): Promise<string> {
    const systemMessages = messages.filter((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    const system = systemMessages.map((m) => m.content).join("\n\n") || undefined;

    const response = await this.client.messages.create({
      model: options?.model ?? this.defaults.defaultModel,
      max_tokens: options?.maxTokens ?? this.defaults.defaultMaxTokens,
      temperature: options?.temperature ?? this.defaults.defaultTemperature,
      ...(system ? { system } : {}),
      messages: conversationMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }
}
