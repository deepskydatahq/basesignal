# Measurement Spec Lifecycle States Alignment Design

## Overview
When lifecycle states are available from the pipeline, pass them into the measurement spec generator so the LLM derives `userStateModel` from them instead of inventing 5 hardcoded states. Softened system prompt Step 3 eliminates conflicting instructions; user prompt gets a conditional lifecycle states section.

## Problem Statement
The measurement spec system prompt hardcodes a fixed 5-state user state model (new, activated, active, at_risk, dormant) in Step 3 with prescriptive language ("exactly 5 states"). When M010 lifecycle states are available (7+ states with different names), this creates conflicting instructions if only the user prompt changes. Solution: soften Step 3 to be flexible, add lifecycle states as conditional user prompt section.

## Expert Perspectives

### Product
Lifecycle states are the canonical definition of user progression. The measurement spec's `userStateModel` is a downstream projection — it should derive from lifecycle states, not duplicate the work. This keeps the product model coherent.

### Technical
- System prompt Step 3 uses prescriptive language ("exactly 5 states" with specific names). This is a mandate, not a fallback — the LLM will treat it as authoritative.
- Softening Step 3 to be flexible (with a fallback to 5 defaults) eliminates the conflict without making the system prompt dynamic.
- `lifecycle_states` as optional field on `MeasurementInputData` keeps the data shape consistent.
- No changes to `parseMeasurementSpecResponse` — already handles arbitrary state names.

### Simplification Review
- Softened Step 3 eliminates need for verbose "IMPORTANT override" instruction in user prompt
- Lifecycle states section follows same pattern as existing conditional sections (ICP, activation map)
- "Backward compatibility" concern is addressed: without lifecycle states, softened prompt defaults to same 5 states
- No special-case logic, no new abstractions

## Proposed Solution

### File 1: `packages/mcp-server/src/analysis/outputs/measurement-spec.ts`

**1. Import `LifecycleStatesResult` type:**
```typescript
import type { ActivationLevel, MeasurementSpec, LifecycleStatesResult } from "@basesignal/core";
```

**2. Add optional field to `MeasurementInputData`:**
```typescript
export interface MeasurementInputData {
  // ...existing fields...
  lifecycle_states?: LifecycleStatesResult;
}
```

**3. Soften Step 3 in `MEASUREMENT_SPEC_SYSTEM_PROMPT`:**

Replace the prescriptive Step 3:
```
## Step 3: User State Model
Define a user state model with exactly 5 states representing the user lifecycle:
- new: Users who just signed up
- activated: Users who reached activation criteria
- active: Users who are regularly engaged
- at_risk: Users showing declining engagement
- dormant: Users who have stopped engaging

Each state has:
- name: one of "new", "activated", "active", "at_risk", "dormant"
- definition: human-readable description of what this state means
- criteria: array of { event_name, condition } pairs that define transitions into this state
```

With the flexible version:
```
## Step 3: User State Model
Define a user state model representing the user lifecycle. Each state has:
- name: state identifier
- definition: human-readable description of what this state means
- criteria: array of { event_name, condition } pairs that define transitions into this state

If lifecycle states are provided in the context below, derive your user state model from them.
Otherwise, define 5 representative states: new, activated, active, at_risk, dormant.
```

**4. Add conditional section to `buildMeasurementSpecPrompt`:**

After the Value Event Templates section, before the final "Generate a measurement specification..." line:

```typescript
// Lifecycle States (when available from pipeline)
if (input.lifecycle_states) {
  sections.push("\n## Lifecycle States (use for userStateModel)");
  for (const state of input.lifecycle_states.states) {
    const criteria = state.entry_criteria
      .map((c) => `${c.event_name}: ${c.condition}`)
      .join("; ");
    sections.push(
      `- **${state.name}**: ${state.definition}` +
        `\n  Entry criteria: ${criteria}`,
    );
  }
}
```

**5. Add optional 5th param to `assembleMeasurementInput`:**
```typescript
export function assembleMeasurementInput(
  valueMoments: ValueMoment[],
  activationLevels: ActivationLevel[],
  icpProfiles: ICPProfile[],
  activationMap: ActivationMapResult | null,
  lifecycleStates?: LifecycleStatesResult,  // NEW
): MeasurementInputData {
  // ...existing template computation...
  return {
    // ...existing fields...
    lifecycle_states: lifecycleStates,
  };
}
```

### File 2: `packages/mcp-server/src/analysis/outputs/index.ts`

**6. Pass lifecycle states in `generateAllOutputs`:**

One-line change — pass `result.lifecycle_states` to `assembleMeasurementInput`:
```typescript
const inputData = assembleMeasurementInput(
  convergence.value_moments,
  activationLevels.levels,
  result.icp_profiles,
  result.activation_map,
  result.lifecycle_states ?? undefined,
);
```

## Alternatives Considered
- **Keep system prompt unchanged (original design):** User prompt only. Rejected because Step 3's "exactly 5 states" with hardcoded names creates a direct conflict with lifecycle-derived states. LLM must resolve conflicting instructions — risks ignoring lifecycle data or generating hybrid/confused states.
- **Dynamic system prompt:** System prompt becomes conditional based on lifecycle states. Rejected — system prompt is a const string, making it dynamic adds coupling. Softening the language achieves the same goal without dynamism.

## Success Criteria
- `assembleMeasurementInput` accepts optional `lifecycle_states` (5th param)
- Softened Step 3 instructs LLM to derive from lifecycle states when provided
- User prompt includes lifecycle states section when available
- Without lifecycle states, behavior is identical (softened Step 3 defaults to same 5 states)
- `generateAllOutputs` passes lifecycle states to measurement spec
- Existing measurement spec tests pass unchanged
- No changes to `parseMeasurementSpecResponse` (already handles arbitrary state names)

## Dependencies
- **Upstream:** `LifecycleStatesResult` type from `@basesignal/core` (M010-E001-S001), `OutputsResult.lifecycle_states` field (M010-E003-S001), lifecycle generator wired into pipeline (M010-E003-S002)
- **Downstream:** None — this is a leaf change
