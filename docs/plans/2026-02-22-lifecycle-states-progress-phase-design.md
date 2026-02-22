# Lifecycle States Progress Phase and OutputsResult Field Design

## Overview
Add `lifecycle_states` as a recognized pipeline phase and output field across two files in the mcp-server analysis package. Pure type-addition task: seven insertions across two files, no logic changes.

## Problem Statement
The pipeline needs to track lifecycle states generation as a progress phase and carry the result through OutputsResult and PipelineOutputs. Without these type additions, the lifecycle states generator (M010-E002) cannot be wired into the pipeline (M010-E003-S002).

## Expert Perspectives

### Product
- Lifecycle states is a first-class pipeline output, tracked like ICP profiles and measurement specs
- Type-first approach enforces dependency at compile time, prevents runtime errors

### Technical
- Use `LifecycleStatesResult | null` (not `any`) in both `PipelineOutputs` and `OutputsResult` — the `any` on `activation_map` in `PipelineOutputs` is tech debt, not an intentional pattern
- The asymmetry between `activation_map: any` and `lifecycle_states: LifecycleStatesResult | null` reflects a real difference in maturity, not an inconsistency — all generators should eventually produce typed outputs
- Both interfaces represent the same semantic value (pipeline outputs); keeping them in sync with precise types reduces cognitive overhead
- Import `LifecycleStatesResult` from `@basesignal/core` in types.ts, re-export it, re-import from `"../types.js"` in outputs/index.ts (consistent with existing pattern)

### Simplification Review
- Removed proposed TODO comment on `activation_map: any` — scope creep; if tech debt removal matters, it deserves its own story
- Nothing else to remove or simplify — design is minimal and inevitable
- Every type addition serves the acceptance criteria with zero decoration

## Proposed Solution
Seven surgical additions across two files, no behavioral changes:

### File 1: `packages/mcp-server/src/analysis/types.ts`
1. Add `LifecycleStatesResult` to the existing `@basesignal/core` import block
2. Add `LifecycleStatesResult` to the re-export block
3. Add `| "outputs_lifecycle_states"` to the `ProgressPhase` union (after `"outputs_measurement_spec"`)
4. Add `lifecycle_states: LifecycleStatesResult | null;` to the `PipelineOutputs` interface (after `measurement_spec`)

### File 2: `packages/mcp-server/src/analysis/outputs/index.ts`
5. Add `LifecycleStatesResult` to the import from `"../types.js"`
6. Add `lifecycle_states: LifecycleStatesResult | null;` to the `OutputsResult` interface (after `measurement_spec`)
7. Add `lifecycle_states: null,` to the result object literal in `generateAllOutputs` (after `measurement_spec: null,`)

## Alternatives Considered
- **Use `any` for PipelineOutputs** (matching activation_map pattern): Rejected — perpetuates tech debt unnecessarily for a new type with no string-mismatch issue.
- **Import LifecycleStatesResult directly from @basesignal/core in outputs/index.ts**: Rejected — existing pattern imports from `"../types.js"` which re-exports core types.
- **Add TODO comment on activation_map: any**: Rejected by reviewer — scope creep that belongs in its own story.

## Success Criteria
- `npm run build` succeeds with no type errors (build must succeed only after basesignal-34m completes — if importing LifecycleStatesResult fails, the dependency is incomplete)
- ProgressPhase includes `'outputs_lifecycle_states'`
- OutputsResult has `lifecycle_states: LifecycleStatesResult | null`
- PipelineOutputs has `lifecycle_states: LifecycleStatesResult | null`
- No regressions in existing tests

## Dependencies
- **Requires:** basesignal-34m (M010-E001-S003) must export `LifecycleStatesResult` from `@basesignal/core` first
- **Unblocks:** basesignal-o0e (M010-E003-S002) which wires the generator into the pipeline
