# Implementation Plan: M010-E001-S003 — Update OutputGenerationResult and Package Exports

## Prerequisites

This task depends on:
- **basesignal-kmo** (S001): Define lifecycle state TypeScript types in `types/outputs.ts`
- **basesignal-tb8** (S002): Create Zod validation schemas in `schema/outputs.ts`

Both must be completed before this task can start. S001 adds `StateCriterion`, `LifecycleState`, `StateTransition`, `LifecycleStatesResult` to `types/outputs.ts`. S002 adds corresponding Zod schemas to `schema/outputs.ts`.

## Steps

### Step 1: Add `lifecycle_states` to `OutputGenerationResult`

**File:** `packages/core/src/types/outputs.ts`

Add optional field after `measurement_spec` (line 190):

```typescript
export interface OutputGenerationResult {
  productId: string;
  icp_profiles: ICPProfile[];
  activation_map: ActivationMap;
  measurement_spec: MeasurementSpec;
  lifecycle_states?: LifecycleStatesResult;  // <-- ADD
  generated_at: string;
  execution_time_ms: number;
}
```

No import needed — `LifecycleStatesResult` will be defined in the same file by S001.

### Step 2: Add 4 type exports to `types/index.ts` (intermediate barrel)

**File:** `packages/core/src/types/index.ts`

Add to the "Output types" block (after `OutputGenerationResult` on line 70):

```typescript
// Output types
export type {
  // ... existing ...
  OutputGenerationResult,
  StateCriterion,         // <-- ADD
  LifecycleState,         // <-- ADD
  StateTransition,        // <-- ADD
  LifecycleStatesResult,  // <-- ADD
} from "./outputs";
```

### Step 3: Add 4 type exports to `src/index.ts` (top-level barrel)

**File:** `packages/core/src/index.ts`

Add to the "Output types" block (after `OutputGenerationResult` on line 79):

```typescript
// Output types
export type {
  // ... existing ...
  OutputGenerationResult,
  StateCriterion,         // <-- ADD
  LifecycleState,         // <-- ADD
  StateTransition,        // <-- ADD
  LifecycleStatesResult,  // <-- ADD
} from "./types/outputs";
```

### Step 4: Add 4 schema exports + 4 type exports to `schema/index.ts`

**File:** `packages/core/src/schema/index.ts`

Add schemas to the "Output types" schema export block (after `UserStateSchema` on line 53):

```typescript
export {
  // ... existing ...
  UserStateCriterionSchema,
  UserStateSchema,
  StateCriterionSchema,          // <-- ADD
  LifecycleStateSchema,          // <-- ADD
  StateTransitionSchema,         // <-- ADD
  LifecycleStatesResultSchema,   // <-- ADD
} from "./outputs";
```

Add types to the "Output types" type export block (after `UserState` on line 68):

```typescript
export type {
  // ... existing ...
  UserStateCriterion,
  UserState,
  StateCriterion,         // <-- ADD
  LifecycleState,         // <-- ADD
  StateTransition,        // <-- ADD
  LifecycleStatesResult,  // <-- ADD
} from "./outputs";
```

### Step 5: Create schema test file

**File:** `packages/core/src/schema/__tests__/lifecycle-states.test.ts` (NEW)

Follow existing `outputs.test.ts` pattern: local imports from `"../outputs"`, `safeParse`, fixture-based.

```typescript
import { describe, it, expect } from "vitest";
import { LifecycleStatesResultSchema } from "../outputs";

const validLifecycleStatesResult = {
  states: [
    {
      name: "New",
      definition: "User just signed up",
      entry_criteria: [{ event_name: "signup", condition: "completed", threshold: 1 }],
      exit_triggers: ["completes onboarding"],
      time_window: "0-1 days",
    },
    {
      name: "Onboarding",
      definition: "User going through setup",
      entry_criteria: [{ event_name: "onboarding_start", condition: "triggered" }],
      exit_triggers: ["completes all setup steps"],
      time_window: "1-7 days",
    },
    {
      name: "Activated",
      definition: "User reached core value",
      entry_criteria: [{ event_name: "core_action", condition: "count >= 1" }],
      exit_triggers: ["sustained engagement over 2 weeks"],
    },
    {
      name: "Engaged",
      definition: "Regular active usage",
      entry_criteria: [{ event_name: "session", condition: "weekly count >= 3" }],
      exit_triggers: ["reaches power user threshold"],
      time_window: "7-30 days",
    },
    {
      name: "Retained",
      definition: "Long-term consistent user",
      entry_criteria: [{ event_name: "session", condition: "monthly count >= 8" }],
      exit_triggers: ["usage drops below threshold"],
      time_window: "30+ days",
    },
    {
      name: "Power User",
      definition: "Highly engaged advocate",
      entry_criteria: [{ event_name: "advanced_feature", condition: "weekly count >= 5" }],
      exit_triggers: ["engagement decline"],
    },
    {
      name: "At Risk",
      definition: "Usage declining",
      entry_criteria: [{ event_name: "session", condition: "gap > 14 days" }],
      exit_triggers: ["re-engagement or churn"],
      time_window: "14+ days inactive",
    },
  ],
  transitions: [
    {
      from_state: "New",
      to_state: "Onboarding",
      trigger_conditions: ["starts onboarding flow"],
      typical_timeframe: "0-1 days",
    },
    {
      from_state: "Onboarding",
      to_state: "Activated",
      trigger_conditions: ["completes core action"],
      typical_timeframe: "1-7 days",
    },
  ],
  confidence: 0.85,
  sources: ["product analysis", "user research"],
};

describe("LifecycleStatesResultSchema", () => {
  it("accepts valid 7-state result", () => {
    expect(LifecycleStatesResultSchema.safeParse(validLifecycleStatesResult).success).toBe(true);
  });

  it("rejects missing required field (states)", () => {
    const { states, ...rest } = validLifecycleStatesResult;
    expect(LifecycleStatesResultSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects invalid entry_criteria", () => {
    const invalid = {
      ...validLifecycleStatesResult,
      states: [
        {
          ...validLifecycleStatesResult.states[0],
          entry_criteria: [{ bad_field: true }],
        },
      ],
    };
    expect(LifecycleStatesResultSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(LifecycleStatesResultSchema.safeParse("not an object").success).toBe(false);
  });
});
```

**Note:** The fixture field names (`entry_criteria`, `exit_triggers`, `trigger_conditions`, `time_window`, `threshold`) must match the S001/S002 type definitions exactly. Adjust during implementation if S001/S002 use different names.

### Step 6: Verify

```bash
npm run build    # Confirms type correctness across all packages
npm run test:run # Confirms no regressions + new tests pass
```

## Files Changed

| # | File | Change | Lines |
|---|------|--------|-------|
| 1 | `packages/core/src/types/outputs.ts` | Add `lifecycle_states?: LifecycleStatesResult` to `OutputGenerationResult` | ~line 190 |
| 2 | `packages/core/src/types/index.ts` | Add 4 type exports to "Output types" block | ~line 70 |
| 3 | `packages/core/src/index.ts` | Add 4 type exports to "Output types" block | ~line 79 |
| 4 | `packages/core/src/schema/index.ts` | Add 4 schema exports + 4 type exports | ~lines 53, 68 |
| 5 | `packages/core/src/schema/__tests__/lifecycle-states.test.ts` | NEW: 4 schema validation tests | — |

## Risks

- **Fixture mismatch**: Test fixture field names depend on S001/S002 definitions. If S001 changes field names during implementation, the test fixture must be updated accordingly.
- **`StateTransition` name collision**: The type name `StateTransition` in lifecycle states could be confused with `StageTransition` in activation maps. Both are exported from the same file. This is a naming concern from S001, not something S003 can change.
