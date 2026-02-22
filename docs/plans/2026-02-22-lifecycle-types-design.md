# Lifecycle State TypeScript Types Design

## Overview
Add four TypeScript interfaces (`StateCriterion`, `LifecycleState`, `StateTransition`, `LifecycleStatesResult`) to `packages/core/src/types/outputs.ts` for the M010 Lifecycle States feature.

## Problem Statement
The analysis pipeline needs typed interfaces for lifecycle states — the progression model that describes how users move through states (new → activated → power user → at-risk → churned → resurrected). These types are the foundation for Zod schemas, the generator, and pipeline integration.

## Expert Perspectives

### Product
- Lifecycle states are the canonical user progression model; other outputs (measurement spec's userStateModel) are downstream projections
- Types should be clean and composable for downstream consumers

### Technical
- Two distinct conceptual layers: `LifecycleState` describes states with structured, machine-checkable criteria (`StateCriterion[]`); `StateTransition` describes narrative relationships with human-readable descriptions (`string[]`)
- `string[]` for `trigger_conditions` and `exit_triggers` follows existing `StageTransition.trigger_events` pattern — consistent, simple, evolvable
- Naming avoids collision with existing types: `StateCriterion` vs `UserStateCriterion`, `LifecycleState` vs `UserState`, `StateTransition` vs `StageTransition`

### Simplification Review
- Reviewer suggested removing `threshold` and `time_window` optional fields — overridden because both are explicit acceptance criteria
- No other cuts needed; design is minimal and follows existing patterns

## Proposed Solution

Add a "Lifecycle States Types" section to `packages/core/src/types/outputs.ts` after the "User State Model Types" section:

```typescript
// ---------------------------------------------------------------------------
// Lifecycle States Types
// ---------------------------------------------------------------------------

/** A single criterion for entering or evaluating a lifecycle state. */
export interface StateCriterion {
  event_name: string;
  condition: string;
  threshold?: number;
}

/** A lifecycle state with structured entry criteria and exit triggers. */
export interface LifecycleState {
  name: string;
  definition: string;
  entry_criteria: StateCriterion[];
  exit_triggers: string[];
  time_window?: string;
}

/** A transition between two lifecycle states. */
export interface StateTransition {
  from_state: string;
  to_state: string;
  trigger_conditions: string[];
  typical_timeframe?: string;
}

/** Complete lifecycle states result with states and transitions. */
export interface LifecycleStatesResult {
  states: LifecycleState[];
  transitions: StateTransition[];
  confidence: number;
  sources: string[];
}
```

## Design Details

### Placement
After line 100 (end of `UserState` interface), before "Measurement Spec Types" section. Uses same `// ---` comment-separator style.

### Field Rationale
- `StateCriterion.threshold?: number` — Optional quantitative boundary for criteria evaluation
- `LifecycleState.exit_triggers: string[]` — Narrative descriptions (not structured criteria), consistent with `ActivationStage.trigger_events`
- `StateTransition.trigger_conditions: string[]` — Human-readable descriptions, consistent with `StageTransition.trigger_events`
- `LifecycleStatesResult.confidence/sources` — Standard result container pattern matching `ActivationMap`

### Scope
- **This task:** Add 4 interfaces to `outputs.ts` only
- **Separate tasks:** Re-exports from `index.ts`, Zod schemas, tests (basesignal-34m, basesignal-tb8)

## Alternatives Considered
- Using `StateCriterion[]` for `StateTransition.trigger_conditions` — rejected: creates false equivalence between state criteria (machine-checkable) and transition triggers (narrative)
- Removing `threshold`/`time_window` — rejected: explicitly required by acceptance criteria

## Success Criteria
- All 4 interfaces added with correct fields and optionality
- Types exported from `types/outputs.ts`
- `npm run build` succeeds
- No regressions
