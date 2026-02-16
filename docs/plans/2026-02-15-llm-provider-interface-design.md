# LLM Provider Interface and Anthropic Adapter

**Story:** M008-E004-S003
**Date:** 2026-02-15
**Status:** Design

---

## 1. Overview

This story introduces an `LlmProvider` interface that abstracts all LLM calls behind a single `complete(messages, options)` method, and implements an `AnthropicProvider` adapter that wraps `@anthropic-ai/sdk`. The interface is minimal enough that adding OpenAI or Ollama adapters (M008-E004-S004) requires implementing one method. A `createProvider()` factory function configures the right provider from environment variables.

---

## 2. Problem Statement

The codebase has **26+ direct Anthropic SDK call sites** spread across `convex/analysis/`, `convex/ai.ts`, `convex/extractEntities.ts`, and other files. Each call site independently:

- Instantiates `new Anthropic({ apiKey })` from `process.env.ANTHROPIC_API_KEY`
- Calls `client.messages.create()` with model, max_tokens, temperature, system, and messages
- Extracts text from the response via `.content.filter(b => b.type === "text").map(b => b.text).join("")`

This creates three problems:
1. **No swappability** -- switching to OpenAI or Ollama means touching 26+ files
2. **No testability** -- tests must mock the Anthropic SDK rather than injecting a simple interface
3. **Scattered configuration** -- model names, temperature defaults, and API key handling are duplicated everywhere

There is already a partial abstraction in `convex/analysis/lenses/shared.ts` via `callClaude()`, which is used by ~9 call sites. But 17+ call sites bypass it and use the SDK directly, especially those needing tool use (`convex/ai.ts`) or passing the client object directly (`convergeAndTier`, `clusterCandidatesLLM`).

---

## 3. Expert Perspectives

### Technical Architect

The right interface shape is the one the codebase already converged on: `system + messages -> text`. Every single call site follows this pattern. The only variation is `ai.ts` which uses tool-calling, but that is a fundamentally different interaction mode (agentic loop with tool execution) that should NOT be forced through the same interface.

**Key insight:** Do not try to abstract tool use. The interview chat in `ai.ts` is tightly coupled to Anthropic's tool-calling format (tool schemas, tool_use blocks, tool_result messages). Forcing this through a generic interface would create a leaky abstraction that satisfies nobody. Leave `ai.ts` as a direct SDK consumer for now -- it belongs to the web app, not the open-source analysis engine.

**Scope boundary:** This interface is for the `packages/core` extraction pipeline, not the Convex web app's interview system. The 17 call sites in `convex/analysis/` and `convex/extract*.ts` all follow the simple `system + user -> text` pattern. That is the interface.

### Simplification Reviewer

**Verdict: APPROVED with cuts.**

What to remove:
- **No streaming method.** Zero current call sites use streaming. Add it when someone needs it.
- **No structured output / JSON mode.** Every call site already handles JSON extraction in its own response parser (`extractJson`, `parseLensResponse`, `parseMergeResponse`, etc.). The LLM provider should return raw text. Parsing is the caller's responsibility.
- **No retry logic in the interface.** Retries are an infrastructure concern. If needed later, wrap the provider in a retry decorator -- don't bake it into the interface.
- **No tool-use method.** The only tool-use consumer (`ai.ts`) is a Convex action in the web app. It is out of scope for the open-source packages.
- **No `systemPrompt` in LlmOptions.** The system prompt is passed as the first message with role `system`, or as a separate parameter. Looking at all call sites, system is always explicit. Include it in the `complete()` call signature to match the existing `callClaude()` shape.

The interface should have exactly one method. One. If you need more, you don't understand the problem yet.

---

## 4. Proposed Solution

### 4.1 Interface Design

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

**Why this shape:**
- `messages` array with roles maps 1:1 to both Anthropic and OpenAI message formats
- Returns `string` -- every call site extracts text and then does its own parsing
- `LlmOptions` are all optional -- providers supply sensible defaults
- The system prompt is the first message with `role: "system"` (callers can also pass it as a separate convenience -- see the helper below)

### 4.2 Anthropic Adapter

```typescript
// packages/core/src/llm/anthropic.ts

import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, LlmMessage, LlmOptions } from "./types";

export interface AnthropicProviderConfig {
  apiKey?: string;  // defaults to ANTHROPIC_API_KEY env var
  defaultModel?: string;  // defaults to "claude-sonnet-4-20250514"
  defaultMaxTokens?: number;  // defaults to 4096
  defaultTemperature?: number;  // defaults to 0.2
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
    // Separate system message from conversation messages
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

**Key decisions in the adapter:**
- System messages are separated out and passed as Anthropic's `system` parameter (matching their API's design)
- Multiple system messages are concatenated (unlikely but handled gracefully)
- Constructor validates API key eagerly -- fail fast, not on first call
- All defaults match the existing `callClaude()` function in `shared.ts`

### 4.3 Factory Function

```typescript
// packages/core/src/llm/factory.ts

import type { LlmProvider } from "./types";

export type ProviderType = "anthropic" | "openai" | "ollama";

export interface ProviderConfig {
  provider: ProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;  // For Ollama (default: localhost:11434)
}

export function createProvider(config: ProviderConfig): LlmProvider {
  switch (config.provider) {
    case "anthropic": {
      // Dynamic import handled by the adapter file
      const { AnthropicProvider } = require("./anthropic");
      return new AnthropicProvider({
        apiKey: config.apiKey,
        defaultModel: config.model,
      });
    }
    case "openai":
      throw new Error(
        "OpenAI provider not yet implemented. Install @basesignal/provider-openai."
      );
    case "ollama":
      throw new Error(
        "Ollama provider not yet implemented. Install @basesignal/provider-ollama."
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
    ollama: undefined,  // no key needed
  };

  return createProvider({
    provider: providerName,
    apiKey: apiKeyMap[providerName],
    model: process.env.BASESIGNAL_LLM_MODEL,
    baseUrl: process.env.BASESIGNAL_OLLAMA_URL,
  });
}
```

### 4.4 Convenience Helper

To ease migration from the existing `callClaude()` pattern:

```typescript
// packages/core/src/llm/helpers.ts

import type { LlmProvider, LlmMessage, LlmOptions } from "./types";

/**
 * Convenience wrapper matching the existing callClaude() signature.
 * Makes migration easier: replace `callClaude({system, user})` with
 * `callLlm(provider, {system, user})`.
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

### 4.5 Mock Provider for Testing

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

  /** Reset call history and response index */
  reset(): void {
    this.calls = [];
    this.callIndex = 0;
  }
}
```

### 4.6 extractJson Utility

The `extractJson()` function from `shared.ts` is used by nearly every LLM consumer. It should live alongside the provider interface since all providers need it:

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

### 4.7 Package Location and Exports

```
packages/core/src/llm/
  types.ts          -- LlmProvider, LlmMessage, LlmOptions interfaces
  anthropic.ts      -- AnthropicProvider class
  factory.ts        -- createProvider(), createProviderFromEnv()
  helpers.ts        -- callLlm() convenience wrapper
  mock.ts           -- MockProvider for testing
  parse.ts          -- extractJson() utility
  index.ts          -- barrel export
```

Barrel export:
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

---

## 5. Key Decisions

### D1: Single method interface (complete only)
No streaming, no structured output, no tool use. The codebase has exactly one interaction pattern: messages in, text out. Every call site does its own response parsing. This covers 100% of the analysis pipeline's needs.

### D2: System message as role in messages array, separated in the adapter
Callers pass `{ role: "system", content: "..." }` in the messages array. The Anthropic adapter separates it into the `system` parameter. This is cleaner than a separate `systemPrompt` option because it maps naturally to OpenAI's format (where system is just another message). The `callLlm()` helper preserves the familiar `{ system, user }` signature for easy migration.

### D3: ai.ts (interview chat) is out of scope
The interview system in `convex/ai.ts` uses Anthropic tool-calling with an agentic loop. This is a fundamentally different interaction model. Abstracting it would require modeling tool schemas, tool_use blocks, and tool_result messages -- a massive surface area with exactly one consumer. It stays as a direct Anthropic SDK user in the Convex web app.

### D4: Provider owns its defaults, options override per-call
The `AnthropicProvider` constructor sets defaults (model, temperature, maxTokens). Individual calls can override via `LlmOptions`. This matches how the codebase works: most calls use defaults, some override temperature or model.

### D5: extractJson lives with the provider
Every LLM consumer needs to extract JSON from potentially code-fenced responses. This is a universal utility that belongs in the provider package, not scattered across consumers.

### D6: Factory function supports env-based auto-configuration
`createProviderFromEnv()` reads `BASESIGNAL_LLM_PROVIDER` and the appropriate API key. This supports the M008 goal of "configure via environment variable." OpenAI and Ollama throw clear errors until S004 implements them.

### D7: MockProvider records all calls
The mock captures every call's messages and options, enabling tests to assert on what was sent to the LLM. This replaces the need to mock the Anthropic SDK in tests.

---

## 6. What This Does NOT Do

- **Does not migrate existing call sites.** The 26+ Anthropic SDK usages in `convex/` stay as-is. Migration is a separate story. The interface must exist and be proven first.
- **Does not implement OpenAI or Ollama providers.** Those are M008-E004-S004. The factory throws clear errors for unimplemented providers.
- **Does not add streaming support.** No current call site uses streaming. If needed, add a `stream()` method to the interface later.
- **Does not add retry/backoff logic.** Retries are infrastructure. A retry decorator can wrap any `LlmProvider` without changing the interface.
- **Does not abstract tool use.** The interview chat (`ai.ts`) stays as a direct Anthropic SDK consumer.
- **Does not add rate limiting or cost tracking.** These are higher-level concerns that can wrap the provider.
- **Does not create the `packages/core` directory structure.** That is M008-E001 (core package extraction). This story defines the LLM module that will live inside it. During implementation, files should be placed in `packages/core/src/llm/` if E001 has landed, or in a temporary location otherwise.

---

## 7. Verification Steps

### Unit Tests

1. **LlmProvider interface conformance:**
   - AnthropicProvider implements LlmProvider (TypeScript compilation check)
   - MockProvider implements LlmProvider (TypeScript compilation check)

2. **AnthropicProvider construction:**
   - Throws if no API key provided and ANTHROPIC_API_KEY unset
   - Reads API key from config parameter
   - Reads API key from ANTHROPIC_API_KEY env var
   - Uses default model "claude-sonnet-4-20250514"
   - Allows model override via config

3. **AnthropicProvider.complete():**
   - Separates system messages and passes as `system` parameter (mock SDK)
   - Passes user/assistant messages as `messages` parameter
   - Applies default temperature (0.2) when not specified
   - Applies option overrides (model, temperature, maxTokens)
   - Extracts text from response content blocks

4. **MockProvider:**
   - Returns canned response for single-response case
   - Cycles through multiple responses
   - Records all calls with messages and options
   - Reset clears call history

5. **createProvider():**
   - Returns AnthropicProvider for `{ provider: "anthropic" }`
   - Throws for "openai" and "ollama" (not yet implemented)
   - Throws for unknown provider names

6. **createProviderFromEnv():**
   - Defaults to "anthropic" when BASESIGNAL_LLM_PROVIDER unset
   - Reads provider from BASESIGNAL_LLM_PROVIDER
   - Reads model override from BASESIGNAL_LLM_MODEL

7. **callLlm() helper:**
   - Constructs messages array from system + user
   - Passes through model, temperature, maxTokens
   - Returns provider's response

8. **extractJson():**
   - Parses raw JSON
   - Extracts JSON from ```json code fences
   - Extracts JSON from ``` code fences (no language tag)
   - Throws on invalid JSON

### Integration Smoke Test
- Create an AnthropicProvider with a real API key
- Call `complete()` with a simple prompt
- Verify a non-empty string response

---

## 8. Success Criteria

From the story's acceptance criteria, mapped to implementation:

| Acceptance Criterion | Implementation |
|---|---|
| LlmProvider exports: complete(prompt, options) -> string | `LlmProvider` interface in `types.ts` with `complete(messages, options)` |
| LlmOptions includes: model, temperature, maxTokens, systemPrompt | `LlmOptions` in `types.ts` (model, temperature, maxTokens). System prompt is a message with role "system" rather than an option. |
| AnthropicProvider implements LlmProvider using @anthropic-ai/sdk | `AnthropicProvider` class in `anthropic.ts` |
| AnthropicProvider reads API key from ANTHROPIC_API_KEY env var | Constructor fallback to `process.env.ANTHROPIC_API_KEY` |
| AnthropicProvider supports model selection (claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001) | Model passed via `LlmOptions.model` or constructor default |
| createProvider(config) factory creates the right provider | `createProvider()` in `factory.ts` |
| Tests use a mock provider that returns canned responses | `MockProvider` in `mock.ts` |

---

## Appendix: Current LLM Usage Inventory

All Anthropic SDK usages in the codebase, categorized by pattern:

### Pattern A: Uses `callClaude()` from shared.ts (9 sites)
These are the easiest to migrate -- replace `callClaude()` with `callLlm(provider, ...)`.

- `convex/analysis/lenses/extractStateTransitions.ts`
- `convex/analysis/lenses/extractInfoAsymmetry.ts`
- `convex/analysis/lenses/extractDecisionEnablement.ts`
- `convex/analysis/lenses/extractArtifactCreation.ts`
- `convex/analysis/lenses/extractCapabilityMapping.ts`
- `convex/analysis/lenses/extractTimeCompression.ts`
- `convex/analysis/lenses/extractEffortElimination.ts`
- `convex/analysis/outputs/generateICPProfiles.ts`
- `convex/analysis/outputs/generateMeasurementSpec.ts`
- `convex/analysis/outputs/generateActivationMap.ts`

### Pattern B: Direct SDK, simple complete (10 sites)
These instantiate `new Anthropic()` and call `client.messages.create()` for a single prompt-response.

- `convex/analysis/extractIdentity.ts`
- `convex/analysis/extractJourney.ts` (2 calls)
- `convex/analysis/extractActivationLevels.ts`
- `convex/extractEntities.ts`
- `convex/extractOutcomes.ts`
- `convex/extractRevenue.ts`
- `convex/analysis/orchestrate.ts`

### Pattern C: Direct SDK, passed as client object (3 sites)
These receive an Anthropic client and call `client.messages.create()` multiple times.

- `convex/analysis/convergence/clusterCandidatesLLM()` -- takes `client: Anthropic`
- `convex/analysis/convergence/convergeAndTier()` -- takes `client: Anthropic`
- `convex/analysis/convergence/validateCandidates.ts` -- `applyLlmReview()`

### Pattern D: Tool-calling agentic loop (1 site, OUT OF SCOPE)
- `convex/ai.ts` -- interview chat with tools
