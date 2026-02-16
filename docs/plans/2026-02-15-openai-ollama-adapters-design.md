# OpenAI and Ollama Provider Adapters

**Story:** M008-E004-S004
**Date:** 2026-02-15
**Status:** Design
**Depends on:** M008-E004-S003 (LLM provider interface and Anthropic adapter)

---

## 1. Overview

This story implements two additional `LlmProvider` adapters -- `OpenAIProvider` (wrapping the `openai` npm package) and `OllamaProvider` (using Ollama's REST API via `fetch`) -- and wires them into the `createProvider()` factory. After this, users can switch between Anthropic, OpenAI, and Ollama by changing one environment variable. Ollama enables fully offline, private operation where no data leaves the user's machine.

---

## 2. Problem Statement

The LLM provider interface (S003) defines `LlmProvider` with a single `complete(messages, options)` method and implements the Anthropic adapter. The factory function currently throws for `"openai"` and `"ollama"`. Users who want to use OpenAI models (GPT-4o, GPT-4o-mini) or run locally with Ollama have no path forward.

The open-source mission (M008) requires that users can bring their own API key and choose their provider. Ollama is particularly important because it allows running Basesignal without sending any data to external services -- a hard requirement for some organizations.

---

## 3. Expert Perspectives

### Technical Architect

The interface is already defined: `complete(messages, options) -> string`. Each adapter maps the generic `LlmMessage[]` to its provider's wire format. The interesting design questions are:

1. **OpenAI SDK vs. raw HTTP.** Use the SDK. OpenAI's `openai` package handles auth, retries, typing, and response parsing. Fighting the SDK buys nothing. It is an optional peer dependency -- users who choose Anthropic or Ollama never install it.

2. **Ollama SDK vs. raw HTTP.** Use raw `fetch`. Ollama's API is 3 endpoints. The `POST /api/chat` endpoint takes `{ model, messages, options }` and returns `{ message: { content } }`. No SDK dependency means Ollama users install nothing extra. The HTTP surface is trivially small.

3. **Model defaults matter.** Each provider should have sensible defaults that produce comparable quality for Basesignal's extraction tasks. GPT-4o is OpenAI's best; `llama3.1` is Ollama's most broadly available. Do not try to normalize quality across providers -- just document the trade-offs.

### Simplification Reviewer

**Verdict: APPROVED with one cut.**

What to keep:
- Two files, one per adapter. No shared "adapter utils" layer. Each adapter is self-contained.
- Optional peer dependency for `openai`. No dependency at all for Ollama.
- Factory wiring -- the `createProvider()` switch statement gets two real cases instead of throwing.

What to cut:
- **No model alias mapping.** Do not create a `"fast"` / `"best"` abstraction that maps to provider-specific model names. Users already know their models. Pass model names through directly. If someone wants GPT-4o-mini, they set `BASESIGNAL_LLM_MODEL=gpt-4o-mini`. If they want `llama3.1:70b`, they set that. No translation layer.
- **No health checks or availability detection.** Checking if Ollama is running before calling it adds complexity for zero benefit -- the first call will fail with a clear error if the server is down.
- **No provider-specific options pass-through.** The interface is `LlmOptions` with model, temperature, maxTokens. If OpenAI users need `top_p` or Ollama users need `num_ctx`, they can extend their adapter locally. Do not add escape hatches preemptively.

The two adapters together should be under 150 lines total. If they are longer, something is wrong.

---

## 4. Proposed Solution

### 4.1 OpenAI Adapter

```typescript
// packages/core/src/llm/openai.ts

import OpenAI from "openai";
import type { LlmProvider, LlmMessage, LlmOptions } from "./types";

export interface OpenAIProviderConfig {
  apiKey?: string;           // defaults to OPENAI_API_KEY env var
  defaultModel?: string;     // defaults to "gpt-4o"
  defaultMaxTokens?: number; // defaults to 4096
  defaultTemperature?: number; // defaults to 0.2
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

**Key differences from Anthropic adapter:**

| Aspect | Anthropic | OpenAI |
|--------|-----------|--------|
| System message | Separated, passed as `system` parameter | Stays in messages array as `role: "system"` |
| Response shape | `response.content[]` blocks, filter for `type: "text"` | `response.choices[0].message.content` (string or null) |
| Parameter name | `max_tokens` | `max_tokens` (same in v4+ SDK) |
| Model default | `claude-sonnet-4-20250514` | `gpt-4o` |

The OpenAI adapter is simpler than Anthropic because OpenAI's Chat Completions API natively accepts `system` as a message role and returns a plain string. No block extraction needed.

### 4.2 Ollama Adapter

```typescript
// packages/core/src/llm/ollama.ts

import type { LlmProvider, LlmMessage, LlmOptions } from "./types";

export interface OllamaProviderConfig {
  baseUrl?: string;           // defaults to "http://localhost:11434"
  defaultModel?: string;      // defaults to "llama3.1"
  defaultMaxTokens?: number;  // defaults to 4096
  defaultTemperature?: number; // defaults to 0.2
}

interface OllamaChatResponse {
  message: { role: string; content: string };
  done: boolean;
}

export class OllamaProvider implements LlmProvider {
  private baseUrl: string;
  private defaults: Required<Omit<OllamaProviderConfig, "baseUrl">>;

  constructor(config: OllamaProviderConfig = {}) {
    this.baseUrl = (config.baseUrl ?? process.env.OLLAMA_HOST ?? "http://localhost:11434")
      .replace(/\/+$/, ""); // strip trailing slash
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

**Key design decisions for Ollama:**

1. **No SDK dependency.** Ollama's `/api/chat` endpoint is a single POST. Using `fetch` means Ollama users install zero additional packages. This is the right call because Ollama is often used in resource-constrained or air-gapped environments where minimizing dependencies matters.

2. **`stream: false`** in the request body. Ollama defaults to streaming, but our interface returns a complete string. Setting `stream: false` makes Ollama buffer the full response and return it as a single JSON object. This is critical -- without it, the response is a stream of newline-delimited JSON objects.

3. **`num_predict` maps to `maxTokens`.** Ollama uses `num_predict` instead of `max_tokens`. This is the only parameter name difference.

4. **`OLLAMA_HOST` env var.** Ollama's own CLI uses `OLLAMA_HOST` for the server URL. We respect this convention, falling back to `http://localhost:11434`.

5. **No API key.** Ollama is fully local. The constructor does not require or check for an API key. This is the primary value proposition -- users can run the entire Basesignal analysis pipeline without any external API calls.

6. **System messages work natively.** Ollama's `/api/chat` accepts `role: "system"` messages directly, just like OpenAI. No separation needed.

### 4.3 Factory Wiring

Update the existing `createProvider()` in `packages/core/src/llm/factory.ts`:

```typescript
// packages/core/src/llm/factory.ts (updated)

import type { LlmProvider } from "./types";

export type ProviderType = "anthropic" | "openai" | "ollama";

export interface ProviderConfig {
  provider: ProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export function createProvider(config: ProviderConfig): LlmProvider {
  switch (config.provider) {
    case "anthropic": {
      const { AnthropicProvider } = require("./anthropic");
      return new AnthropicProvider({
        apiKey: config.apiKey,
        defaultModel: config.model,
      });
    }
    case "openai": {
      const { OpenAIProvider } = require("./openai");
      return new OpenAIProvider({
        apiKey: config.apiKey,
        defaultModel: config.model,
      });
    }
    case "ollama": {
      const { OllamaProvider } = require("./ollama");
      return new OllamaProvider({
        baseUrl: config.baseUrl,
        defaultModel: config.model,
      });
    }
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

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
```

**Why `require()` instead of top-level `import`:** The `openai` and `@anthropic-ai/sdk` packages are optional peer dependencies. If a user chooses Ollama, they should not need either SDK installed. Using dynamic `require()` ensures the SDK is only loaded when the corresponding provider is selected. The factory is the only place where this dynamic resolution happens.

### 4.4 Optional Peer Dependencies

In `packages/core/package.json`:

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

Ollama has no npm dependency. This means:
- **Anthropic users:** `npm install @anthropic-ai/sdk`
- **OpenAI users:** `npm install openai`
- **Ollama users:** Install nothing extra. Just have Ollama running locally.

### 4.5 Updated Barrel Exports

```typescript
// packages/core/src/llm/index.ts (updated)

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

---

## 5. File Layout

After this story, the `packages/core/src/llm/` directory contains:

```
packages/core/src/llm/
  types.ts          -- LlmProvider, LlmMessage, LlmOptions (from S003)
  anthropic.ts      -- AnthropicProvider (from S003)
  openai.ts         -- OpenAIProvider (NEW)
  ollama.ts         -- OllamaProvider (NEW)
  factory.ts        -- createProvider(), createProviderFromEnv() (UPDATED)
  helpers.ts        -- callLlm() convenience wrapper (from S003)
  mock.ts           -- MockProvider for testing (from S003)
  parse.ts          -- extractJson() utility (from S003)
  index.ts          -- barrel export (UPDATED)
```

Two new files (`openai.ts`, `ollama.ts`), two updated files (`factory.ts`, `index.ts`).

---

## 6. API Differences Summary

How each provider maps to the `LlmProvider.complete()` contract:

| Concern | Anthropic | OpenAI | Ollama |
|---------|-----------|--------|--------|
| SDK | `@anthropic-ai/sdk` | `openai` | None (raw `fetch`) |
| System message | Extracted, passed as `system` param | Passed as `role: "system"` in messages | Passed as `role: "system"` in messages |
| API endpoint | `client.messages.create()` | `client.chat.completions.create()` | `POST /api/chat` |
| Max tokens param | `max_tokens` | `max_tokens` | `options.num_predict` |
| Response text | `response.content[].text` (filter type=text) | `response.choices[0].message.content` | `response.message.content` |
| Auth | API key (required) | API key (required) | None |
| Default model | `claude-sonnet-4-20250514` | `gpt-4o` | `llama3.1` |
| Streaming default | Non-streaming by default | Non-streaming by default | Streaming by default (`stream: false` needed) |

---

## 7. Model Recommendations

Models to support per provider, with guidance for users:

### OpenAI

| Model | Use Case | Notes |
|-------|----------|-------|
| `gpt-4o` | Best quality (default) | Recommended for production analysis |
| `gpt-4o-mini` | Cost-sensitive / high-volume | Good for iteration, slightly lower quality on complex extraction |

### Ollama

| Model | Use Case | Notes |
|-------|----------|-------|
| `llama3.1` | General purpose (default) | Best balance of quality and resource usage |
| `llama3.1:70b` | Higher quality | Requires significant RAM (~40GB) |
| `mistral` | Lighter alternative | Good for machines with limited resources |
| `mixtral` | Best local quality | Mixture-of-experts, higher resource needs |

**No model enforcement.** The adapters pass any model string through to the provider. Users can use any model their provider supports. The defaults and recommendations above are guidance, not restrictions.

---

## 8. Key Decisions

### D1: OpenAI SDK, Ollama raw fetch

OpenAI's SDK handles auth headers, request serialization, error typing, and response parsing. Using it saves ~30 lines and avoids reimplementing retry/error handling. Ollama's API is a single POST endpoint with a trivial response shape -- adding a dependency for this would be over-engineering.

### D2: No model alias mapping

There is no `"fast"` / `"best"` / `"cheap"` abstraction. Users pass real model names. This is explicit, grep-able, and does not hide behavior. If a model is deprecated, the user sees the error from the provider, not a confusing "fast model not found" from our translation layer.

### D3: Ollama defaults to llama3.1

`llama3.1` is Meta's most recent generally available model in the Llama 3 family that most Ollama installations will have. It is a reasonable default. Users with specific hardware or quality requirements override via `BASESIGNAL_LLM_MODEL`.

### D4: OLLAMA_HOST respected as fallback

Ollama's own CLI and server use `OLLAMA_HOST` to configure the server URL. Our adapter respects this convention (`BASESIGNAL_OLLAMA_URL` takes precedence if both are set). This means existing Ollama configurations work without additional Basesignal-specific env vars.

### D5: Fail-fast error messages

Each adapter produces clear, actionable errors:
- OpenAI: `"OpenAI API key required: pass apiKey in config or set OPENAI_API_KEY"`
- Ollama: `"Ollama request failed (404): model 'foo' not found"` (pass-through from Ollama server)
- Factory: `"Unknown provider: foo"` (if provider name is invalid)

### D6: No structured output / JSON mode

OpenAI supports `response_format: { type: "json_object" }` and Ollama supports a `format: "json"` parameter. We deliberately do not use these. The existing codebase extracts JSON from free-text responses using `extractJson()` (handling code fences and raw JSON). This approach works identically across all providers. Adding JSON mode would create provider-specific code paths for no clear benefit -- the LLM still needs to produce valid JSON either way, and `extractJson()` already handles the parsing robustly.

---

## 9. Testing Strategy

### 9.1 Unit Tests (mock-based, no API calls)

All unit tests use mocked responses. No real API calls in CI.

**OpenAIProvider tests:**

```typescript
// packages/core/src/llm/__tests__/openai.test.ts

import { describe, it, expect, vi } from "vitest";
import { OpenAIProvider } from "../openai";

// Mock the openai package
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: "mocked response" } }],
        }),
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
  });

  it("uses default model gpt-4o", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    await provider.complete([{ role: "user", content: "test" }]);
    // Verify via mock that model was "gpt-4o"
  });

  it("supports model selection via options", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    await provider.complete(
      [{ role: "user", content: "test" }],
      { model: "gpt-4o-mini" }
    );
    // Verify via mock that model was "gpt-4o-mini"
  });

  it("returns empty string when response content is null", async () => {
    // Mock returns null content
    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    // ... verify returns ""
  });
});
```

**OllamaProvider tests:**

```typescript
// packages/core/src/llm/__tests__/ollama.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OllamaProvider } from "../ollama";

describe("OllamaProvider", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not require an API key", () => {
    expect(() => new OllamaProvider()).not.toThrow();
  });

  it("defaults to localhost:11434", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { content: "hi" } }),
    });
    const provider = new OllamaProvider();
    await provider.complete([{ role: "user", content: "test" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.anything()
    );
  });

  it("uses configurable host", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { content: "hi" } }),
    });
    const provider = new OllamaProvider({ baseUrl: "http://gpu-server:11434" });
    await provider.complete([{ role: "user", content: "test" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://gpu-server:11434/api/chat",
      expect.anything()
    );
  });

  it("reads OLLAMA_HOST env var", async () => {
    process.env.OLLAMA_HOST = "http://remote:11434";
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { content: "hi" } }),
    });
    const provider = new OllamaProvider();
    await provider.complete([{ role: "user", content: "test" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://remote:11434/api/chat",
      expect.anything()
    );
    delete process.env.OLLAMA_HOST;
  });

  it("sets stream: false in request body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { content: "hi" } }),
    });
    const provider = new OllamaProvider();
    await provider.complete([{ role: "user", content: "test" }]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.stream).toBe(false);
  });

  it("maps maxTokens to num_predict", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { content: "hi" } }),
    });
    const provider = new OllamaProvider();
    await provider.complete(
      [{ role: "user", content: "test" }],
      { maxTokens: 2048 }
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.options.num_predict).toBe(2048);
  });

  it("throws descriptive error on HTTP failure", async () => {
    mockFetch.mockResolvedValue({
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

  it("defaults to llama3.1 model", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { content: "hi" } }),
    });
    const provider = new OllamaProvider();
    await provider.complete([{ role: "user", content: "test" }]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe("llama3.1");
  });

  it("works with common models (llama3.1, mistral, mixtral)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { content: "response" } }),
    });
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

**Factory tests (updated):**

```typescript
// packages/core/src/llm/__tests__/factory.test.ts (additions)

describe("createProvider", () => {
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
});

describe("createProviderFromEnv", () => {
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
```

### 9.2 Integration Tests (manual, not in CI)

These are manual smoke tests requiring real API access or a running Ollama instance:

```typescript
// packages/core/src/llm/__tests__/integration.test.ts
// Run with: OPENAI_API_KEY=sk-... npx vitest run integration.test.ts

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

### 9.3 Testing Philosophy

- **Unit tests mock at the boundary.** OpenAI tests mock the `openai` package. Ollama tests mock `fetch`. This verifies our code, not the provider's.
- **No golden output tests.** LLM outputs are non-deterministic. Tests verify the adapter correctly constructs requests and parses responses, not the content of completions.
- **MockProvider remains the primary test tool.** Code that consumes `LlmProvider` (the analysis pipeline) uses `MockProvider` with canned JSON responses. The adapter tests are separate.

---

## 10. What This Does NOT Do

- **Does not add streaming.** The interface is `complete() -> string`. Streaming is a different interaction model with different consumers. Add it when needed.
- **Does not add JSON mode.** Both OpenAI and Ollama support requesting JSON output. We do not use it because `extractJson()` already handles all response formats robustly. Adding JSON mode would create provider-divergent code paths.
- **Does not add retry logic.** Retries are infrastructure. A retry decorator can wrap any `LlmProvider` without changing the interface.
- **Does not add model validation.** We do not check if a model name is valid before calling the provider. The provider's error message is better than anything we could produce.
- **Does not add token counting or cost tracking.** These are higher-level concerns outside the provider scope.
- **Does not create `packages/core`.** That is M008-E001. This story adds files inside `packages/core/src/llm/` which must already exist from S003.

---

## 11. Verification Steps

From the story's acceptance criteria, mapped to implementation:

| Acceptance Criterion | Implementation | Test |
|---|---|---|
| OpenAIProvider implements LlmProvider using openai npm package | `OpenAIProvider` class in `openai.ts` | TypeScript compilation + unit tests |
| OpenAIProvider reads API key from OPENAI_API_KEY env var | Constructor fallback to `process.env.OPENAI_API_KEY` | Unit test |
| OpenAIProvider supports model selection (gpt-4o, gpt-4o-mini) | Model passed via `LlmOptions.model` or constructor default | Unit test |
| OllamaProvider implements LlmProvider using Ollama's HTTP API | `OllamaProvider` class in `ollama.ts` using `fetch` | Unit test with mocked fetch |
| OllamaProvider connects to configurable host (default localhost:11434) | Constructor accepts `baseUrl`, defaults to `localhost:11434` | Unit test |
| OllamaProvider works with common models (llama3, mistral, etc.) | Model passed through to `/api/chat` request body | Unit test |
| createProvider() factory handles all three providers based on config | Switch statement in `factory.ts` returns correct provider | Unit test |
| OpenAI and Ollama are optional peer dependencies (not required at install) | `peerDependenciesMeta` with `optional: true` in `package.json` | Package.json inspection |

---

## 12. Implementation Order

1. **Create `openai.ts`** -- OpenAIProvider class (~45 lines)
2. **Create `ollama.ts`** -- OllamaProvider class (~50 lines)
3. **Update `factory.ts`** -- Replace throw statements with real provider instantiation
4. **Update `index.ts`** -- Add new exports
5. **Update `package.json`** -- Add `openai` as optional peer dependency
6. **Write tests** -- Unit tests for both adapters + updated factory tests
7. **Verify** -- `npm test` passes, TypeScript compiles cleanly

Total new code: ~95 lines of implementation, ~200 lines of tests.
