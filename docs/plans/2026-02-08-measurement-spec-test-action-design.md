# Measurement Spec Test Action Design

## Overview

Add a thin public test action `testGenerateMeasurementSpec` that wraps the internal `generateMeasurementSpec` action for manual testing via the Convex dashboard. Follows the established `testRunAllLenses` pattern.

## Problem Statement

M004-E004-S002 implements the measurement spec generator as an `internalAction`, which is not callable from the Convex dashboard. A public wrapper is needed for manual testing, debugging, and validation during development.

## Expert Perspectives

### Technical
- **Thin wrapper pattern**: Follow the `testRunAllLenses` precedent exactly. No business logic in the test action.
- **Inline category aggregation**: The `by_category` reduce is a one-liner — extracting it to a utility adds indirection for no benefit.
- **Return enriched wrapper**: `{ spec, eventCountByCategory, execution_time_ms }` gives the dashboard inspector everything needed without mutating `MeasurementSpec` itself.
- **Type-shape tests only**: Unit-testing the reduce would be testing JavaScript, not domain logic. A return-shape test covers AC #3.

### Simplification Review
- Removed verbose multi-line console.log statements — consolidated to a single log line.
- Kept `eventCountByCategory` in the return value (required by acceptance criteria #3).
- No extracted utilities, no helper functions, no additional abstractions.

## Proposed Solution

A single public `action` in the measurement spec module file (created by S002):

```typescript
export const testGenerateMeasurementSpec = action({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const start = Date.now();
    const spec = await generateMeasurementSpec(ctx, productId);
    const execution_time_ms = Date.now() - start;

    const eventCountByCategory = spec.events.reduce<Record<string, number>>(
      (acc, event) => {
        acc[event.category] = (acc[event.category] || 0) + 1;
        return acc;
      },
      {}
    );

    console.log("testGenerateMeasurementSpec:", {
      total_events: spec.total_events,
      eventCountByCategory,
      execution_time_ms,
    });

    return { spec, eventCountByCategory, execution_time_ms };
  },
});
```

Unit tests validate return shape:
- Object has `spec`, `eventCountByCategory`, `execution_time_ms` keys
- `spec` contains expected MeasurementSpec fields
- `eventCountByCategory` values sum to `spec.total_events`
- `execution_time_ms` is a non-negative number

## Alternatives Considered

1. **Return raw MeasurementSpec only** (like `testRunAllLenses`): Rejected because AC #3 explicitly requires "Result includes event count by category" in the returned result.
2. **Extract `countByCategory` utility**: Rejected — one-liner reduce doesn't justify a utility function. Adds indirection for code that reads as intent.
3. **Verbose console logging (4 separate log calls)**: Simplified to single log line per reviewer feedback.

## Success Criteria

1. `testGenerateMeasurementSpec` public action accepts `productId` — covered by action args
2. Calls `generateMeasurementSpec` and returns full result — covered by wrapper pattern
3. Result includes event count by category — covered by `eventCountByCategory` field
4. Callable from Convex dashboard — public `action` is automatically visible
5. Linear test via dashboard produces valid MeasurementSpec — returns full spec in response
