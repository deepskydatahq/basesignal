// packages/core/src/llm/mock.ts

import type { LlmProvider, LlmMessage, LlmOptions } from "./types";

export interface MockCall {
  messages: LlmMessage[];
  options?: LlmOptions;
}

export class MockProvider implements LlmProvider {
  private responses: string[];
  private callIndex: number = 0;
  public calls: MockCall[] = [];

  constructor(responses: string | string[]) {
    this.responses = Array.isArray(responses) ? responses : [responses];
  }

  async complete(messages: LlmMessage[], options?: LlmOptions): Promise<string> {
    this.calls.push({ messages, options });
    const response = this.responses[this.callIndex % this.responses.length];
    this.callIndex++;
    return response;
  }

  reset(): void {
    this.calls = [];
    this.callIndex = 0;
  }
}
