# Activation Input Aggregation Design

## Overview

A pure function that aggregates activation levels and value moments into a unified `ActivationInputData` structure, with value moments pre-mapped to suggested activation stages based on their tier. A thin Convex `internalQuery` wrapper fetches data from the product profile.

## Problem Statement

The activation map generator (M004-E003-S002) needs structured input combining activation levels and value moments. Currently these live in separate places on the product profile. This story creates the aggregation layer that reads both, maps value moments to likely unlock stages, and provides a single input structure for map generation.

## Expert Perspectives

### Product
- Proportional tier-to-level mapping preserves signal strength across all product configurations (2-level, 3-level, 4-level products)
- Fixed+clamp approach would collapse tiers and lose signal in products with fewer levels
- The downstream LLM generator can still override suggestions, so correctness here is more important than simplicity

### Technical
- Pure function + thin Convex wrapper follows the established `extractActivationLevels.ts` pattern
- Core logic is directly testable with Vitest, no Convex mocking needed
- The `internalQuery` wrapper is ~5 lines — not worth integration-testing separately
- Unit tests with realistic Linear fixture data satisfy the `[integration]` criterion

### Simplification Review
- Removed `tierReason(tier)` helper — not required by acceptance criteria, adds ceremony
- Removed `reason` field from `SuggestedMapping` — downstream consumer (LLM) doesn't need pre-baked explanations
- Result: two pure functions (`suggestLevel`, `aggregateActivationInputs`) + one thin wrapper

## Proposed Solution

### Types (defined locally, re-exportable later from `outputs/types.ts`)

```typescript
export interface SuggestedMapping {
  moment_id: string;
  moment_name: string;
  tier: ValueMomentTier;
  suggested_level: number;
}

export interface ActivationInputData {
  activation_levels: ActivationLevel[];
  value_moments: ValueMoment[];
  suggested_mappings: SuggestedMapping[];
  primary_activation_level: number;
}
```

### Pure Functions

```typescript
export function suggestLevel(tier: ValueMomentTier, maxLevel: number): number {
  const ratio = tier === 1 ? 0.75 : tier === 2 ? 0.50 : 0.25;
  return Math.ceil(maxLevel * ratio);
}

export function aggregateActivationInputs(
  activationResult: ActivationLevelsResult,
  convergenceResult: ConvergenceResult
): ActivationInputData {
  const maxLevel = activationResult.levels.length;
  const suggested_mappings = convergenceResult.value_moments.map((vm) => ({
    moment_id: vm.id,
    moment_name: vm.name,
    tier: vm.tier,
    suggested_level: suggestLevel(vm.tier, maxLevel),
  }));

  return {
    activation_levels: activationResult.levels,
    value_moments: convergenceResult.value_moments,
    suggested_mappings,
    primary_activation_level: activationResult.primaryActivation,
  };
}
```

### Thin Convex Wrapper

An `internalQuery` that accepts `productId`, reads `productProfiles.definitions.activation` and `productProfiles.convergence`, validates both exist, and calls the pure function.

## Design Details

### File Structure

1. **`convex/analysis/outputs/aggregateActivationInputs.ts`** — main file:
   - `ActivationInputData` and `SuggestedMapping` interfaces
   - `suggestLevel(tier, maxLevel)` pure function
   - `aggregateActivationInputs(activationResult, convergenceResult)` pure function
   - `aggregateActivationInputsQuery` thin Convex `internalQuery` wrapper

2. **`convex/analysis/outputs/aggregateActivationInputs.test.ts`** — Vitest tests:
   - `suggestLevel` unit tests for various maxLevel values (3, 4, 5) and all tiers
   - `aggregateActivationInputs` with minimal data (1 level, 1 moment)
   - Verifies all activation levels are included
   - Verifies all value moments are included
   - Verifies tier-to-level pre-mapping
   - Linear integration test: 4 activation levels, ~6 value moments at tiers 1-3

### Proportional Mapping Logic

| Tier | Ratio | maxLevel=3 | maxLevel=4 | maxLevel=5 |
|------|-------|-----------|-----------|-----------|
| T1 (highest value) | 0.75 | 3 | 3 | 4 |
| T2 (core value) | 0.50 | 2 | 2 | 3 |
| T3 (basic value) | 0.25 | 1 | 1 | 2 |

## Alternatives Considered

1. **Fixed 1/2/3 mapping + clamp** — Simpler but collapses T1 and T2 to the same level in 2-level products, losing signal.
2. **Single Convex internalQuery** — Simpler structurally but harder to unit test the logic. The codebase already follows the pure function pattern.
3. **Including `tierReason` explanations** — Removed during simplification review as unnecessary ceremony not required by acceptance criteria.

## Success Criteria

1. `aggregateActivationInputs` accepts two data structures and returns `ActivationInputData`
2. All activation levels from the result are included
3. All value moments from convergence are included
4. Value moments are pre-mapped to suggested stages via proportional scaling
5. Linear-realistic fixture test returns 4 activation levels with correct value moment suggestions
