# Lifecycle Zod Schemas Design

## Overview

Add four Zod validation schemas for lifecycle state types to `packages/core/src/schema/outputs.ts`, mirroring the TypeScript interfaces from M010-E001-S001 and following the existing file conventions exactly.

## Problem Statement

The lifecycle states feature (M010) needs Zod schemas to validate LLM-generated lifecycle state data at runtime. Downstream consumers (response parser, pipeline integration) depend on these schemas for input validation.

## Expert Perspectives

### Product
- Lifecycle states schemas are purely structural — mirror the TypeScript types for runtime validation
- Downstream consumers (response parser, pipeline) depend on these for input validation

### Technical
- `StateCriterionSchema` should be standalone, not extending `UserStateCriterionSchema` — they are parallel domain concepts (lifecycle states vs measurement spec) that coincidentally share `event_name` and `condition` fields. Coupling them would create a false subtype relationship and risk future breakage.
- `exit_triggers` uses `z.array(z.string())`, NOT `z.array(StateCriterionSchema)`. The types design explicitly chose `string[]` for exit triggers — they are narrative descriptions (human-readable), while entry criteria are structured (machine-checkable). This mirrors the existing `ActivationStage.trigger_events` pattern.
- `trigger_conditions` in `StateTransitionSchema` also uses `z.array(z.string())` for the same reason.
- Follow existing file conventions exactly: z.object(), .min(1), .optional(), z.array(), z.infer type exports after each schema.
- Scope boundary: this task defines schemas in outputs.ts only; barrel re-exports through schema/index.ts belong to basesignal-34m.

### Simplification Review
- Verdict: APPROVED — design is minimal, nothing to remove or simplify
- Entry/exit asymmetry (structured vs narrative) is deliberate and well-justified
- No false type hierarchies or unnecessary coupling
- Each schema does exactly one thing; no simpler representation would work
- Reviewer confirmed: include z.infer type exports to match file convention (every schema in the file has one)
- Story TOML line 28 says `exit_triggers (array of StateCriterion)` but should say `exit_triggers (array of string)` — fix during implementation

## Proposed Solution

Add a `// --- Lifecycle States ---` section after the User State Model section (after line 108) with four schemas:

```typescript
// --- Lifecycle States ---

export const StateCriterionSchema = z.object({
  event_name: z.string().min(1),
  condition: z.string().min(1),
  threshold: z.number().optional(),
});
export type StateCriterion = z.infer<typeof StateCriterionSchema>;

export const LifecycleStateSchema = z.object({
  name: z.string().min(1),
  definition: z.string().min(1),
  entry_criteria: z.array(StateCriterionSchema),
  exit_triggers: z.array(z.string()),
  time_window: z.string().optional(),
});
export type LifecycleState = z.infer<typeof LifecycleStateSchema>;

export const StateTransitionSchema = z.object({
  from_state: z.string().min(1),
  to_state: z.string().min(1),
  trigger_conditions: z.array(z.string()),
  typical_timeframe: z.string().optional(),
});
export type StateTransition = z.infer<typeof StateTransitionSchema>;

export const LifecycleStatesResultSchema = z.object({
  states: z.array(LifecycleStateSchema),
  transitions: z.array(StateTransitionSchema),
  confidence: z.number(),
  sources: z.array(z.string()),
});
export type LifecycleStatesResult = z.infer<typeof LifecycleStatesResultSchema>;
```

## Design Details

### Schema Breakdown

| Schema | Required Fields | Optional Fields |
|--------|----------------|-----------------|
| StateCriterionSchema | event_name (min 1), condition (min 1) | threshold (number) |
| LifecycleStateSchema | name, definition, entry_criteria[], exit_triggers[] | time_window (string) |
| StateTransitionSchema | from_state, to_state, trigger_conditions[] | typical_timeframe (string) |
| LifecycleStatesResultSchema | states[], transitions[], confidence, sources[] | — |

### Entry/Exit Asymmetry

`entry_criteria` uses `z.array(StateCriterionSchema)` (structured, machine-checkable) while `exit_triggers` uses `z.array(z.string())` (narrative, human-readable). This mirrors the TypeScript types design which deliberately chose different representations for these fields, consistent with the existing `ActivationStage.trigger_events` pattern.

### Placement

After `// --- User State Model ---` (line 108), before `// --- Tracking Event ---` (line 110). Groups lifecycle schemas near user-state schemas while keeping measurement-spec pipeline schemas separate.

### Naming Note

Existing `StageTransitionSchema` (activation map, uses `from_level`/`to_level` numbers) and new `StateTransitionSchema` (lifecycle, uses `from_state`/`to_state` strings) have distinct names and shapes — no conflict.

## Alternatives Considered

1. **Extend UserStateCriterionSchema** — Rejected. Creates false subtype relationship between independent domain concepts. The shared fields are coincidental.
2. **Use StateCriterionSchema for exit_triggers** — Rejected. The types design explicitly chose `string[]` for exit triggers to distinguish narrative descriptions from structured criteria.

## Scope Boundary

This task is the pure definition layer — add schemas to `outputs.ts` with `export const`/`export type`. Barrel re-exports through `schema/index.ts` and `src/index.ts` belong to basesignal-34m (M010-E001-S003).

## Success Criteria

- All four schemas defined and exported from `outputs.ts`
- Follows existing file conventions (z.object, .min(1), .optional(), z.infer)
- Schema rejects invalid input (empty strings, wrong types)
- `npm run build` succeeds
- No regressions in existing tests
