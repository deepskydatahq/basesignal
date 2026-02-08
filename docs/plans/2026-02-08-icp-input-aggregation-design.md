# ICP Input Aggregation Design

## Overview

A pure helper function aggregates role mentions from convergence value moments and identity extraction, grouping value moments by role affinity to feed the downstream ICP profile generator.

## Problem Statement

The ICP generator (M004-E002-S002) needs structured role-grouped data to create persona profiles. Raw convergence data stores value moments with role arrays, but doesn't group by role. This function bridges that gap.

## Expert Perspectives

### Product
- Fan-out grouping is essential: when a value moment mentions both "PM" and "Engineering Lead", it should appear under both roles. This preserves multi-role signals that help the LLM understand buying committee dynamics.
- Hiding multi-role signals produces weaker, less accurate personas.

### Technical
- Pure core + thin wrapper pattern matches existing codebase conventions (urlUtils, metricSuggestions, extractOutcomesHelpers).
- Use `internalQuery` (not action) since the wrapper only reads from DB.
- Core function takes `(valueMoments, targetCustomer)` — explicit inputs, no Convex context needed.

### Simplification Review
- Reviewer questioned whether a separate aggregation function is needed at all, suggesting inline into consumers instead.
- Decision: Keep the function because (a) the story ACs explicitly require it, (b) it enables clean unit testing of grouping logic, (c) the fan-out + sort + targetCustomer inclusion logic is non-trivial enough to warrant a named function.
- Removed: Over-defensive empty-string phantom role creation. If targetCustomer is empty, skip it.
- Simplified: Role normalization is just `.trim()`, nothing more.

## Proposed Solution

Single file `convex/analysis/outputs/aggregateICPInputs.ts` containing:

1. **Types**: `RoleAggregation` and `ICPInputData`
2. **Pure function**: `aggregateICPInputsCore(valueMoments, targetCustomer)` — fan-out groups value moments by role, sorts by tier-1 count
3. **Convex wrapper**: `aggregateICPInputs` internalQuery — reads profile, calls core

## Design Details

### Types

```typescript
interface RoleAggregation {
  name: string;
  occurrence_count: number;      // How many value moments mention this role
  value_moments: ValueMoment[];  // All moments mentioning this role (fan-out)
  tier_1_moments: number;        // Count of tier-1 moments for this role
}

interface ICPInputData {
  roles: RoleAggregation[];
  target_customer: string;
  total_value_moments: number;
}
```

### Core function logic

1. Iterate value moments, fan-out each moment to all its `roles[]` entries
2. Build `Map<string, ValueMoment[]>` (role name → moments)
3. If `targetCustomer` is non-empty and not already in the map, add it with empty moments
4. Convert map to `RoleAggregation[]`, sorted by tier_1_moments desc, then occurrence_count desc
5. Return `ICPInputData`

### Wrapper logic

1. Read product profile via `by_product` index
2. Extract `profile.convergence.value_moments` (cast from untyped section)
3. Extract `profile.identity.targetCustomer` (default to "" if missing)
4. Call core function, return result

### Test strategy

- **Unit tests (AC1-4)**: Test `aggregateICPInputsCore` with hand-crafted ValueMoment fixtures
- **Integration test (AC5)**: Use convex-test with seeded profile data, verify 3+ roles

## Alternatives Considered

1. **Inline into ICP generator** — Simpler but prevents isolated unit testing of grouping logic and diverges from the story breakdown.
2. **Action-aware function** — Rejected; only reads data, no need for action context.
3. **Primary role assignment** — Rejected; hiding multi-role signals produces weaker personas.

## Success Criteria

- `aggregateICPInputsCore` is pure and unit-testable without Convex runtime
- Fan-out grouping correctly places multi-role moments under all their roles
- targetCustomer from identity extraction appears in output roles
- Integration test with Linear-like data produces 3+ distinct roles
