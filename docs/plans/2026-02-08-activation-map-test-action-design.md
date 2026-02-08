# Activation Map Test Action Design

## Overview
Add a public `testGenerateActivationMap` action that wraps the internal `generateActivationMap` action, enabling manual testing of activation map generation via the Convex dashboard.

## Problem Statement
The activation map generator (M004-E003-S002) will be an internal action, not callable directly from the Convex dashboard. A public test wrapper is needed for manual testing, debugging, and validation during development.

## Expert Perspectives

### Technical
- The test action should use Pattern B (enriched wrapper) with its own timing layer, since `generateActivationMap` returns a business artifact (ActivationMap), not a telemetry wrapper.
- Action-level timing measures end-to-end execution (useful for dashboard debugging), which is a different observability layer than any internal algorithmic timing.
- Co-locate the test action in the same file as the internal action it wraps, matching the pattern from `testRunAllLenses` and `testExtractActivation`.

### Simplification Review
- Design approved as minimal. No components to remove or simplify.
- Pattern consistency with existing test actions makes the design feel inevitable.

## Proposed Solution

Add `testGenerateActivationMap` to `convex/analysis/outputs/generateActivationMap.ts` (the file created by S002):

```typescript
export const testGenerateActivationMap = action({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    const result = await ctx.runAction(
      internal.analysis.outputs.generateActivationMap.generateActivationMap,
      { productId: args.productId }
    );

    const execution_time_ms = Date.now() - startTime;

    return {
      ...result,
      stage_count: result.stages.length,
      execution_time_ms,
    };
  },
});
```

## Design Details

- **Public action** (not `internalAction`) so it's callable from Convex dashboard
- **Spread result** ensures full ActivationMap is returned without hardcoding fields
- **`stage_count`** convenience field for quick dashboard inspection
- **`execution_time_ms`** action-level timing for observability

## Alternatives Considered

- **Pattern A (thin wrapper)**: Just call and return the raw result. Rejected because acceptance criteria explicitly require `execution_time_ms` and `stage_count`.
- **Separate test file**: Rejected in favor of co-location, matching existing patterns.

## Success Criteria

1. `testGenerateActivationMap` public action accepts `productId`
2. Action calls `generateActivationMap` and returns full result
3. Result includes `execution_time_ms` and `stage_count`
4. Action callable from Convex dashboard
5. Linear test via dashboard produces valid ActivationMap
