// packages/core/src/llm/helpers.ts

import type { LlmProvider, LlmMessage, LlmOptions } from "./types";

/**
 * Convenience wrapper matching the existing callClaude() signature.
 * Makes migration easier: replace callClaude({system, user}) with
 * callLlm(provider, {system, user}).
 */
export async function callLlm(
  provider: LlmProvider,
  options: {
    system: string;
    user: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const messages: LlmMessage[] = [
    { role: "system", content: options.system },
    { role: "user", content: options.user },
  ];

  const llmOptions: LlmOptions = {
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  };

  return provider.complete(messages, llmOptions);
}
