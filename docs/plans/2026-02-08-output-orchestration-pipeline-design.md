# Output Orchestration Pipeline Design

## Overview

Orchestrate all three output generators (ICP Profiles, Activation Map, Measurement Spec) into a single sequential pipeline that returns a complete `OutputGenerationResult` with partial result support for error resilience.

## Problem Statement

M004 produces three actionable outputs from analysis data. Each generator runs independently, but the measurement spec conceptually benefits from having ICP and activation map data available. Users need a single entry point to generate all outputs, with graceful handling when individual generators fail.

## Expert Perspectives

### Technical
- **Strict sequential over parallel**: The acceptance criteria explicitly numbers the order (first, second, third), and sequential is simpler to reason about, test, and debug than parallel-with-dependencies.
- **Error isolation via try/catch per step**: Each generator wrapped independently. Failed steps produce null/empty results rather than blocking downstream generators. This matches the existing pattern from `convex/analysis/lenses/orchestrate.ts`.
- **Follow established orchestration patterns**: The codebase has two orchestrators already. This one follows the same mental model but uses strict sequential instead of batched parallel (because there are only 3 steps with a dependency chain).

### Simplification Review
- Reviewer suggested removing `testGenerateAllOutputs`, but AC #6 explicitly requires it. **Kept, but simplified** — removed verbose console.log statements to make it a thin passthrough.
- No retry logic, no DB storage (generators handle their own), no progress tracking — all correctly excluded per YAGNI.

## Proposed Solution

### File: `convex/analysis/outputs/orchestrate.ts`

**Sequential pipeline with error isolation:**

```
productId
  │
  ├─ Step 1: generateICPProfiles → ICPProfile[] | []
  │
  ├─ Step 2: generateActivationMap → ActivationMap | null
  │
  └─ Step 3: generateMeasurementSpec → MeasurementSpec | null
  │
  └─ Return: OutputGenerationResult
```

### Exported API

1. **`GENERATION_STEPS`** — `["icp", "activation_map", "measurement_spec"] as const` — exported for testing step order
2. **`GenerationStep`** — type derived from the const array
3. **`generateAllOutputs`** — `internalAction` accepting `productId`, returns `OutputGenerationResult`
4. **`testGenerateAllOutputs`** — public `action` wrapper for dashboard testing (thin passthrough)

### Key Design Decisions

- **Sequential, not parallel**: Story ACs explicitly number the order. Measurement spec benefits from upstream data being in DB. Simpler to test and debug.
- **Nullable output fields**: `activation_map` and `measurement_spec` are `| null` to support partial results when generators fail. `icp_profiles` defaults to `[]`.
- **Optional `errors` array**: Only present in result when errors occurred. Each entry has `{ step, error }`.
- **No retry logic**: Not in acceptance criteria; YAGNI.
- **No DB storage in orchestrator**: Individual generators handle their own persistence.

### Type: `OutputGenerationResult`

```typescript
export interface OutputGenerationResult {
  productId: string;
  icp_profiles: ICPProfile[];
  activation_map: ActivationMap | null;
  measurement_spec: MeasurementSpec | null;
  errors?: Array<{ step: string; error: string }>;
  generated_at: string;
  execution_time_ms: number;
}
```

Note: If the S001 types story defines these fields as non-nullable, this story should update them to support partial results per AC #8.

### Tests: `convex/analysis/outputs/orchestrate.test.ts`

Unit tests verify `GENERATION_STEPS` constant order (3 steps in correct sequence). Integration criteria (AC #5-8) verified via `testGenerateAllOutputs` dashboard action and manual Linear testing — consistent with how lenses orchestrator validates its integration criteria.

## Alternatives Considered

**Parallel ICP + Map, then Spec**: Since ICP and map are independent, they could run in parallel with `Promise.allSettled`, then spec runs after. Rejected because: (1) ACs explicitly state sequential order, (2) only 3 steps so parallel savings are marginal, (3) simpler mental model to test and debug.

## Success Criteria

| # | Criterion | How Addressed |
|---|-----------|---------------|
| 1 | generateAllOutputs internalAction accepts productId, returns OutputGenerationResult | internalAction with v.id("products"), typed return |
| 2 | Runs ICP generation first | Step 1 in sequential handler |
| 3 | Runs activation map generation second | Step 2 in sequential handler |
| 4 | Runs measurement spec generation third | Step 3 in sequential handler |
| 5 | Result includes all three outputs | OutputGenerationResult with all three fields |
| 6 | testGenerateAllOutputs public action available | Public action wrapper |
| 7 | Linear test completes in under 60 seconds | Sequential flow, no overhead |
| 8 | Errors in one generator don't block others | try/catch per step, nullable fields, errors array |
