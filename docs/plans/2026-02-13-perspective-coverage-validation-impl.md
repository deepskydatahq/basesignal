# Implementation Plan: Perspective Coverage & User State Model Validation

**Task:** basesignal-xqj (M007-E003-S003)
**Depends on:** basesignal-mo1 (M007-E003-S002) — must be completed first

## Goal

Add `perspective_distribution` to `MeasurementSpec.coverage`, then implement two pure validation functions: one that warns on perspective gaps, and one that validates user state model criteria against spec events and activation-level events.

## Prerequisites

This story depends on S002 (basesignal-mo1) which adds:
- `perspective` field on `TrackingEvent`
- `userStateModel: UserState[]` on `MeasurementSpec`
- `warnings?: string[]` on `MeasurementSpec`
- `UserState` / `UserStateCriterion` interfaces

All work below assumes those types exist.

## Files to Modify

1. **convex/analysis/outputs/types.ts** — extend `coverage` type
2. **convex/analysis/outputs/generateMeasurementSpec.ts** — add computation + 2 validation functions + wire into action
3. **convex/analysis/outputs/generateMeasurementSpec.test.ts** — new test blocks + update integration fixture

## Implementation Steps

### Step 1: Extend coverage type in types.ts

Add `perspective_distribution` to the `MeasurementSpec.coverage` type:

```typescript
coverage: {
  activation_levels_covered: number[];
  value_moments_covered: string[];
  perspective_distribution: {
    customer: number;
    product: number;
    interaction: number;
  };
};
```

This is a required field (not optional) since after S002, every event has a `perspective`.

### Step 2: Compute perspective_distribution in parseMeasurementSpecResponse

After the existing coverage computation (lines ~454-478 in current code), add inline computation:

```typescript
const perspectiveDistribution = {
  customer: events.filter(e => e.perspective === "customer").length,
  product: events.filter(e => e.perspective === "product").length,
  interaction: events.filter(e => e.perspective === "interaction").length,
};
```

Include it in the returned coverage object alongside `activation_levels_covered` and `value_moments_covered`.

### Step 3: Add validatePerspectiveCoverage function

Export a pure function in `generateMeasurementSpec.ts`:

```typescript
export function validatePerspectiveCoverage(
  perspectiveDistribution: { customer: number; product: number; interaction: number }
): string[] {
  const warnings: string[] = [];

  // Warn if any perspective has zero events
  for (const [perspective, count] of Object.entries(perspectiveDistribution)) {
    if (count === 0) {
      warnings.push(`No events for "${perspective}" perspective — all three should be represented`);
    }
  }

  // Warn if product perspective has fewer events than others
  const { customer, product, interaction } = perspectiveDistribution;
  if (product > 0 && (product < customer || product < interaction)) {
    warnings.push(
      `Product perspective has fewer events (${product}) than other perspectives (customer: ${customer}, interaction: ${interaction})`
    );
  }

  return warnings;
}
```

### Step 4: Add validateUserStateModel function

Export a pure function in `generateMeasurementSpec.ts`:

```typescript
export function validateUserStateModel(
  states: UserState[],
  events: TrackingEvent[],
  activationLevels: ActivationLevel[]
): string[] {
  const warnings: string[] = [];
  const eventNames = new Set(events.map(e => e.name));

  // Check each state criterion references an existing event
  for (const state of states) {
    for (const criterion of state.criteria) {
      if (!eventNames.has(criterion.event_name)) {
        warnings.push(
          `User state "${state.name}" references non-existent event "${criterion.event_name}"`
        );
      }
    }
  }

  // Check activated state criteria overlap with activation-level events
  const activatedState = states.find(s => s.name === "activated");
  if (activatedState) {
    const activationEvents = events.filter(
      e => e.maps_to.type === "activation_level" || e.maps_to.type === "both"
    );
    const activationEventNames = new Set(activationEvents.map(e => e.name));
    const hasOverlap = activatedState.criteria.some(
      c => activationEventNames.has(c.event_name)
    );
    if (!hasOverlap) {
      warnings.push(
        "Activated state criteria don't reference any activation-level events"
      );
    }
  }

  return warnings;
}
```

Note: `activationLevels` param is included for future use but the current logic only uses `events` with activation-level maps_to. Keep the param to match the design doc signature.

### Step 5: Wire validators into the action handler

In the `generateMeasurementSpec` internalAction handler, after parsing the spec (step 4 in existing code):

```typescript
// 4. Parse response
const spec = parseMeasurementSpecResponse(responseText);

// 5. Run validators
const perspectiveWarnings = validatePerspectiveCoverage(spec.coverage.perspective_distribution);
const stateWarnings = validateUserStateModel(
  spec.userStateModel,
  spec.events,
  inputData.activation_levels
);

const allWarnings = [...perspectiveWarnings, ...stateWarnings];
for (const w of allWarnings) {
  console.warn(`[MeasurementSpec] ${w}`);
}

// Append to spec.warnings (S002 adds warnings?: string[])
if (allWarnings.length > 0) {
  spec.warnings = [...(spec.warnings ?? []), ...allWarnings];
}
```

### Step 6: Update test fixture factories

In `generateMeasurementSpec.test.ts`:

**makeValidEvent** — add `perspective: "customer"` as default (so existing tests don't break).

**makeValidResponse** — the factory already wraps events; no change needed beyond the event factory since `perspective_distribution` is computed, not passed in.

### Step 7: Add test block for validatePerspectiveCoverage

```
describe("validatePerspectiveCoverage")
  - returns no warnings when all perspectives have events
  - warns when any perspective has zero events (test each one)
  - warns when product perspective has fewer events than customer
  - warns when product perspective has fewer events than interaction
  - does not warn when product has equal or more events
```

### Step 8: Add test block for validateUserStateModel

```
describe("validateUserStateModel")
  - returns no warnings when all criteria reference existing events
  - warns when a criterion references a non-existent event
  - warns when activated state criteria don't overlap with activation-level events
  - no warning when activated state has at least one activation-level event
  - handles empty userStateModel gracefully
```

### Step 9: Update parseMeasurementSpecResponse tests

- Verify that the parsed spec includes `perspective_distribution` in coverage
- Verify counts match event perspectives

### Step 10: Update integration test fixture

Update the "realistic Linear-like response" test to include:
- Events with all three perspectives (`customer`, `product`, `interaction`)
- Assert `spec.coverage.perspective_distribution` has non-zero counts for all three

## Testing Strategy

- **Unit tests:** validatePerspectiveCoverage and validateUserStateModel are pure functions — test each warning case in isolation
- **Parser tests:** Verify perspective_distribution is computed correctly from event data
- **Integration test:** End-to-end fixture with three-perspective events producing valid coverage

## Acceptance Criteria Mapping

| AC | Implementation |
|----|---------------|
| perspective_distribution with event counts | Step 1 (type) + Step 2 (computation) |
| Warns on zero-event perspective | Step 3 (validatePerspectiveCoverage) |
| Warns on underrepresented product perspective | Step 3 (validatePerspectiveCoverage) |
| User state model criteria validated against events | Step 4 (validateUserStateModel) |
| Activated state checked against activation-level events | Step 4 (validateUserStateModel) |
| coverage extended with perspective_distribution | Step 1 |
| Full generation produces valid three-perspective spec | Step 10 (integration test) |

## Risks

- **Dependency not yet complete:** S002 (basesignal-mo1) must land first. The `perspective` field on TrackingEvent and `userStateModel` on MeasurementSpec are prerequisites.
- **Fixture update cascade:** Adding `perspective` to makeValidEvent affects all existing tests. Default value in factory minimizes impact.
