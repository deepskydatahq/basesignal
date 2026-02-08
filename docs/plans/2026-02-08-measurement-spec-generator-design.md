# Measurement Spec Generator Design

## Overview

An LLM-powered internalAction that generates a measurement specification with trackable events from aggregated product data (value moments, activation levels, ICP profiles, activation map). Each event has a standardized entity_action name, properties, trigger conditions, and mapping to value moments or activation levels.

## Problem Statement

After the analysis pipeline identifies value moments and activation levels, product teams need a concrete measurement spec — a list of trackable events they can implement. This generator bridges the gap between abstract value discovery and actionable instrumentation.

## Expert Perspectives

### Product
- Every event must trace back to a value moment or activation level, including retention and expansion events. Retention events are evidence that users found value; expansion events show growing engagement. Without this traceability, you lose the connection between actions and outcomes, which defeats the P&L framework.

### Technical
- Follow the hybrid pattern: internalAction orchestrates (takes productId, fetches data, calls Claude), with complex logic extracted into pure functions (`buildMeasurementSpecPrompt` and `parseMeasurementSpecResponse`) that are independently testable. Skip pre-aggregated input patterns — the internalAction is a single cohesive unit of work.

### Simplification Review
- Remove circular `total_events` validation — just compute from `events.length`
- Don't silently default `confidence` — require it in the prompt, fail if missing
- Use default maxTokens (4096) — only increase if tests hit the limit
- Bias toward prompt as source of truth; keep parser lean (deserialize + basic shape checks)
- Test prompt-output contract in integration tests, not duplicated unit tests

## Proposed Solution

### Architecture

```
generateMeasurementSpec (internalAction)
  ├── fetches MeasurementInputData (calls aggregateMeasurementInputs)
  ├── buildMeasurementSpecPrompt (pure function) → { system, user }
  ├── callClaude (from shared.ts, Sonnet, temp 0.2)
  └── parseMeasurementSpecResponse (pure function) → MeasurementSpec
```

### File: `convex/analysis/outputs/generateMeasurementSpec.ts`

**Dependencies:**
- Types from `convex/analysis/outputs/types.ts`
- Input from `convex/analysis/outputs/aggregateMeasurementInputs.ts` (S001)
- `callClaude`, `extractJson` from `convex/analysis/lenses/shared.ts`

### Pure Function 1: `buildMeasurementSpecPrompt`

```typescript
export function buildMeasurementSpecPrompt(input: MeasurementInputData): {
  system: string;
  user: string;
}
```

**System prompt** (exported constant `MEASUREMENT_SPEC_SYSTEM_PROMPT`):
- Entity_action naming rules with regex: `/^[a-z][a-z0-9]*_[a-z][a-z0-9_]*$/`
- Category definitions: activation, value, retention, expansion
- maps_to requirement: every event MUST map to a value moment, activation level, or both
- Property requirements: at least 2 per event
- Target: 15-25 events covering all activation level criteria and key value moments
- Output format: JSON matching MeasurementSpec schema
- Must include `confidence` field (no silent defaults)

**User prompt** formats `MeasurementInputData` into sections:
1. Activation event templates (level, criteria, suggested name)
2. Value moment event templates (tier, moment name/id, surfaces, suggested name)
3. ICP profiles summary (when present)
4. Activation map stages (when present)
5. Value moments reference (full list with tiers and surfaces)
6. Activation levels reference (with criteria)

### Pure Function 2: `parseMeasurementSpecResponse`

```typescript
export function parseMeasurementSpecResponse(responseText: string): MeasurementSpec
```

Lean validation approach (prompt is source of truth):
1. Extract JSON via `extractJson()`
2. Validate top-level shape: `events` array, `coverage` object, `confidence` number
3. Compute `total_events` from `events.length` (ignore LLM value)
4. Validate each event has required fields with correct types
5. Validate entity_action name regex
6. Validate maps_to has required fields based on type
7. Throw descriptive errors with event index on failure

### InternalAction: `generateMeasurementSpec`

```typescript
export const generateMeasurementSpec = internalAction({
  args: { productId: v.id("products") },
  handler: async (ctx, args): Promise<MeasurementSpec> => {
    const inputData = await ctx.runAction(
      internal.analysis.outputs.aggregateMeasurementInputs.aggregateMeasurementInputs,
      { productId: args.productId }
    );
    const { system, user } = buildMeasurementSpecPrompt(inputData);
    const responseText = await callClaude({ system, user, temperature: 0.2 });
    return parseMeasurementSpecResponse(responseText);
  },
});
```

### Test Plan

**File: `convex/analysis/outputs/generateMeasurementSpec.test.ts`**

Test the pure functions, not the internalAction:

1. **System prompt content** — contains naming rules, categories, maps_to requirement, property count, target range
2. **buildMeasurementSpecPrompt** — includes templates, handles empty ICP profiles, includes references
3. **parseMeasurementSpecResponse** — happy path parsing, entity_action regex (accepts `issue_created`, rejects `issueCreated`), maps_to conditional fields, error messages with event index
4. **Fixture-based integration test** — Linear mock response with 15-25 events validates the full prompt-output contract

## Alternatives Considered

- **Pre-aggregated input pattern**: Rejected — adds indirection, breaks the mental model of internalAction as cohesive unit
- **Strict parser with redundant validation**: Simplified per review — prompt is source of truth, parser deserializes + basic checks
- **8192 maxTokens**: Deferred — start with default 4096, increase only if needed

## Success Criteria

1. generateMeasurementSpec accepts productId, returns MeasurementSpec
2. Prompt includes event templates from aggregated inputs
3. Events use entity_action naming format (validated by parser)
4. Each event has 2+ properties, valid category, valid maps_to
5. Linear fixture test produces 15-25 events covering key moments
