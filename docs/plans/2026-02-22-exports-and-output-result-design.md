# Update OutputGenerationResult and Package Exports Design

## Overview
Wire lifecycle states into the existing OutputGenerationResult type and package exports. This is a thin integration layer that connects the types (S001) and schemas (S002) created by upstream tasks into the @basesignal/core output structure and barrel files.

## Problem Statement
Lifecycle states types and schemas are defined in upstream tasks (S001, S002) but not yet wired into the OutputGenerationResult interface or exported from the @basesignal/core package entry points. Downstream consumers need these exports to use lifecycle states in the pipeline.

## Expert Perspectives

### Product
- Lifecycle states are a defined output type slotting into OutputGenerationResult following the exact pattern of measurement_spec (optional field, same confidence/sources structure)
- The generator (M010-E002) will write to this field during the pipeline
- Lifecycle states become a natural fourth output alongside ICP profiles, activation maps, and measurement specs

### Technical
- Use local imports in tests (`"../outputs"`), matching existing pattern in outputs.test.ts and identity.test.ts
- Test file scoped strictly to Zod schema validation — no compile-time `satisfies` checks
- Build verification (`npm run build`) handles type correctness; tests handle runtime behavior
- No OutputGenerationResultSchema needed — container types are TypeScript-only (no runtime validation)
- Barrel files use **explicit named exports** (not `export *`), so each new type/schema must be added by name

### Simplification Review
- Removed OutputGenerationResultSchema from scope — no such runtime schema exists in the codebase
- No compile-time type assertions in tests — build already validates type correctness
- Design is minimal and inevitable — every change is mandatory, nothing optional

## Proposed Solution

### 1. Update `packages/core/src/types/outputs.ts`
Add optional `lifecycle_states` field to `OutputGenerationResult`:
```typescript
lifecycle_states?: LifecycleStatesResult;
```
Since S001 adds `LifecycleStatesResult` to the same file, no import is needed — same-file reference.

### 2. Export types from `packages/core/src/index.ts`
The file uses explicit named type exports. Add 4 types to the "Output types" export block:
```typescript
export type {
  // ... existing exports ...
  // Lifecycle states (M010-E001-S003)
  StateCriterion,
  LifecycleState,
  StateTransition,
  LifecycleStatesResult,
} from "./types/outputs";
```

### 3. Export schemas from `packages/core/src/schema/index.ts`
The file uses explicit named exports. Add 4 schemas to the schema export block and 4 inferred types to the type export block:
```typescript
export {
  // ... existing exports ...
  StateCriterionSchema,
  LifecycleStateSchema,
  StateTransitionSchema,
  LifecycleStatesResultSchema,
} from "./outputs";

export type {
  // ... existing exports ...
  StateCriterion,
  LifecycleState,
  StateTransition,
  LifecycleStatesResult,
} from "./outputs";
```

### 4. Create `packages/core/src/schema/__tests__/lifecycle-states.test.ts`
4 tests following existing pattern (local imports, `safeParse`):
- **Valid 7-state result**: Realistic fixture with states (New, Onboarding, Activated, Engaged, Retained, Power User, At Risk), transitions, confidence, sources
- **Missing required field**: Omit `states` array, verify rejection
- **Invalid criteria**: Malformed entry in state criteria, verify rejection
- **Non-object input**: String input, verify rejection

Exact fixture field names must match S001/S002 definitions — adjust during implementation.

### 5. Verify
```bash
npm run build   # Confirms type correctness
npm test        # Confirms no regressions + new tests pass
```

## Changes Summary

| File | Change |
|------|--------|
| `packages/core/src/types/outputs.ts` | Add `lifecycle_states?: LifecycleStatesResult` to `OutputGenerationResult` |
| `packages/core/src/index.ts` | Add 4 named type exports to "Output types" block |
| `packages/core/src/schema/index.ts` | Add 4 schema exports + 4 inferred type exports |
| `packages/core/src/schema/__tests__/lifecycle-states.test.ts` | New file: 4 schema validation tests |

## Alternatives Considered
- **Import from `@basesignal/core` in tests** to verify re-exports — rejected because export verification is a build-time concern, not a schema test concern
- **Add `OutputGenerationResultSchema` runtime schema** — rejected because no such container schema exists in the codebase; container types are TypeScript-only
- **Add `satisfies` type assertions in tests** — rejected per technical architect: muddies the test's mental model, build already validates type correctness

## Success Criteria
- `OutputGenerationResult` has `lifecycle_states?: LifecycleStatesResult`
- All 4 lifecycle types exported from `src/index.ts`
- All 4 lifecycle schemas exported from `src/schema/index.ts`
- Schema test: valid 7-state result accepted
- Schema test: invalid input rejected
- `npm run build` succeeds
- No regressions
