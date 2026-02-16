// packages/core/src/llm/openai.ts

import OpenAI from "openai";
import type { LlmProvider, LlmMessage, LlmOptions } from "./types";

export interface OpenAIProviderConfig {
  apiKey?: string;
  defaultModel?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

export class OpenAIProvider implements LlmProvider {
  private client: OpenAI;
  private defaults: Required<Omit<OpenAIProviderConfig, "apiKey">>;

  constructor(config: OpenAIProviderConfig = {}) {
    const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OpenAI API key required: pass apiKey in config or set OPENAI_API_KEY"
      );
    }
    this.client = new OpenAI({ apiKey });
    this.defaults = {
      defaultModel: config.defaultModel ?? "gpt-4o",
      defaultMaxTokens: config.defaultMaxTokens ?? 4096,
      defaultTemperature: config.defaultTemperature ?? 0.2,
    };
  }

  async complete(messages: LlmMessage[], options?: LlmOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: options?.model ?? this.defaults.defaultModel,
      max_tokens: options?.maxTokens ?? this.defaults.defaultMaxTokens,
      temperature: options?.temperature ?? this.defaults.defaultTemperature,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    return response.choices[0]?.message?.content ?? "";
  }
}
