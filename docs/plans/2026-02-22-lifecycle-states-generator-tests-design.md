# Lifecycle States Generator Tests Design

## Overview
Self-contained test file for the lifecycle states generator module, covering prompt builder, response parser, and generator function using a mock LLM. Follows the established pattern from `measurement-spec.test.ts` and `activation-map.test.ts`.

## Problem Statement
The lifecycle states generator (M010-E002) needs tests covering all three functions: `buildLifecycleStatesPrompt`, `parseLifecycleStatesResponse`, and `generateLifecycleStates`. Tests must verify prompt content, parser correctness, and end-to-end generator behavior.

## Expert Perspectives

### Product
- Test file validates the three-function pipeline (prompt builder, parser, generator) that corresponds to upstream stories S001, S002, S003
- Fixtures model a B2B SaaS project management tool — realistic enough for prompt assertions without being overly complex

### Technical
- Prompt builder uses individual params `(identity, valueMoments, activationLevels, activationMap)` per S001 design and activation-map.ts pattern
- Generator uses wrapper object `generateLifecycleStates(inputData, llm)` per S003 design — S003 destructures internally before calling prompt builder
- Reconciliation between S001 individual params and S003 wrapper is handled inside the generator implementation, not in tests
- Self-contained inline fixtures — each generator owns its test fixtures until pipeline integration
- Mock LLM inline as `{ complete: async () => JSON.stringify(VALID_LIFECYCLE_RESPONSE) } as LlmProvider`
- Combine generator assertions (valid result + 7+ states + transitions) into one test — one mock LLM call = one concept

### Simplification Review
- Reviewer suggested removing generator test entirely (belongs in pipeline integration) — overruled because acceptance criteria explicitly require "generator with mock LLM returns valid result" and "result has 7+ states with transitions"
- Removed extra "activation level names" prompt test — not in acceptance criteria
- Removed extra "missing required fields" parser test — Zod handles both invalid JSON and missing fields via same throw path
- Combined generator assertions into single test — one mock LLM call = one concept
- Inline mock LLM directly in test calls instead of pre-defining a variable
- Verdict: APPROVED after overruling one cut — 5 tests covering 6 acceptance criteria

## Proposed Solution

Single test file at `packages/mcp-server/src/analysis/__tests__/outputs/lifecycle-states.test.ts` with:

1. **Inline fixtures**: sampleIdentity, sampleActivationLevels, sampleValueMoments, sampleActivationMap, VALID_LIFECYCLE_RESPONSE (7-state JSON)
2. **Three describe blocks** covering 6 acceptance criteria in 5 tests
3. **Inline mock LLM** passed directly in generator test call

### Test Structure

#### `describe('buildLifecycleStatesPrompt')` — 2 tests
- Prompt includes product name and business model
- Prompt includes value moment names and activation levels

#### `describe('parseLifecycleStatesResponse')` — 2 tests
- Parses valid 7-state JSON
- Throws on invalid JSON

#### `describe('generateLifecycleStates')` — 1 test
- Returns valid result with 7+ states and transitions (combines criteria 5+6)

### Key Decisions
- File location: `__tests__/outputs/lifecycle-states.test.ts` (matching codebase convention, NOT `__tests__/lifecycle-states.test.ts`)
- Import path: `../../outputs/lifecycle-states.js`
- Prompt builder uses individual params: `buildLifecycleStatesPrompt(identity, valueMoments, activationLevels, activationMap)` — matches S001 design and activation-map.ts pattern
- Generator uses wrapper object: `generateLifecycleStates(inputData, llm)` — matches S003 design
- S003 implementation destructures wrapper internally before calling individual-params prompt builder
- Self-contained inline fixtures, no shared mock-llm dependencies
- Mock LLM inlined in test call: `{ complete: async () => JSON.stringify(VALID_LIFECYCLE_RESPONSE) } as LlmProvider`
- 7-state fixture: new, activated, engaged, at_risk, dormant, churned, resurrected
- Parser uses Zod validation — tests assert `.toThrow()` without matching specific error messages

### Fixture Details

**VALID_LIFECYCLE_RESPONSE** — 7 states with:
- entry_criteria (StateCriterion[]), exit_triggers (string[]), time_window (optional)
- 7 transitions between states
- confidence: 0.75, sources: ["activation_levels", "activation_map", "value_moments"]

**sampleIdentity** — B2B SaaS project management tool "ProjectBoard"
**sampleActivationLevels** — 2 levels (explorer, builder)
**sampleValueMoments** — 1 moment ("Sprint planning")
**sampleActivationMap** — 2 stages with transitions

### Imports
```typescript
import { describe, it, expect } from "vitest";
import {
  buildLifecycleStatesPrompt,
  parseLifecycleStatesResponse,
  generateLifecycleStates,
} from "../../outputs/lifecycle-states.js";
import type { ActivationLevel } from "@basesignal/core";
import type { LlmProvider, ValueMoment, IdentityResult } from "../../types.js";
import type { ActivationMapResult } from "../../outputs/activation-map.js";
```

## Alternatives Considered
- **Shared mock-llm infrastructure** (like pipeline.test.ts): Rejected — creates false dependency, belongs in M010-E003 pipeline integration story
- **Snapshot tests**: Rejected — brittle against upstream schema changes
- **System prompt content tests**: Rejected — testing a constant has low value
- **Pre-defined mockLlm variable**: Rejected — inline in test calls matches reference patterns and is simpler
- **Extra parser edge case tests**: Rejected — Zod handles both invalid JSON and missing fields via the same throw path
- **3 separate prompt tests**: Rejected — activation level names test not in acceptance criteria; 2 tests cover all prompt criteria
- **2 separate generator tests**: Rejected — one mock LLM call = one concept per technical architect
- **Removing generator test entirely**: Rejected — acceptance criteria explicitly require generator testing with mock LLM

## Success Criteria
- All 6 acceptance criteria covered by 5 tests
- Tests follow established patterns from sibling test files
- No shared fixture dependencies introduced prematurely
- `npm test` passes when upstream stories (S001-S003) are implemented
