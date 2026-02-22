# Implementation Plan: M010-E003-S001 — Add Lifecycle States Progress Phase and OutputsResult Field

**Task:** basesignal-kgv
**Design doc:** `docs/plans/2026-02-22-lifecycle-states-progress-phase-design.md`
**Dependency:** basesignal-34m (M010-E001-S003) must complete first — exports `LifecycleStatesResult` from `@basesignal/core`
**Unblocks:** basesignal-o0e (M010-E003-S002) — wires generator into pipeline

## Overview

Seven surgical type additions across two files. No logic changes, no new files, no tests needed (pure type additions verified by `npm run build`).

## Tasks

### Task 1: Add `LifecycleStatesResult` to imports in `types.ts`

**File:** `packages/mcp-server/src/analysis/types.ts`
**Location:** Line 20–26 (the `@basesignal/core` import block for output types)

Add `LifecycleStatesResult` to the existing import:

```typescript
import type {
  ICPProfile,
  ActivationMap,
  MeasurementSpec,
  ActivationLevel,
  ValidatedCandidate,
  LifecycleStatesResult,   // <-- ADD
} from "@basesignal/core";
```

### Task 2: Add `LifecycleStatesResult` to re-export block in `types.ts`

**File:** `packages/mcp-server/src/analysis/types.ts`
**Location:** Line 29–42 (the re-export block)

Add `LifecycleStatesResult` to the re-export:

```typescript
export type {
  LlmProvider,
  LlmMessage,
  LlmOptions,
  LensCandidate,
  AnalyticalLensType,
  ConvergenceResult,
  ValueMoment,
  ValidatedCandidate,
  ICPProfile,
  ActivationMap,
  MeasurementSpec,
  ActivationLevel,
  LifecycleStatesResult,   // <-- ADD
};
```

### Task 3: Add `outputs_lifecycle_states` to `ProgressPhase` union in `types.ts`

**File:** `packages/mcp-server/src/analysis/types.ts`
**Location:** Line 75 (after `"outputs_measurement_spec"`)

```typescript
export type ProgressPhase =
  | "identity"
  | "activation_levels"
  | "lenses_batch1"
  | "lenses_batch2"
  | "validation"
  | "clustering"
  | "convergence"
  | "outputs_icp"
  | "outputs_activation_map"
  | "outputs_measurement_spec"
  | "outputs_lifecycle_states";   // <-- ADD
```

### Task 4: Add `lifecycle_states` field to `PipelineOutputs` in `types.ts`

**File:** `packages/mcp-server/src/analysis/types.ts`
**Location:** Line 130 (after `measurement_spec: MeasurementSpec | null;`)

```typescript
export interface PipelineOutputs {
  icp_profiles: ICPProfile[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activation_map: any;
  measurement_spec: MeasurementSpec | null;
  lifecycle_states: LifecycleStatesResult | null;   // <-- ADD
}
```

### Task 5: Add `LifecycleStatesResult` to import in `outputs/index.ts`

**File:** `packages/mcp-server/src/analysis/outputs/index.ts`
**Location:** Line 3 (the import from `"../types.js"`)

```typescript
import type { LlmProvider, OnProgress, PipelineError, ConvergenceResult, ICPProfile, IdentityResult, ActivationLevelsResult, MeasurementSpec, LifecycleStatesResult } from "../types.js";
```

### Task 6: Add `lifecycle_states` field to `OutputsResult` in `outputs/index.ts`

**File:** `packages/mcp-server/src/analysis/outputs/index.ts`
**Location:** Line 16 (after `measurement_spec: MeasurementSpec | null;`)

```typescript
export interface OutputsResult {
  icp_profiles: ICPProfile[];
  activation_map: ActivationMapResult | null;
  measurement_spec: MeasurementSpec | null;
  lifecycle_states: LifecycleStatesResult | null;   // <-- ADD
}
```

### Task 7: Add `lifecycle_states: null` to result object in `generateAllOutputs`

**File:** `packages/mcp-server/src/analysis/outputs/index.ts`
**Location:** Line 33 (after `measurement_spec: null,`)

```typescript
const result: OutputsResult = {
  icp_profiles: [],
  activation_map: null,
  measurement_spec: null,
  lifecycle_states: null,   // <-- ADD
};
```

## Verification

```bash
# Build must succeed (only after basesignal-34m completes)
npm run build -w packages/mcp-server

# Existing tests must pass
npm run test:run -w packages/mcp-server
```

## Notes

- No new tests needed — this is a pure type-addition task; build success is the verification
- `LifecycleStatesResult | null` (not `any`) — the `any` on `activation_map` is tech debt, not a pattern to follow
- Import chain: `@basesignal/core` → `types.ts` re-export → `outputs/index.ts` import from `"../types.js"` (existing convention)
