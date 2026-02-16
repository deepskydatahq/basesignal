// packages/core/src/llm/llm.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @anthropic-ai/sdk before importing anything that uses it
const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
      constructor(public config: { apiKey: string }) {}
    },
  };
});

// Mock the openai package so factory.ts can import OpenAIProvider without issues
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: "mocked" } }],
        }),
      },
    };
  },
}));

import { extractJson } from "./parse";
import { MockProvider } from "./mock";
import { callLlm } from "./helpers";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { OllamaProvider } from "./ollama";
import { createProvider, createProviderFromEnv } from "./factory";
import type { LlmProvider } from "./types";

// ---------- extractJson ----------

describe("extractJson", () => {
  it("parses raw JSON object", () => {
    const result = extractJson('{"key":"value"}');
    expect(result).toEqual({ key: "value" });
  });

  it("extracts from ```json fences", () => {
    const result = extractJson('```json\n{"k":"v"}\n```');
    expect(result).toEqual({ k: "v" });
  });

  it("extracts from bare ``` fences", () => {
    const result = extractJson("```\n[1,2,3]\n```");
    expect(result).toEqual([1, 2, 3]);
  });

  it("throws on invalid JSON", () => {
    expect(() => extractJson("not json")).toThrow(SyntaxError);
  });
});

// ---------- MockProvider ----------

describe("MockProvider", () => {
  it("returns single canned response", async () => {
    const mock = new MockProvider("hello");
    const result = await mock.complete([{ role: "user", content: "hi" }]);
    expect(result).toBe("hello");
  });

  it("cycles through multiple responses", async () => {
    const mock = new MockProvider(["a", "b"]);
    const r1 = await mock.complete([{ role: "user", content: "1" }]);
    const r2 = await mock.complete([{ role: "user", content: "2" }]);
    const r3 = await mock.complete([{ role: "user", content: "3" }]);
    expect(r1).toBe("a");
    expect(r2).toBe("b");
    expect(r3).toBe("a"); // wraps around
  });

  it("records all calls", async () => {
    const mock = new MockProvider("ok");
    await mock.complete([{ role: "user", content: "first" }], {
      model: "test-model",
    });
    await mock.complete([{ role: "user", content: "second" }]);
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[0].messages[0].content).toBe("first");
    expect(mock.calls[0].options).toEqual({ model: "test-model" });
    expect(mock.calls[1].messages[0].content).toBe("second");
  });

  it("reset clears state", async () => {
    const mock = new MockProvider(["a", "b"]);
    await mock.complete([{ role: "user", content: "1" }]);
    await mock.complete([{ role: "user", content: "2" }]);
    mock.reset();
    expect(mock.calls).toHaveLength(0);
    // After reset, callIndex resets so next call returns "a" again
    const result = await mock.complete([{ role: "user", content: "3" }]);
    expect(result).toBe("a");
  });

  it("satisfies LlmProvider type", () => {
    const provider: LlmProvider = new MockProvider("test");
    expect(provider).toBeDefined();
    expect(typeof provider.complete).toBe("function");
  });
});

// ---------- callLlm ----------

describe("callLlm", () => {
  it("constructs messages from system + user", async () => {
    const mock = new MockProvider("response");
    await callLlm(mock, {
      system: "You are helpful",
      user: "Hello",
    });
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].messages).toEqual([
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hello" },
    ]);
  });

  it("passes through model, temperature, maxTokens", async () => {
    const mock = new MockProvider("response");
    await callLlm(mock, {
      system: "sys",
      user: "usr",
      model: "custom-model",
      temperature: 0.5,
      maxTokens: 1000,
    });
    expect(mock.calls[0].options).toEqual({
      model: "custom-model",
      temperature: 0.5,
      maxTokens: 1000,
    });
  });

  it("returns provider response", async () => {
    const mock = new MockProvider("the answer");
    const result = await callLlm(mock, {
      system: "sys",
      user: "usr",
    });
    expect(result).toBe("the answer");
  });
});

// ---------- AnthropicProvider construction ----------

describe("AnthropicProvider construction", () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("throws if no API key and env unset", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => new AnthropicProvider({})).toThrow(
      "Anthropic API key required"
    );
  });

  it("reads API key from config", () => {
    delete process.env.ANTHROPIC_API_KEY;
    const provider = new AnthropicProvider({ apiKey: "sk-test" });
    expect(provider).toBeDefined();
  });

  it("reads API key from ANTHROPIC_API_KEY env var", () => {
    process.env.ANTHROPIC_API_KEY = "sk-from-env";
    const provider = new AnthropicProvider();
    expect(provider).toBeDefined();
  });
});

// ---------- AnthropicProvider.complete() ----------

describe("AnthropicProvider.complete()", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "mocked response" }],
    });
  });

  it("separates system message into system parameter", async () => {
    const provider = new AnthropicProvider({ apiKey: "sk-test" });
    await provider.complete([
      { role: "system", content: "Be helpful" },
      { role: "user", content: "Hello" },
    ]);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toBe("Be helpful");
    expect(callArgs.messages).toEqual([
      { role: "user", content: "Hello" },
    ]);
  });

  it("applies default temperature 0.2", async () => {
    const provider = new AnthropicProvider({ apiKey: "sk-test" });
    await provider.complete([{ role: "user", content: "Hi" }]);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.temperature).toBe(0.2);
    expect(callArgs.max_tokens).toBe(4096);
    expect(callArgs.model).toBe("claude-sonnet-4-20250514");
  });

  it("applies option overrides", async () => {
    const provider = new AnthropicProvider({ apiKey: "sk-test" });
    await provider.complete([{ role: "user", content: "Hi" }], {
      model: "custom-model",
      temperature: 0.5,
      maxTokens: 2048,
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("custom-model");
    expect(callArgs.temperature).toBe(0.5);
    expect(callArgs.max_tokens).toBe(2048);
  });

  it("extracts text from content blocks", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "text", text: "hello" },
        { type: "text", text: " world" },
      ],
    });

    const provider = new AnthropicProvider({ apiKey: "sk-test" });
    const result = await provider.complete([
      { role: "user", content: "Hi" },
    ]);
    expect(result).toBe("hello world");
  });
});

// ---------- createProvider ----------

describe("createProvider", () => {
  it('returns AnthropicProvider for "anthropic"', () => {
    const provider = createProvider({
      provider: "anthropic",
      apiKey: "sk-test",
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('returns OpenAIProvider for "openai"', () => {
    const provider = createProvider({
      provider: "openai",
      apiKey: "sk-test",
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('returns OllamaProvider for "ollama"', () => {
    const provider = createProvider({ provider: "ollama" });
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it("passes baseUrl to OllamaProvider", () => {
    const provider = createProvider({
      provider: "ollama",
      baseUrl: "http://gpu:11434",
    });
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it("passes model to OpenAIProvider", () => {
    const provider = createProvider({
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("throws for unknown provider", () => {
    expect(() =>
      createProvider({ provider: "gemini" as any, apiKey: "sk-test" })
    ).toThrow("Unknown provider: gemini");
  });
});

// ---------- createProviderFromEnv ----------

describe("createProviderFromEnv", () => {
  const savedProvider = process.env.BASESIGNAL_LLM_PROVIDER;
  const savedAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const savedOpenAIKey = process.env.OPENAI_API_KEY;
  const savedModel = process.env.BASESIGNAL_LLM_MODEL;

  afterEach(() => {
    restoreEnv("BASESIGNAL_LLM_PROVIDER", savedProvider);
    restoreEnv("ANTHROPIC_API_KEY", savedAnthropicKey);
    restoreEnv("OPENAI_API_KEY", savedOpenAIKey);
    restoreEnv("BASESIGNAL_LLM_MODEL", savedModel);
  });

  function restoreEnv(key: string, value: string | undefined) {
    if (value !== undefined) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }

  it('defaults to "anthropic"', () => {
    delete process.env.BASESIGNAL_LLM_PROVIDER;
    process.env.ANTHROPIC_API_KEY = "sk-env-test";
    const provider = createProviderFromEnv();
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it("reads model from BASESIGNAL_LLM_MODEL", () => {
    delete process.env.BASESIGNAL_LLM_PROVIDER;
    process.env.ANTHROPIC_API_KEY = "sk-env-test";
    process.env.BASESIGNAL_LLM_MODEL = "claude-opus-4-20250514";
    const provider = createProviderFromEnv();
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it("creates OpenAI provider from env", () => {
    process.env.BASESIGNAL_LLM_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    const provider = createProviderFromEnv();
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("creates Ollama provider from env (no key needed)", () => {
    process.env.BASESIGNAL_LLM_PROVIDER = "ollama";
    const provider = createProviderFromEnv();
    expect(provider).toBeInstanceOf(OllamaProvider);
  });
});
