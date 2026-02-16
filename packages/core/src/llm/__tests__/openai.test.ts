import { describe, it, expect, vi } from "vitest";
import { OpenAIProvider } from "../openai";

// Mock the openai package
const mockCreate = vi.fn().mockResolvedValue({
  choices: [{ message: { content: "mocked response" } }],
});

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

describe("OpenAIProvider", () => {
  it("throws if no API key provided and env var unset", () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => new OpenAIProvider()).toThrow("OpenAI API key required");
  });

  it("reads API key from config", () => {
    expect(() => new OpenAIProvider({ apiKey: "sk-test" })).not.toThrow();
  });

  it("reads API key from OPENAI_API_KEY env var", () => {
    process.env.OPENAI_API_KEY = "sk-env";
    expect(() => new OpenAIProvider()).not.toThrow();
    delete process.env.OPENAI_API_KEY;
  });

  it("passes messages including system role directly", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    const result = await provider.complete([
      { role: "system", content: "Be helpful" },
      { role: "user", content: "Hello" },
    ]);
    expect(result).toBe("mocked response");

    const callArgs = mockCreate.mock.calls.at(-1)?.[0];
    expect(callArgs.messages).toEqual([
      { role: "system", content: "Be helpful" },
      { role: "user", content: "Hello" },
    ]);
  });

  it("uses default model gpt-4o", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    await provider.complete([{ role: "user", content: "test" }]);
    const callArgs = mockCreate.mock.calls.at(-1)?.[0];
    expect(callArgs.model).toBe("gpt-4o");
  });

  it("supports model selection via options", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    await provider.complete(
      [{ role: "user", content: "test" }],
      { model: "gpt-4o-mini" }
    );
    const callArgs = mockCreate.mock.calls.at(-1)?.[0];
    expect(callArgs.model).toBe("gpt-4o-mini");
  });

  it("applies default temperature and maxTokens", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    await provider.complete([{ role: "user", content: "test" }]);
    const callArgs = mockCreate.mock.calls.at(-1)?.[0];
    expect(callArgs.temperature).toBe(0.2);
    expect(callArgs.max_tokens).toBe(4096);
  });

  it("applies per-call option overrides", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    await provider.complete(
      [{ role: "user", content: "test" }],
      { temperature: 0.8, maxTokens: 2048 }
    );
    const callArgs = mockCreate.mock.calls.at(-1)?.[0];
    expect(callArgs.temperature).toBe(0.8);
    expect(callArgs.max_tokens).toBe(2048);
  });

  it("applies constructor config defaults", async () => {
    const provider = new OpenAIProvider({
      apiKey: "sk-test",
      defaultModel: "gpt-4o-mini",
      defaultTemperature: 0.5,
      defaultMaxTokens: 1024,
    });
    await provider.complete([{ role: "user", content: "test" }]);
    const callArgs = mockCreate.mock.calls.at(-1)?.[0];
    expect(callArgs.model).toBe("gpt-4o-mini");
    expect(callArgs.temperature).toBe(0.5);
    expect(callArgs.max_tokens).toBe(1024);
  });

  it("returns empty string when response content is null", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });
    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    const result = await provider.complete([{ role: "user", content: "test" }]);
    expect(result).toBe("");
  });

  it("returns empty string when choices array is empty", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [] });
    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    const result = await provider.complete([{ role: "user", content: "test" }]);
    expect(result).toBe("");
  });
});
