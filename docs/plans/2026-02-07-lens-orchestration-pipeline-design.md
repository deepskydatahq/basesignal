# Lens Orchestration Pipeline Design

## Overview

Create `convex/analysis/lenses/orchestrate.ts` containing a `runAllLenses` internalAction and a `testRunAllLenses` public action. The orchestrator runs 7 lens extractors in two batches using `Promise.allSettled` for error isolation, passes a human-readable context summary from Batch 1 to Batch 2, and returns a unified `AllLensesResult`.

## Problem Statement

The 7-lens value discovery system (M003) needs an orchestrator to run all lenses in the correct order — Batch 1 (4 independent lenses) in parallel, then Batch 2 (3 inference-heavy lenses) in parallel with Batch 1 context — collecting all candidates into a single result for downstream validation and convergence.

## Expert Perspectives

### Technical
- **Context passing as summary string**: Batch 2 lenses receive `v.optional(v.string())` containing a human-readable summary of Batch 1 results. This avoids Convex serialization complexity for nested types and aligns with how LLM prompts consume context.
- **Static action references**: Hard-code all 7 `internal.analysis.lenses.*` references. Convex's type system works best with static imports. The orchestrator won't compile until S002/S003 exist — this is intentional compile-time safety.
- **Promise.allSettled for error isolation**: Both batches use `Promise.allSettled` so a failed lens produces an error entry but doesn't block others.

### Simplification Review
- **Inline context builder**: The `buildBatch1ContextSummary` helper should be inlined — it's a one-time transformation used in one place.
- **Lock down context format**: Define the summary string format upfront so Batch 2 prompt engineering is straightforward.
- **Keep per-lens timing**: Required by acceptance criteria #9, but keep the structure flat — include timing on `LensResult` objects rather than a separate metadata layer.

## Proposed Solution

Single file `convex/analysis/lenses/orchestrate.ts` following the pattern from `convex/analysis/orchestrate.ts`.

### Execution Flow

```
runAllLenses(productId)
  |
  |-- Batch 1: Promise.allSettled([
  |     extractCapabilityMapping({ productId }),
  |     extractEffortElimination({ productId }),
  |     extractTimeCompression({ productId }),
  |     extractArtifactCreation({ productId }),
  |   ])
  |
  |-- Build context summary string from Batch 1 fulfilled results
  |
  |-- Batch 2: Promise.allSettled([
  |     extractInfoAsymmetry({ productId, batch1Context }),
  |     extractDecisionEnablement({ productId, batch1Context }),
  |     extractStateTransitions({ productId, batch1Context }),
  |   ])
  |
  |-- Collect all candidates, errors, per-lens timing
  |-- Return AllLensesResult
```

## Design Details

### `AllLensesResult` type

```typescript
export interface AllLensesResult {
  productId: Id<"products">;
  candidates: LensCandidate[];
  per_lens: Array<{ lens: LensType; candidate_count: number; execution_time_ms: number }>;
  total_candidates: number;
  execution_time_ms: number;
  errors: Array<{ lens: LensType; error: string }>;
}
```

### Context summary format

Inline in the orchestrator. Format locked down as:

```
Previously identified value moment candidates:

capability_mapping (12 candidates):
  - Issue Tracking: Track and manage work items through customizable workflows
  - Cycle Planning: Time-boxed planning periods for team execution
  ...top 5 only

effort_elimination (10 candidates):
  - ...
```

Top 5 candidates per lens, name + description. Max ~20 lines total. Returns empty string if no Batch 1 results (Batch 2 still works independently).

### Batch 2 lens contract

Each Batch 2 lens accepts:
```typescript
args: {
  productId: v.id("products"),
  batch1Context: v.optional(v.string()),
}
```

### What this file does NOT contain

- No database writes (caller's responsibility)
- No Anthropic client (each lens manages its own LLM calls)
- No page fetching (each lens fetches its own pages)
- No retry logic (Promise.allSettled provides error isolation)
- No dynamic lens registration (static imports only)

## Alternatives Considered

1. **Pass structured batch1Results via `v.any()`** — Loses type safety at Convex boundary. Rejected.
2. **Full Convex validators for LensResult** — Too verbose for data that ultimately gets consumed as text by LLM prompts. Rejected.
3. **Dynamic lens registration** — Convex's type system doesn't support dynamic action references well. Adds indirection for no benefit with a known, fixed set of 7 lenses. Rejected.

## Success Criteria

1. `runAllLenses` internalAction compiles and runs when all 7 lens actions exist
2. Batch 1 (4 lenses) runs in parallel, Batch 2 (3 lenses) runs after with context
3. A failed lens produces an error entry but doesn't block others
4. Returns all candidates with per-lens and total timing
5. `testRunAllLenses` public action enables manual testing from Convex dashboard
