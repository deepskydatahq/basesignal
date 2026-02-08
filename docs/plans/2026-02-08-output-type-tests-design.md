# Output Type Tests Design

## Overview

Unit tests for validating the M004 output types (ICPProfile, ActivationMap, MeasurementSpec) and their associated runtime type guard functions. Tests verify both compile-time type structure and runtime validation behavior.

## Problem Statement

The output types defined in S001 need runtime validation for downstream LLM-generated JSON parsing. Type guard functions must exist and be tested to ensure generators can safely validate LLM output at runtime.

## Expert Perspectives

### Technical
- Type guards belong in a separate `guards.ts` file, not in `types.ts` (which stays pure interfaces). The mental model: "types define shapes, guards validate instances."
- Shallow structural field checks are sufficient — deep validation is generator responsibility.
- Guards need to be reusable by downstream generators (ICP, activation map, measurement spec generators).

### Simplification Review
- Reduce test structure from 7 describe blocks to ~4-5. Compile-time type verification happens naturally when constructing test objects for guard tests — no need for separate blocks.
- Colocate guard tests with type structure tests in the same describe block per output type.
- Keep guards in `guards.ts` since acceptance criteria explicitly requires them and downstream stories depend on them.

## Proposed Solution

Two files: `guards.ts` with three shallow type guard functions, and `types.test.ts` with focused test blocks that combine type structure verification with guard validation.

## Design Details

### File: `convex/analysis/outputs/guards.ts`

Three type guard functions doing shallow structural checks:
- `isICPProfile` — checks `name` (string), `value_moment_priorities` (array), `activation_triggers` (array)
- `isActivationMap` — checks `stages` (array), `primary_activation_level` (number)
- `isMeasurementSpec` — checks `events` (array), `total_events` (number)

No deep property validation. Generators handle their own deeper checks.

### File: `convex/analysis/outputs/types.test.ts`

4-5 describe blocks (simplified from original 7):

1. **`describe("ICPProfile")`** — construct valid object with all required fields, verify via guard, test guard with invalid/missing fields
2. **`describe("ActivationMap")`** — construct valid object with stages array, verify structure + guard, test guard edge cases
3. **`describe("MeasurementSpec")`** — construct valid object with events array, verify structure + guard, test guard edge cases
4. **`describe("TrackingEvent maps_to")`** — test all discriminated union variants (`value_moment`, `activation_level`, `both`)

Each block combines compile-time type construction (which verifies field presence) with runtime guard tests (valid, missing fields, null, non-object).

### Dependencies

| File | Purpose | Depends On |
|------|---------|------------|
| `convex/analysis/outputs/types.ts` | Type definitions (S001) | convergence/types, extractActivationLevels |
| `convex/analysis/outputs/guards.ts` | Runtime type guards | types.ts |
| `convex/analysis/outputs/types.test.ts` | Tests | types.ts, guards.ts |

## Alternatives Considered

1. **Guards in `types.ts`** — rejected because S001 design requires pure interfaces with no runtime code
2. **Guards inline in test file** — rejected because downstream generators need reusable guards
3. **Deep validation guards** — rejected as over-engineering; shallow structural checks are sufficient for type discrimination

## Success Criteria

- Test file at `convex/analysis/outputs/types.test.ts` passes
- All three type guards tested with valid objects, invalid objects, null, and non-objects
- ICPProfile, ActivationMap, MeasurementSpec required fields verified
- TrackingEvent `maps_to` discriminated union variants tested
- All acceptance criteria from S002 met
