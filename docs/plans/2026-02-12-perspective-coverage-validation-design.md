# Perspective Coverage & User State Model Validation Design

## Overview
Add perspective distribution tracking to measurement spec coverage and validate user state model references. Two pure validation functions provide non-blocking warnings when LLM output has gaps.

## Problem Statement
The measurement spec needs to ensure all three perspectives (customer, product, interaction) are represented in the generated events, and that the user state model criteria reference actual events. Without this validation, the spec can silently have blind spots.

## Expert Perspectives

### Technical
- perspective_distribution is intrinsic to the spec (just counting events by perspective field) so it belongs inline in `parseMeasurementSpecResponse`, same as existing coverage metrics.
- User state model validation needs external data (activationLevels), so it separates naturally into its own pure function called from the action handler after parsing.
- The parse layer stays focused on parsing/hard-validation. Validation warnings live in the orchestration layer.

### Simplification Review
- Reviewer flagged user state model validation as scope creep, but it's explicitly required by the acceptance criteria ("User state model criteria validated against existing event names", "Activated state criteria checked against activation-level events").
- Applied: Keep warnings as simple console.warn calls, no warning abstraction layer.
- Applied: No new warning field on MeasurementSpec type — warnings are ephemeral.

## Proposed Solution

### types.ts
Add `perspective_distribution` to `MeasurementSpec.coverage`:
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

### generateMeasurementSpec.ts

**1. Compute perspective_distribution inline in `parseMeasurementSpecResponse`**
After existing coverage computation, count events by perspective field (3 filter+length calls). Same pattern as existing coverage.

**2. `validatePerspectiveCoverage(perspectiveDistribution)` → string[]**
Pure function. Warns if any perspective has zero events. Warns if product perspective has fewer events than others.

**3. `validateUserStateModel(states, events, activationLevels)` → string[]**
Pure function. Checks each state criterion's event_name exists in spec events. Checks activated state criteria overlap with activation-level events.

**4. Action handler calls both validators after parsing, logs warnings with console.warn.**

### Tests
- Update fixture factories (makeValidEvent gets perspective, makeValidResponse gets userStateModel)
- New describe block for validatePerspectiveCoverage (zero events, imbalanced product)
- New describe block for validateUserStateModel (missing events, activated state alignment)
- Update integration test with three-perspective fixture data

## Alternatives Considered
- **Post-parse validation layer for both**: Rejected because perspective_distribution is intrinsic (no external data needed), so it naturally computes inline like existing coverage.
- **Persisting warnings on MeasurementSpec**: Rejected — warnings are transient quality signals, not stored data.

## Success Criteria
- perspective_distribution computed correctly from event perspective fields
- Warnings emitted for zero-event perspectives and underrepresented product perspective
- User state model criteria validated against existing event names
- Activated state checked against activation-level events
- All existing tests still pass
- Full generation on test data produces valid three-perspective spec
