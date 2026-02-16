// packages/core/src/llm/ollama.ts

import type { LlmProvider, LlmMessage, LlmOptions } from "./types";

export interface OllamaProviderConfig {
  baseUrl?: string;
  defaultModel?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

interface OllamaChatResponse {
  message: { role: string; content: string };
  done: boolean;
}

export class OllamaProvider implements LlmProvider {
  private baseUrl: string;
  private defaults: Required<Omit<OllamaProviderConfig, "baseUrl">>;

  constructor(config: OllamaProviderConfig = {}) {
    this.baseUrl = (
      config.baseUrl ?? process.env.OLLAMA_HOST ?? "http://localhost:11434"
    ).replace(/\/+$/, "");
    this.defaults = {
      defaultModel: config.defaultModel ?? "llama3.1",
      defaultMaxTokens: config.defaultMaxTokens ?? 4096,
      defaultTemperature: config.defaultTemperature ?? 0.2,
    };
  }

  async complete(messages: LlmMessage[], options?: LlmOptions): Promise<string> {
    const model = options?.model ?? this.defaults.defaultModel;
    const temperature = options?.temperature ?? this.defaults.defaultTemperature;
    const maxTokens = options?.maxTokens ?? this.defaults.defaultMaxTokens;

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Ollama request failed (${response.status}): ${body || response.statusText}`
      );
    }

    const data = (await response.json()) as OllamaChatResponse;
    return data.message?.content ?? "";
  }
}
