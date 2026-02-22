# Implementation Plan: M010-E001-S001 — Define Lifecycle State TypeScript Types

**Task:** basesignal-kmo
**Status:** plan → ready

## Summary

Add 4 TypeScript interfaces to `packages/core/src/types/outputs.ts`: `StateCriterion`, `LifecycleState`, `StateTransition`, `LifecycleStatesResult`.

## Steps

### Step 1: Add interfaces to outputs.ts

**File:** `packages/core/src/types/outputs.ts`
**Location:** After line 100 (end of `UserState` interface), before line 102 (`// --- Measurement Spec Types ---`)

Insert the following block between the User State Model section and the Measurement Spec Types section:

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

### Step 2: Verify build

Run `npm run build` to confirm no regressions.

### Step 3: Run tests

Run `npm run test:run` to confirm no regressions.

## Verification Checklist

- [ ] StateCriterion: event_name (string), condition (string), threshold (optional number)
- [ ] LifecycleState: name, definition, entry_criteria (StateCriterion[]), exit_triggers (string[]), time_window (optional string)
- [ ] StateTransition: from_state (string), to_state (string), trigger_conditions (string[]), typical_timeframe (optional string)
- [ ] LifecycleStatesResult: states (LifecycleState[]), transitions (StateTransition[]), confidence (number), sources (string[])
- [ ] All 4 types exported from types/outputs.ts
- [ ] npm run build succeeds
- [ ] npm run test:run passes

## Scope

- **In scope:** 4 interfaces in `outputs.ts`
- **Out of scope:** Re-exports from `index.ts` (basesignal-34m), Zod schemas (basesignal-tb8), tests for these types (basesignal-34m)

## Risk

None. Purely additive change to a single file. No existing code is modified.
