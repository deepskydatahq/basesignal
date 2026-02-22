# Lifecycle States Generator Function Design

## Overview

Add a `generateLifecycleStates` async function to `lifecycle-states.ts` that orchestrates the prompt-build → LLM-call → parse pipeline. This is the third piece of the generator file — S001 adds prompts, S002 adds the parser, this S003 wires them together.

## Problem Statement

The lifecycle states analysis needs an orchestrator function that ties together the system prompt, prompt builder, LLM call, and response parser into a single callable generator — following the same pattern as the existing ICP profiles, activation map, and measurement spec generators.

## Expert Perspectives

### Technical

- Follow the exact existing generator pattern from `icp-profiles.ts`, `activation-map.ts`, and `measurement-spec.ts`.
- Add an explicit empty-response guard (`if (!responseText?.trim()) throw ...`) before the parser. The AC explicitly requires "throws on empty LLM response" as a distinct behavior from Zod validation failure. This gives a clear error message vs a cryptic downstream failure. The existing generators don't do this, but that's accidental — this is a legitimate improvement.
- Use temperature 0.2 (structured state machine output, consistent with activation-map and measurement-spec).
- Let Zod errors propagate naturally from the parser.

### Simplification Review

- Reviewer suggested removing the empty-response guard for consistency with existing generators. Overruled because it's an explicit acceptance criterion and only 2 lines.
- Everything else approved as minimal — the function is ~15 lines, defines one local interface, and follows established patterns exactly.

## Proposed Solution

```typescript
export interface LifecycleStatesInputData {
  identity: IdentityResult;
  value_moments: ValueMoment[];
  activation_levels: ActivationLevel[];
  activation_map: ActivationMapResult;
}

export async function generateLifecycleStates(
  inputData: LifecycleStatesInputData,
  llm: LlmProvider,
): Promise<LifecycleStatesResult> {
  const prompt = buildLifecycleStatesPrompt(inputData);

  const responseText = await llm.complete(
    [
      { role: "system", content: LIFECYCLE_STATES_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    { temperature: 0.2 },
  );

  if (!responseText?.trim()) {
    throw new Error("LLM returned empty response for lifecycle states generation");
  }

  return parseLifecycleStatesResponse(responseText);
}
```

## Design Details

### Input Interface

`LifecycleStatesInputData` with four fields:
- `identity: IdentityResult` — Product context for time window calibration
- `value_moments: ValueMoment[]` — Evidence for engagement signals
- `activation_levels: ActivationLevel[]` — Activation criteria for state alignment
- `activation_map: ActivationMapResult` — For "activated" state alignment

Defined locally in the file, mirroring how `MeasurementInputData` is defined in `measurement-spec.ts`.

### Generator Function

1. Calls `buildLifecycleStatesPrompt(inputData)` — from S001
2. Calls `llm.complete()` with system prompt (from S001) and user prompt
3. Guards against empty response with descriptive error
4. Passes to `parseLifecycleStatesResponse()` — from S002, validates via Zod
5. Returns `Promise<LifecycleStatesResult>`

### Imports

- Same-file: `LIFECYCLE_STATES_SYSTEM_PROMPT`, `buildLifecycleStatesPrompt`, `parseLifecycleStatesResponse`
- `@basesignal/core`: `LifecycleStatesResult`, `ActivationLevel`
- `../types.js`: `LlmProvider`, `ValueMoment`, `IdentityResult`
- `./activation-map.js`: `ActivationMapResult`

### Temperature

0.2 — structured analytical output, consistent with activation-map and measurement-spec.

## Alternatives Considered

1. **No empty-response guard** (follow existing pattern exactly) — Rejected because the AC explicitly requires distinct error behavior for empty responses vs Zod failures.
2. **Higher temperature (0.3)** — Rejected; lifecycle states are a structured state machine, not creative generation.

## Success Criteria

- Exported `generateLifecycleStates` function compiles and follows existing generator patterns
- Empty LLM response throws descriptive error before parser
- Invalid LLM response throws ZodError from parser
- Valid LLM response returns typed `LifecycleStatesResult`
