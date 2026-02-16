# Implementation Plan: LLM Provider Interface and Anthropic Adapter

**Task:** basesignal-1hm (M008-E004-S003)
**Design:** docs/plans/2026-02-15-llm-provider-interface-design.md
**Dependency:** basesignal-441 (M008-E001-S001: Monorepo workspace setup) must land first

## Context

The codebase has 26+ direct Anthropic SDK call sites, each independently instantiating `new Anthropic({ apiKey })`, calling `client.messages.create()`, and extracting text from response blocks. This story introduces an `LlmProvider` interface with a single `complete()` method and an `AnthropicProvider` adapter, enabling future provider swapping (OpenAI, Ollama) and simplified testing via `MockProvider`.

This story does NOT migrate any existing call sites. It creates the abstraction and proves it with tests. Migration is a separate concern.

## Prerequisite

The `packages/core/` directory with build tooling (tsup, vitest, tsconfig) must exist from M008-E001-S001. All files in this plan go under `packages/core/src/llm/`. If E001 has not landed yet, this task is blocked.

## Approach

Create 7 files in `packages/core/src/llm/` plus a test file. The interface is intentionally minimal: one method (`complete`), one adapter (`AnthropicProvider`), one factory (`createProvider`), one convenience helper (`callLlm`), one mock (`MockProvider`), and one shared utility (`extractJson`). A barrel export re-exports everything.

## Implementation Steps

### Step 1: Create `packages/core/src/llm/types.ts` -- Interface definitions

This is the core abstraction. No dependencies, pure types.

```typescript
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
```

**Why this shape:** Every call site in the codebase follows `system + messages -> text`. The interface returns `string` because all consumers do their own response parsing (JSON extraction, lens parsing, etc.). System prompt is passed as a message with `role: "system"` rather than a separate option -- this maps naturally to both Anthropic and OpenAI formats.

### Step 2: Create `packages/core/src/llm/parse.ts` -- extractJson utility

Extracted from `convex/analysis/lenses/shared.ts` (lines 46-50). Identical logic, new home.

```typescript
// packages/core/src/llm/parse.ts

/**
 * Extract JSON from text that may contain markdown code fences or raw JSON.
 * Used by all LLM response parsers.
 */
export function extractJson(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}
```

### Step 3: Create `packages/core/src/llm/anthropic.ts` -- Anthropic adapter

This implements `LlmProvider` by wrapping `@anthropic-ai/sdk`. The adapter separates system messages from conversation messages since Anthropic's API takes `system` as a top-level parameter.

`@anthropic-ai/sdk` must be added as a dependency of `packages/core/package.json`.

```typescript
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
```

**Key decisions:**
- Constructor validates API key eagerly (fail fast, not on first call)
- Defaults match existing `callClaude()` in `convex/analysis/lenses/shared.ts`: model `claude-sonnet-4-20250514`, maxTokens 4096, temperature 0.2
- Multiple system messages concatenated (unlikely but handled gracefully)

### Step 4: Create `packages/core/src/llm/mock.ts` -- Mock provider for testing

```typescript
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
```

### Step 5: Create `packages/core/src/llm/helpers.ts` -- Convenience wrapper

Matches the existing `callClaude({ system, user })` call signature for easy future migration.

```typescript
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

  return provider.complete(messages, {
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });
}
```

### Step 6: Create `packages/core/src/llm/factory.ts` -- Provider factory

```typescript
// packages/core/src/llm/factory.ts

import type { LlmProvider } from "./types";
import { AnthropicProvider } from "./anthropic";

export type ProviderType = "anthropic" | "openai" | "ollama";

export interface ProviderConfig {
  provider: ProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export function createProvider(config: ProviderConfig): LlmProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider({
        apiKey: config.apiKey,
        defaultModel: config.model,
      });
    case "openai":
      throw new Error(
        "OpenAI provider not yet implemented. See M008-E004-S004."
      );
    case "ollama":
      throw new Error(
        "Ollama provider not yet implemented. See M008-E004-S004."
      );
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Create a provider from environment variables.
 *
 * Reads:
 * - BASESIGNAL_LLM_PROVIDER (default: "anthropic")
 * - ANTHROPIC_API_KEY / OPENAI_API_KEY (depending on provider)
 * - BASESIGNAL_LLM_MODEL (optional, overrides provider default)
 */
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
    baseUrl: process.env.BASESIGNAL_OLLAMA_URL,
  });
}
```

**Note:** The design doc uses `require()` for dynamic import in the factory. Since `packages/core` targets ESM and the AnthropicProvider is always bundled, use a direct static import instead. This avoids CJS/ESM interop issues.

### Step 7: Create `packages/core/src/llm/index.ts` -- Barrel export

```typescript
// packages/core/src/llm/index.ts

export type { LlmProvider, LlmMessage, LlmOptions } from "./types";
export { AnthropicProvider } from "./anthropic";
export type { AnthropicProviderConfig } from "./anthropic";
export { createProvider, createProviderFromEnv } from "./factory";
export type { ProviderConfig, ProviderType } from "./factory";
export { callLlm } from "./helpers";
export { MockProvider } from "./mock";
export type { MockCall } from "./mock";
export { extractJson } from "./parse";
```

### Step 8: Wire into `packages/core/src/index.ts`

Add a re-export from the core package barrel. Assuming E001 created this file as an empty barrel:

```typescript
// Add to packages/core/src/index.ts
export * from "./llm";
```

### Step 9: Add `@anthropic-ai/sdk` as dependency

Add to `packages/core/package.json`:

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.71.2"
  }
}
```

Then run `npm install` from root to resolve workspace dependencies.

## Test Plan

Create `packages/core/src/llm/llm.test.ts` with the following test groups. All tests are pure unit tests; no real API calls.

### extractJson tests (4 tests)

1. **Parses raw JSON object**: `'{"key":"value"}'` returns `{ key: "value" }`
2. **Extracts from ```json fences**: `` ```json\n{"k":"v"}\n``` `` returns parsed object
3. **Extracts from bare ``` fences**: `` ```\n[1,2,3]\n``` `` returns `[1,2,3]`
4. **Throws on invalid JSON**: `"not json"` throws `SyntaxError`

### MockProvider tests (5 tests)

5. **Returns single canned response**: `new MockProvider("hello")` returns `"hello"` on `complete()`
6. **Cycles through multiple responses**: `new MockProvider(["a","b"])` returns `"a"` then `"b"` then wraps to `"a"`
7. **Records all calls**: After two calls, `mock.calls.length === 2` and messages/options are captured
8. **Reset clears state**: After `reset()`, `calls` is empty and callIndex resets to 0
9. **MockProvider satisfies LlmProvider type**: TypeScript compilation check (assigning `MockProvider` to `LlmProvider` variable)

### callLlm helper tests (3 tests)

10. **Constructs messages from system + user**: Mock records `[{role:"system",...}, {role:"user",...}]`
11. **Passes through model, temperature, maxTokens**: Options appear in `mock.calls[0].options`
12. **Returns provider response**: Result matches mock's canned response

### AnthropicProvider construction tests (3 tests)

These test constructor behavior. Mock the Anthropic SDK module to avoid real API key requirements.

13. **Throws if no API key and env unset**: Constructor throws with clear error message
14. **Reads API key from config**: `new AnthropicProvider({ apiKey: "sk-test" })` succeeds
15. **Reads API key from ANTHROPIC_API_KEY env var**: Set env, construct, no throw

### AnthropicProvider.complete() tests (4 tests)

Mock `@anthropic-ai/sdk` to intercept `client.messages.create()`:

16. **Separates system message into system parameter**: System message not in `messages` array, appears as `system` string
17. **Applies default temperature 0.2**: No options passed, temperature in SDK call is 0.2
18. **Applies option overrides**: `options: { model: "custom", temperature: 0.5 }` passed through
19. **Extracts text from content blocks**: Mock response with `[{type:"text", text:"hello"}, {type:"text", text:" world"}]` returns `"hello world"`

### createProvider tests (4 tests)

20. **Returns AnthropicProvider for "anthropic"**: `createProvider({ provider: "anthropic", apiKey: "sk-test" })` returns instance
21. **Throws for "openai"**: Error message mentions M008-E004-S004
22. **Throws for "ollama"**: Error message mentions M008-E004-S004
23. **Throws for unknown provider**: `createProvider({ provider: "gemini" as any })` throws

### createProviderFromEnv tests (2 tests)

24. **Defaults to "anthropic"**: With `ANTHROPIC_API_KEY` set and `BASESIGNAL_LLM_PROVIDER` unset, creates AnthropicProvider
25. **Reads model from BASESIGNAL_LLM_MODEL**: Set env var, verify it is used as model override

### Mocking strategy for Anthropic SDK

Use `vi.mock("@anthropic-ai/sdk")` at the top of the test file. The mock should:
- Return a class whose constructor stores the config
- Expose `messages.create()` as a vi.fn that returns a canned response shape:
  ```typescript
  {
    content: [{ type: "text", text: "mocked response" }],
    // ... other fields Anthropic SDK returns
  }
  ```

This avoids any real network calls while testing the adapter's message separation and response extraction logic.

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/llm/types.ts` | New -- LlmProvider, LlmMessage, LlmOptions interfaces |
| `packages/core/src/llm/parse.ts` | New -- extractJson utility (extracted from shared.ts) |
| `packages/core/src/llm/anthropic.ts` | New -- AnthropicProvider class |
| `packages/core/src/llm/mock.ts` | New -- MockProvider class |
| `packages/core/src/llm/helpers.ts` | New -- callLlm convenience wrapper |
| `packages/core/src/llm/factory.ts` | New -- createProvider, createProviderFromEnv |
| `packages/core/src/llm/index.ts` | New -- barrel export |
| `packages/core/src/llm/llm.test.ts` | New -- 25 unit tests |
| `packages/core/src/index.ts` | Modified -- add `export * from "./llm"` |
| `packages/core/package.json` | Modified -- add `@anthropic-ai/sdk` dependency |

## Risks

1. **Dependency on E001 not landed.** If `packages/core/` does not exist yet, this task is blocked. The Beads dependency (`basesignal-441`) tracks this.
2. **Anthropic SDK version drift.** The `TextBlock` type filter pattern (`b.type === "text"`) and response shape may change in future SDK versions. Pinned to `^0.71.2` to match root.
3. **Environment variable collision.** `BASESIGNAL_LLM_PROVIDER` and `BASESIGNAL_LLM_MODEL` are new env vars. They default sensibly (anthropic, provider default model), so no existing workflows break.

## Order of Implementation

1. Create `types.ts` (pure types, no deps)
2. Create `parse.ts` (pure function, no deps)
3. Create `mock.ts` (depends on types)
4. Create `helpers.ts` (depends on types)
5. Create `anthropic.ts` (depends on types + SDK)
6. Create `factory.ts` (depends on types + anthropic)
7. Create `index.ts` (barrel, depends on all above)
8. Update `packages/core/src/index.ts` (re-export)
9. Update `packages/core/package.json` (add SDK dep)
10. Run `npm install`
11. Write `llm.test.ts` (tests all modules)
12. Run `npx vitest run` in `packages/core` to verify all 25 tests pass
13. Run `npm test` from root to verify no regressions in existing tests
