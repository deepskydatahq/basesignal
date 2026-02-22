# Implementation Plan: Wire Lifecycle States Generator into Pipeline

**Task:** basesignal-o0e (M010-E003-S002)
**File:** `packages/mcp-server/src/analysis/outputs/index.ts`
**Dependencies:** basesignal-kgv (OutputsResult field), basesignal-cov (generator function)

## Steps

### Step 1: Add import (after line 6)

After the `measurement-spec.js` import, add:

```typescript
import { generateLifecycleStates } from "./lifecycle-states.js";
```

### Step 2: Add re-export (after line 11)

After the `measurement-spec.js` re-export, add:

```typescript
export { generateLifecycleStates } from "./lifecycle-states.js";
```

### Step 3: Insert lifecycle states step (after line 65)

Between the activation map block and the measurement spec block, insert:

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

### Step 4: Renumber measurement spec comment (line 67)

Change `// 3. Measurement spec` to `// 4. Measurement spec`.

## Verification

- `npm run build` in packages/mcp-server succeeds
- Existing tests pass with no regressions
- Pattern matches existing activation map and measurement spec steps

## Notes

- Single-file change, 4 surgical edits
- Guard includes `identity` for type narrowing (`IdentityResult | null` → `IdentityResult`)
- No new test files — E2E test is basesignal-5ro's responsibility
- Line numbers may shift after prerequisites modify the file; re-read before implementing
