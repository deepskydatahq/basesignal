# Implementation Plan: OpenAI and Ollama Provider Adapters

**Task:** basesignal-6kz (M008-E004-S004)
**Design:** docs/plans/2026-02-15-openai-ollama-adapters-design.md
**Depends on:** M008-E004-S003 (LLM provider interface and Anthropic adapter)

## Context

The LLM provider interface (S003) defines `LlmProvider` with a `complete(messages, options)` method and implements `AnthropicProvider`. The `createProvider()` factory currently throws for `"openai"` and `"ollama"`. This story adds two adapters so users can switch providers via a single environment variable. Ollama is particularly important for fully offline, private operation.

## Preconditions

S003 must be complete. The following files must exist in `packages/core/src/llm/`:

- `types.ts` -- `LlmProvider`, `LlmMessage`, `LlmOptions` interfaces
- `anthropic.ts` -- `AnthropicProvider` class
- `factory.ts` -- `createProvider()` with throw stubs for openai/ollama, `createProviderFromEnv()`
- `helpers.ts` -- `callLlm()` convenience wrapper
- `mock.ts` -- `MockProvider` for testing
- `parse.ts` -- `extractJson()` utility
- `index.ts` -- barrel exports

## Approach

Two new files (`openai.ts`, `ollama.ts`), two updated files (`factory.ts`, `index.ts`), one updated config (`package.json`). The OpenAI adapter uses the `openai` npm package. The Ollama adapter uses raw `fetch` with zero dependencies. Both are under 50 lines each.

## Implementation Steps

### Step 1: Create `packages/core/src/llm/openai.ts`

New file. The OpenAI adapter wraps the `openai` npm package. Unlike Anthropic, system messages stay in the messages array (OpenAI's API accepts `role: "system"` natively). Response extraction is simpler -- `choices[0].message.content` is already a string.

```typescript
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
```

**Key differences from AnthropicProvider:**
- No system message separation -- OpenAI accepts `role: "system"` in the messages array
- Response is `choices[0].message.content` (string or null), not content blocks that need filtering
- Requires `openai` npm package (optional peer dependency)

### Step 2: Create `packages/core/src/llm/ollama.ts`

New file. Uses raw `fetch` to call Ollama's `/api/chat` endpoint. Zero npm dependencies. The critical detail is `stream: false` in the request body -- Ollama defaults to streaming, but our interface returns a complete string.

```typescript
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
```

**Key design decisions:**
- `stream: false` -- without this, Ollama returns newline-delimited JSON chunks
- `num_predict` maps to `maxTokens` (Ollama's name for max output tokens)
- `OLLAMA_HOST` env var respected as fallback (matches Ollama's own CLI convention)
- No API key required -- Ollama is fully local
- Trailing slash stripped from baseUrl to prevent double-slash in endpoint URL

### Step 3: Update `packages/core/src/llm/factory.ts`

Replace the `throw` stubs for `"openai"` and `"ollama"` with real provider instantiation. Use dynamic `require()` so the `openai` SDK is only loaded when that provider is selected (users who choose Ollama never need it installed).

**Replace the `case "openai":` block:**

```typescript
// Before:
case "openai":
  throw new Error(
    "OpenAI provider not yet implemented. Install @basesignal/provider-openai."
  );

// After:
case "openai": {
  const { OpenAIProvider } = require("./openai");
  return new OpenAIProvider({
    apiKey: config.apiKey,
    defaultModel: config.model,
  });
}
```

**Replace the `case "ollama":` block:**

```typescript
// Before:
case "ollama":
  throw new Error(
    "Ollama provider not yet implemented. Install @basesignal/provider-ollama."
  );

// After:
case "ollama": {
  const { OllamaProvider } = require("./ollama");
  return new OllamaProvider({
    baseUrl: config.baseUrl,
    defaultModel: config.model,
  });
}
```

**Update `createProviderFromEnv()`** -- add `OLLAMA_HOST` as a fallback for `baseUrl`:

```typescript
// Before:
return createProvider({
  provider: providerName,
  apiKey: apiKeyMap[providerName],
  model: process.env.BASESIGNAL_LLM_MODEL,
  baseUrl: process.env.BASESIGNAL_OLLAMA_URL,
});

// After:
return createProvider({
  provider: providerName,
  apiKey: apiKeyMap[providerName],
  model: process.env.BASESIGNAL_LLM_MODEL,
  baseUrl: process.env.BASESIGNAL_OLLAMA_URL ?? process.env.OLLAMA_HOST,
});
```

### Step 4: Update `packages/core/src/llm/index.ts`

Add exports for the two new providers. Insert after the existing `AnthropicProvider` exports:

```typescript
export { OpenAIProvider } from "./openai";
export type { OpenAIProviderConfig } from "./openai";
export { OllamaProvider } from "./ollama";
export type { OllamaProviderConfig } from "./ollama";
```

The full barrel export after this change:

```typescript
export type { LlmProvider, LlmMessage, LlmOptions } from "./types";
export { AnthropicProvider } from "./anthropic";
export type { AnthropicProviderConfig } from "./anthropic";
export { OpenAIProvider } from "./openai";
export type { OpenAIProviderConfig } from "./openai";
export { OllamaProvider } from "./ollama";
export type { OllamaProviderConfig } from "./ollama";
export { createProvider, createProviderFromEnv } from "./factory";
export type { ProviderConfig, ProviderType } from "./factory";
export { callLlm } from "./helpers";
export { MockProvider } from "./mock";
export type { MockCall } from "./mock";
export { extractJson } from "./parse";
```

### Step 5: Update `packages/core/package.json`

Add `openai` as an optional peer dependency alongside the existing `@anthropic-ai/sdk`:

```json
{
  "peerDependencies": {
    "@anthropic-ai/sdk": "^0.70.0",
    "openai": "^4.0.0"
  },
  "peerDependenciesMeta": {
    "@anthropic-ai/sdk": { "optional": true },
    "openai": { "optional": true }
  }
}
```

Ollama has no npm dependency -- it uses the Node.js built-in `fetch`.

### Step 6: Write tests for OpenAIProvider

New file: `packages/core/src/llm/__tests__/openai.test.ts`

Mock the `openai` package at the module level. All tests verify adapter behavior with no real API calls.

```typescript
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
```

### Step 7: Write tests for OllamaProvider

New file: `packages/core/src/llm/__tests__/ollama.test.ts`

Mock global `fetch`. Tests verify URL construction, request body shape, environment variable handling, and error behavior.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OllamaProvider } from "../ollama";

describe("OllamaProvider", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { content: "ollama response" } }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OLLAMA_HOST;
  });

  it("does not require an API key", () => {
    expect(() => new OllamaProvider()).not.toThrow();
  });

  it("defaults to localhost:11434", async () => {
    const provider = new OllamaProvider();
    await provider.complete([{ role: "user", content: "test" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.anything()
    );
  });

  it("uses configurable baseUrl", async () => {
    const provider = new OllamaProvider({ baseUrl: "http://gpu-server:11434" });
    await provider.complete([{ role: "user", content: "test" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://gpu-server:11434/api/chat",
      expect.anything()
    );
  });

  it("strips trailing slash from baseUrl", async () => {
    const provider = new OllamaProvider({ baseUrl: "http://gpu-server:11434/" });
    await provider.complete([{ role: "user", content: "test" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://gpu-server:11434/api/chat",
      expect.anything()
    );
  });

  it("reads OLLAMA_HOST env var", async () => {
    process.env.OLLAMA_HOST = "http://remote:11434";
    const provider = new OllamaProvider();
    await provider.complete([{ role: "user", content: "test" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://remote:11434/api/chat",
      expect.anything()
    );
  });

  it("sets stream: false in request body", async () => {
    const provider = new OllamaProvider();
    await provider.complete([{ role: "user", content: "test" }]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.stream).toBe(false);
  });

  it("defaults to llama3.1 model", async () => {
    const provider = new OllamaProvider();
    await provider.complete([{ role: "user", content: "test" }]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe("llama3.1");
  });

  it("maps maxTokens to num_predict", async () => {
    const provider = new OllamaProvider();
    await provider.complete(
      [{ role: "user", content: "test" }],
      { maxTokens: 2048 }
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.options.num_predict).toBe(2048);
  });

  it("passes temperature in options", async () => {
    const provider = new OllamaProvider();
    await provider.complete(
      [{ role: "user", content: "test" }],
      { temperature: 0.8 }
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.options.temperature).toBe(0.8);
  });

  it("supports model selection via options", async () => {
    const provider = new OllamaProvider();
    await provider.complete(
      [{ role: "user", content: "test" }],
      { model: "mistral" }
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe("mistral");
  });

  it("passes messages with role and content", async () => {
    const provider = new OllamaProvider();
    await provider.complete([
      { role: "system", content: "Be helpful" },
      { role: "user", content: "Hello" },
    ]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: "system", content: "Be helpful" },
      { role: "user", content: "Hello" },
    ]);
  });

  it("throws descriptive error on HTTP failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve('model "foo" not found'),
    });
    const provider = new OllamaProvider();
    await expect(
      provider.complete([{ role: "user", content: "test" }], { model: "foo" })
    ).rejects.toThrow('Ollama request failed (404): model "foo" not found');
  });

  it("uses statusText when response body is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve(""),
    });
    const provider = new OllamaProvider();
    await expect(
      provider.complete([{ role: "user", content: "test" }])
    ).rejects.toThrow("Ollama request failed (500): Internal Server Error");
  });

  it("handles text() rejection gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: () => Promise.reject(new Error("read error")),
    });
    const provider = new OllamaProvider();
    await expect(
      provider.complete([{ role: "user", content: "test" }])
    ).rejects.toThrow("Ollama request failed (503): Service Unavailable");
  });

  it("returns empty string when message content is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: {} }),
    });
    const provider = new OllamaProvider();
    const result = await provider.complete([{ role: "user", content: "test" }]);
    expect(result).toBe("");
  });

  it("applies constructor config defaults", async () => {
    const provider = new OllamaProvider({
      defaultModel: "mixtral",
      defaultTemperature: 0.5,
      defaultMaxTokens: 1024,
    });
    await provider.complete([{ role: "user", content: "test" }]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe("mixtral");
    expect(body.options.temperature).toBe(0.5);
    expect(body.options.num_predict).toBe(1024);
  });

  it("works with common models (llama3.1, mistral, mixtral)", async () => {
    const provider = new OllamaProvider();
    for (const model of ["llama3.1", "mistral", "mixtral"]) {
      await provider.complete(
        [{ role: "user", content: "test" }],
        { model }
      );
    }
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
```

### Step 8: Update factory tests

Add test cases to the existing `packages/core/src/llm/__tests__/factory.test.ts`. These additions verify the factory now returns real providers instead of throwing.

```typescript
// Add these imports at top
import { OpenAIProvider } from "../openai";
import { OllamaProvider } from "../ollama";

// Add to existing describe("createProvider") block:

it("returns OpenAIProvider for openai config", () => {
  const provider = createProvider({ provider: "openai", apiKey: "sk-test" });
  expect(provider).toBeInstanceOf(OpenAIProvider);
});

it("returns OllamaProvider for ollama config", () => {
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

// Add to existing describe("createProviderFromEnv") block:

it("creates OpenAI provider from env", () => {
  process.env.BASESIGNAL_LLM_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "sk-test";
  const provider = createProviderFromEnv();
  expect(provider).toBeInstanceOf(OpenAIProvider);
  delete process.env.BASESIGNAL_LLM_PROVIDER;
  delete process.env.OPENAI_API_KEY;
});

it("creates Ollama provider from env (no key needed)", () => {
  process.env.BASESIGNAL_LLM_PROVIDER = "ollama";
  const provider = createProviderFromEnv();
  expect(provider).toBeInstanceOf(OllamaProvider);
  delete process.env.BASESIGNAL_LLM_PROVIDER;
});

// Remove or update any existing tests that assert "openai" or "ollama" throw errors.
// For example, if there is a test like:
//   it("throws for openai", () => { ... })
// That test should be removed since "openai" now works.
```

### Step 9: Add integration smoke tests (manual, skipped by default)

New file: `packages/core/src/llm/__tests__/integration.test.ts`

These are skipped in CI. Developers run them manually to verify real API connectivity.

```typescript
import { describe, it, expect } from "vitest";
import { createProvider } from "../factory";

describe.skip("OpenAI integration (requires OPENAI_API_KEY)", () => {
  it("completes a simple prompt", async () => {
    const provider = createProvider({
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
    });
    const result = await provider.complete([
      { role: "user", content: "Reply with exactly: hello" },
    ]);
    expect(result.toLowerCase()).toContain("hello");
  });
});

describe.skip("Ollama integration (requires running Ollama)", () => {
  it("completes a simple prompt", async () => {
    const provider = createProvider({ provider: "ollama" });
    const result = await provider.complete([
      { role: "user", content: "Reply with exactly: hello" },
    ]);
    expect(result.toLowerCase()).toContain("hello");
  });
});
```

## Test Plan

All unit tests mock at the boundary (OpenAI SDK mock, `fetch` mock). No real API calls in CI.

### OpenAI tests (10 cases)

1. Throws if no API key and env var unset
2. Reads API key from config parameter
3. Reads API key from `OPENAI_API_KEY` env var
4. Passes messages including system role directly (no separation)
5. Uses default model `gpt-4o`
6. Supports model selection via options
7. Applies default temperature and maxTokens
8. Applies per-call option overrides
9. Applies constructor config defaults
10. Returns empty string when response content is null or choices empty

### Ollama tests (16 cases)

1. Does not require an API key
2. Defaults to `localhost:11434`
3. Uses configurable baseUrl
4. Strips trailing slash from baseUrl
5. Reads `OLLAMA_HOST` env var
6. Sets `stream: false` in request body
7. Defaults to `llama3.1` model
8. Maps `maxTokens` to `num_predict`
9. Passes temperature in options
10. Supports model selection via options
11. Passes messages with role and content
12. Throws descriptive error on HTTP failure
13. Uses statusText when response body is empty
14. Handles text() rejection gracefully
15. Returns empty string when message content is missing
16. Works with common models (llama3.1, mistral, mixtral)

### Factory tests (additions: 4 cases)

1. Returns `OpenAIProvider` for openai config
2. Returns `OllamaProvider` for ollama config
3. Passes baseUrl to OllamaProvider
4. `createProviderFromEnv` creates each provider from env vars

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/llm/openai.ts` | **NEW** -- OpenAIProvider class (~45 lines) |
| `packages/core/src/llm/ollama.ts` | **NEW** -- OllamaProvider class (~55 lines) |
| `packages/core/src/llm/factory.ts` | **UPDATED** -- Replace throw stubs with real provider instantiation, add `OLLAMA_HOST` fallback in `createProviderFromEnv` |
| `packages/core/src/llm/index.ts` | **UPDATED** -- Add OpenAI and Ollama exports |
| `packages/core/package.json` | **UPDATED** -- Add `openai` as optional peer dependency |
| `packages/core/src/llm/__tests__/openai.test.ts` | **NEW** -- 10 unit tests |
| `packages/core/src/llm/__tests__/ollama.test.ts` | **NEW** -- 16 unit tests |
| `packages/core/src/llm/__tests__/factory.test.ts` | **UPDATED** -- Add ~6 tests for new providers, remove "throws for openai/ollama" tests |
| `packages/core/src/llm/__tests__/integration.test.ts` | **NEW** -- Skipped smoke tests for manual validation |

## Order of Implementation

1. Create `openai.ts` (self-contained, depends only on types.ts)
2. Create `ollama.ts` (self-contained, depends only on types.ts)
3. Update `factory.ts` (replace stubs, add OLLAMA_HOST fallback)
4. Update `index.ts` (add exports)
5. Update `package.json` (add openai peer dependency)
6. Write `openai.test.ts`
7. Write `ollama.test.ts`
8. Update `factory.test.ts`
9. Write `integration.test.ts` (skipped)
10. Run `npm test` -- all tests pass, TypeScript compiles cleanly

## Risks

1. **`packages/core` does not exist yet.** This story depends on S003 which creates the directory structure. If S003 is not complete, this story cannot start. Verify the precondition before beginning work.
2. **OpenAI SDK version compatibility.** The adapter uses `client.chat.completions.create()` which is stable in openai v4+. The `^4.0.0` peer dependency range covers this.
3. **Ollama API stability.** The `/api/chat` endpoint is Ollama's primary interface and has been stable across releases. The request/response shape is unlikely to change.
4. **Dynamic `require()` in ESM context.** The factory uses `require()` for lazy loading. If `packages/core` uses ESM (`"type": "module"`), this may need to become `await import()` or the factory may need to be async. The root `package.json` has `"type": "module"`. Check how S003 handles this -- if the factory already uses `require()` successfully, follow that pattern.
