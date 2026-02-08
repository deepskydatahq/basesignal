# ICP Test Action Design

## Overview

Add a public `testGenerateICPProfiles` action that allows manual testing of ICP profile generation via the Convex dashboard. Follows the minimal pass-through pattern established by `testRunAllLenses` and `testExtractActivation`.

## Problem Statement

ICP profile generation (M004-E002) needs a way to be manually tested and inspected via the Convex dashboard. The test action provides a public entry point to trigger the internal generator and see results with performance timing.

## Expert Perspectives

### Technical
- The test action should be a minimal pass-through, consistent with existing patterns (`testRunAllLenses`, `testExtractActivation`)
- Timing logic belongs inside the internal action, not extracted into a separate helper
- No unit tests needed for the action itself — it's a trivial wrapper with no testable logic
- No new abstractions (YAGNI) — if a reusable timing helper is needed later, extract then

### Simplification Review
- **Removed:** `formatICPTestResult` pure helper function — unnecessary abstraction layer
- **Removed:** Unit tests for the helper — no helper means no tests needed
- **Kept:** Minimal pass-through action matching the established codebase convention
- The existing pattern (timing inside internal actions, thin public wrappers) is already minimal

## Proposed Solution

A single public `action()` in `convex/analysis/outputs/generateICPProfiles.ts` that:
1. Accepts `productId`
2. Delegates to internal `generateICPProfiles` via `ctx.runAction()`
3. Returns the full result (which includes `execution_time_ms` computed by the internal action)

### Implementation Pattern

```typescript
// In convex/analysis/outputs/generateICPProfiles.ts

export const testGenerateICPProfiles = action({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const result = await ctx.runAction(
      internal.analysis.outputs.generateICPProfiles.generateICPProfiles,
      { productId },
    );
    console.log(`Generated ${result.profiles.length} ICP profiles in ${result.execution_time_ms}ms`);
    return result;
  },
});
```

This mirrors the exact pattern from `testRunAllLenses` in `orchestrate.ts`.

### Internal Action Responsibility

The internal `generateICPProfiles` (from story S002) handles:
- `Date.now()` bookends for timing
- LLM call to generate profiles
- Parsing into `ICPProfile[]` structure
- Returning `{ profiles, count, execution_time_ms }`

## Alternatives Considered

1. **Extract `formatICPTestResult` pure helper** — Rejected by simplification review. Creates an unnecessary abstraction layer inconsistent with codebase patterns.
2. **Full `convex-test` integration tests** — Rejected. Existing test actions have zero tests. The action is a trivial pass-through.
3. **Generic reusable timing utility** — Rejected (YAGNI). Only one test action needs timing currently.

## Success Criteria

1. `testGenerateICPProfiles` is callable from Convex dashboard
2. Returns `{ profiles: ICPProfile[], count: number, execution_time_ms: number }`
3. Console logs profile summary for quick inspection
4. Linear test produces valid ICP profiles for a real product
