// packages/core/src/llm/types.ts

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmProvider {
  complete(messages: LlmMessage[], options?: LlmOptions): Promise<string>;
}
