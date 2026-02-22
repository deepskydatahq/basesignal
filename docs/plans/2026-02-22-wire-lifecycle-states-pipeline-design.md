# Wire Lifecycle States Generator into Pipeline Design

## Overview
Insert a new step in `generateAllOutputs()` between the activation map and measurement spec that calls `generateLifecycleStates`, following the exact same pattern as existing generator steps.

## Problem Statement
The lifecycle states generator (M010-E002) exists but isn't wired into the output generation pipeline. Without this wiring, scans won't produce lifecycle state output even when the generator is available.

## Expert Perspectives

### Product
- Lifecycle states are positioned correctly as a refinement of the activation map — from "stages users pass through" to "states users inhabit" with named transitions
- Natural progression in the pipeline, inevitable placement between activation map and measurement spec

### Technical
- Guard condition should be `if (activationLevels && result.activation_map && identity)` — stricter than the story hints but correct because (a) the generator declares `identity: IdentityResult` as non-optional for time window calibration, and (b) the orchestrator receives `identity: IdentityResult | null`, so the guard narrows the type safely.
- Adding `identity` to the guard follows "explicit over implicit" — the dependency on identity is visible to future readers, and lifecycle states degrade gracefully (skipped) rather than crashing.
- No new abstractions — follows the exact try/catch + progress callback pattern used by the three existing generators.
- Measurement spec step is unchanged — M010-E003-S003 owns the decision of whether measurement spec should consume lifecycle states. This task only wires the generator and renumbers the measurement spec comment.

### Simplification Review
- Reviewer suggested removing `identity` from the guard condition. Overruled: the type mismatch between `IdentityResult | null` (orchestrator) and `IdentityResult` (generator input) requires either a guard or an unsafe cast. The guard is simpler and more honest.
- Everything else approved as minimal — the step fits into existing orchestration without new utilities or helpers.
- Verdict: APPROVED — design is inevitable. Every element serves a specific purpose, no hidden bloat.

## Proposed Solution

Three changes to `packages/mcp-server/src/analysis/outputs/index.ts`:

### 1. Import and re-export

```typescript
import { generateLifecycleStates } from "./lifecycle-states.js";
export { generateLifecycleStates } from "./lifecycle-states.js";
```

### 2. Insert step 3 between activation map and measurement spec

```typescript
// 3. Lifecycle states (requires activation levels + activation map + identity)
if (activationLevels && result.activation_map && identity) {
  progress?.({ phase: "outputs_lifecycle_states", status: "started" });
  try {
    result.lifecycle_states = await generateLifecycleStates(
      {
        identity,
        value_moments: convergence.value_moments,
        activation_levels: activationLevels.levels,
        activation_map: result.activation_map,
      },
      llm,
    );
    progress?.({ phase: "outputs_lifecycle_states", status: "completed" });
  } catch (e) {
    progress?.({ phase: "outputs_lifecycle_states", status: "failed", detail: String(e) });
    errors?.push({ phase: "outputs", step: "lifecycle_states", message: String(e) });
  }
}
```

### 3. Renumber measurement spec comment from `// 3.` to `// 4.`

## Design Details
- **Guard:** `if (activationLevels && result.activation_map && identity)` — all three conditions required. Generator needs activation map as non-optional input and identity for time window calibration.
- **Input fields:** identity, value_moments, activation_levels, activation_map
- **Error handling:** try/catch with progress "failed" callback and error pushed to errors array
- **Progress phase:** `outputs_lifecycle_states` (added by prerequisite M010-E003-S001)

## Alternatives Considered
1. **Guard with only `activationLevels`** (story hint) — Would require `identity ?? undefined` which is a type error since generator expects `IdentityResult`, not `IdentityResult | undefined`.
2. **Guard with `activationLevels && result.activation_map`** (reviewer suggestion) — Still has the `identity` type mismatch. Would require either an unsafe cast or changing the generator's input interface.
3. **Make identity optional in generator** — Rejected because generator genuinely needs identity for time window calibration. Making it optional hides a real dependency.

## Success Criteria
- generateAllOutputs imports and calls generateLifecycleStates
- Runs after activation map (needs it as input)
- Progress callbacks fire (started/completed/failed)
- Errors pushed to errors array
- Skipped if activationLevels is null (or activation_map is null, or identity is null)
- Generator receives identity, value moments, activation levels, activation map
