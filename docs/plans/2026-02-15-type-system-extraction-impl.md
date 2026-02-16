# Extract ProductProfile Type System into packages/core — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract all product profile types from three Convex-coupled source files into a framework-agnostic `@basesignal/core` package, then update existing source files to become thin re-export shims so all existing imports continue to work unchanged.

**Architecture:** `packages/core/src/types/` contains 5 files (`common.ts`, `profile.ts`, `lenses.ts`, `convergence.ts`, `outputs.ts`) plus a barrel `index.ts`. Every export is a pure TypeScript type or interface — zero runtime code, zero framework imports. The existing Convex type files become re-export shims pointing at `@basesignal/core`. The frontend `src/components/product-profile/types.ts` also becomes a re-export shim.

**Tech Stack:** TypeScript (type-only exports), npm workspaces (from S001), Vitest for type-level tests

**Prerequisite:** S001 (monorepo workspace setup) must be complete. `packages/core/` must exist with `package.json`, `tsconfig.json`, and a working build. If S001 has not been implemented yet, the first task in this plan bootstraps the minimal workspace setup needed.

---

## Prerequisite Context

### Source Files (Types Being Extracted)

| File | Exports | Lines |
|------|---------|-------|
| `convex/analysis/lenses/types.ts` | `LensType`, `ConfidenceLevel`, `LensCandidate`, `LensResult`, `AllLensesResult` | 52 |
| `convex/analysis/convergence/types.ts` | `LensType` (different union), `ValidationStatus`, `ValidatedCandidate`, `CandidateCluster`, `ValueMomentTier`, `ValueMoment`, `QualityStatus`, `QualityCheck`, `QualityReport`, `ConvergenceResult` | 71 |
| `convex/analysis/outputs/types.ts` | `ValueMomentPriority`, `ICPProfile`, `ActivationStage`, `StageTransition`, `ActivationMap`, `EntityPropertyDef`, `EntityDefinition`, `UserStateCriterion`, `UserState`, `EventProperty`, `EntityProperty`, `Perspective`, `PerspectiveDistribution`, `MapsTo`, `TrackingEvent`, `MeasurementSpec`, `MeasurementInputData`, `OutputGenerationResult` (plus re-exports: `ValueMoment`, `ValueMomentTier`, `ActivationLevel`, `SignalStrength`) | 158 |
| `convex/analysis/extractActivationLevels.ts` | `SignalStrength`, `ActivationCriterion`, `ActivationLevel`, `ActivationLevelsResult` (types only; also exports runtime functions and actions) | 366 |
| `convex/schema.ts` | `productProfiles` table definition (lines 443-600) — implicit shape, no explicit interface | 652 |
| `convex/productProfiles.ts` | Duplicated validators for section shapes (lines 4-73) | 420 |
| `src/components/product-profile/types.ts` | Duplicated `LensType`, `ValueMomentTier`, `ValueMoment` + re-exports from convex | 33 |

### Files That Import From These Sources

Consumers in `convex/analysis/` (will use re-export shims, no changes needed):
- `convex/analysis/convergence/validateCandidates.ts` — imports from `./types`
- `convex/analysis/convergence/convergeAndTier.ts` — imports from `./types`
- `convex/analysis/convergence/clusterCandidates.ts` — imports from `./types`
- `convex/analysis/outputs/generateActivationMap.ts` — imports `ActivationLevel` from `../extractActivationLevels`
- `convex/analysis/outputs/aggregateActivationInputs.ts` — imports from `../extractActivationLevels`

Consumers in `src/` (will use re-export shims, no changes needed):
- `src/routes/ProductProfilePage.tsx` — imports from `../../convex/analysis/outputs/types` and `@/components/product-profile/types`
- `src/components/product-profile/MeasurementSpecSection.tsx` — imports from `../../../convex/analysis/outputs/types`
- `src/components/product-profile/ICPProfilesSection.tsx` — imports from `../../../convex/analysis/outputs/types`

Test files that import from these sources (continue through shims):
- `convex/analysis/lenses/types.test.ts`
- `convex/analysis/convergence/types.test.ts`
- `convex/analysis/outputs/types.test.ts`
- `src/components/product-profile/MeasurementSpecSection.test.ts`
- `src/components/product-profile/ICPProfilesSection.test.ts`

### Key Decisions from Design Doc

1. **Two distinct LensType unions:** Analytical (`capability_mapping`, etc.) renamed to `AnalyticalLensType`; Experiential (`jtbd`, etc.) renamed to `ExperientialLensType`. Old `LensType` name preserved in re-export shims.
2. **Plain `string` for IDs** — no branded types.
3. **`basesignal_version` on ProductProfile** — no `ProfileMetadata` type.
4. **Discriminated union for activation** preserved: `ActivationDefinition = LegacyActivationDefinition | MultiLevelActivationDefinition`.
5. **All exports are type-only** — no runtime code, no functions, no validation.
6. **SCHEMA_VERSION constant** — the only non-type export: `export const SCHEMA_VERSION = "1.0" as const`.

### Important Shape Discrepancies to Resolve

The convergence `types.test.ts` uses a different `ConvergenceResult` shape than `types.ts` defines (the test has flat fields like `productId`, `tier_1_count`, `validation_stats` while the type has nested `stats` and `clusters`). The canonical source of truth is the **`types.ts` file**, not the test. The core package must match the actual type definitions, not the test fixtures. The test files will continue importing from the shim and may need separate updates outside this story's scope.

Similarly, the `ValidatedCandidate` in the test file has extra fields (`role`, `source_urls`, string `confidence`) not in the actual type definition. The canonical type from `convergence/types.ts` has `confidence: number` and no `role`/`source_urls` fields.

---

## Tasks

### Task 0: Bootstrap packages/core (skip if S001 already complete)

Check if `packages/core/package.json` exists. If not, create the minimal workspace scaffold:

**0a. Add workspaces to root `package.json`:**
Add `"workspaces": ["packages/*"]` to the root `package.json`.

**0b. Create `packages/core/package.json`:**
```json
{
  "name": "@basesignal/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "files": ["src"],
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "vitest": "^4.0.16"
  }
}
```

**0c. Create `packages/core/tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true
  },
  "include": ["src"]
}
```

**0d. Create `packages/core/vitest.config.ts`:**
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**0e. Run `npm install` from root** to wire up workspaces.

**0f. Add `@basesignal/core` as a workspace dependency** in the root `package.json` dependencies:
```json
"@basesignal/core": "*"
```

**0g. Add path alias** to `tsconfig.app.json` so the React app can resolve `@basesignal/core`:
Add to `compilerOptions.paths`:
```json
"@basesignal/core": ["./packages/core/src/index.ts"]
```

And add to the Vite config (`vitest.config.ts` and `vite.config.ts` if separate) resolve aliases:
```typescript
"@basesignal/core": path.resolve(__dirname, "./packages/core/src/index.ts")
```

**Verification:** `cd packages/core && npx tsc --noEmit` succeeds (will pass trivially with empty src/).

---

### Task 1: Create `packages/core/src/types/common.ts`

Create shared primitive types used across multiple domain files.

**File:** `packages/core/src/types/common.ts`

```typescript
/** Source evidence linking a data point to a crawled page. */
export interface Evidence {
  url: string;
  excerpt: string;
}

/** Signal strength for activation levels. */
export type SignalStrength = "weak" | "medium" | "strong" | "very_strong";

/** Qualitative confidence level for lens candidates. */
export type ConfidenceLevel = "high" | "medium" | "low";
```

**Source mapping:**
- `Evidence` — matches `v.object({ url: v.string(), excerpt: v.string() })` in `convex/schema.ts:455`
- `SignalStrength` — from `convex/analysis/extractActivationLevels.ts:8`
- `ConfidenceLevel` — from `convex/analysis/lenses/types.ts:12`

**Verification:** `cd packages/core && npx tsc --noEmit` passes.

---

### Task 2: Create `packages/core/src/types/profile.ts`

Define the root `ProductProfile` interface and all section types. This is the largest file — it maps every section from the `productProfiles` table in `convex/schema.ts`.

**File:** `packages/core/src/types/profile.ts`

Create with all types exactly as specified in the design doc's `types/profile.ts` section (lines 79-272 of the design). Key types:

- `SCHEMA_VERSION = "1.0" as const`
- `ProductProfile` — root interface with optional sections + `basesignal_version`, `completeness`, `overallConfidence`
- `CoreIdentity` — from schema lines 447-456
- `RevenueArchitecture`, `PricingTier` — from schema lines 459-471
- `EntityModel`, `EntityItem`, `EntityRelationship` — from schema lines 475-488
- `UserJourney`, `JourneyStage` — from schema lines 491-499
- `DefinitionsMap`, `ActivationDefinition` (union type), `LegacyActivationDefinition`, `MultiLevelActivationDefinition`, `ActivationLevelDef`, `ActivationCriterion`, `LifecycleDefinition` — from schema lines 502-568
- `OutcomesSection`, `OutcomeItem` — from schema lines 572-580
- `MetricsSection`, `MetricItem` — from schema lines 583-592

Import `Evidence` and `SignalStrength` from `./common`.

**Critical detail:** The `ActivationDefinition` union must match the schema exactly:
- Legacy format: has `criteria: string[]`, `timeWindow?`, `reasoning`, `confidence`, `source`, `evidence`
- Multi-level format: has `levels: ActivationLevelDef[]`, `primaryActivation?`, `overallConfidence`

Every exported interface must have a JSDoc comment.

**Verification:** `cd packages/core && npx tsc --noEmit` passes.

---

### Task 3: Create `packages/core/src/types/lenses.ts`

Define analytical lens pipeline types.

**File:** `packages/core/src/types/lenses.ts`

Types to create (sourced from `convex/analysis/lenses/types.ts`):
- `AnalyticalLensType` — renamed from `LensType`, same 7 values: `capability_mapping`, `effort_elimination`, `info_asymmetry`, `decision_enablement`, `state_transitions`, `time_compression`, `artifact_creation`
- `LensCandidate` — exact match of current type (uses `AnalyticalLensType` for `lens` field, `ConfidenceLevel` for `confidence`)
- `LensResult` — exact match
- `AllLensesResult` — exact match

Import `ConfidenceLevel` from `./common`.

Every exported interface/type must have a JSDoc comment.

**Verification:** `cd packages/core && npx tsc --noEmit` passes.

---

### Task 4: Create `packages/core/src/types/convergence.ts`

Define convergence pipeline types.

**File:** `packages/core/src/types/convergence.ts`

Types to create (sourced from `convex/analysis/convergence/types.ts`):
- `ExperientialLensType` — renamed from `LensType`, same 7 values: `jtbd`, `outcomes`, `pains`, `gains`, `alternatives`, `workflows`, `emotions`
- `ValidationStatus` — `"valid" | "rewritten" | "removed"`
- `ValidatedCandidate` — exact match of current type: `id`, `lens: ExperientialLensType`, `name`, `description`, `confidence: number`, `validation_status`, `validation_issue?`, `rewritten_from?: { name: string; description: string }`
- `CandidateCluster` — exact match
- `ValueMomentTier` — `1 | 2 | 3`
- `ValueMoment` — exact match (uses `ExperientialLensType` for `lenses`)
- `QualityStatus`, `QualityCheck`, `QualityReport` — exact match
- `ConvergenceResult` — exact match of current type (has `value_moments`, `clusters`, `stats` object, optional `quality`)

Every exported interface/type must have a JSDoc comment.

**Verification:** `cd packages/core && npx tsc --noEmit` passes.

---

### Task 5: Create `packages/core/src/types/outputs.ts`

Define generated output types.

**File:** `packages/core/src/types/outputs.ts`

Types to create (sourced from `convex/analysis/outputs/types.ts` and `convex/analysis/extractActivationLevels.ts`):

Import from siblings:
- `SignalStrength` from `./common`
- `ValueMoment`, `ValueMomentTier` from `./convergence`

Re-export for convenience:
- `ValueMoment`, `ValueMomentTier`, `SignalStrength`

Types:
- `ValueMomentPriority` — exact match
- `ICPProfile` — exact match
- `ActivationStage` — exact match
- `StageTransition` — exact match
- `ActivationMap` — exact match
- `EntityPropertyDef` — exact match
- `EntityDefinition` — exact match
- `UserStateCriterion` — exact match
- `UserState` — exact match
- `EventProperty` — exact match (same shape as `EntityPropertyDef`)
- `Perspective` — exact match
- `PerspectiveDistribution` — exact match
- `MapsTo` — exact match (discriminated union)
- `TrackingEvent` — exact match
- `MeasurementSpec` — exact match
- `ActivationLevel` — from `extractActivationLevels.ts`, uses inline `Evidence`-shaped evidence array
- `ActivationCriterion` — from `extractActivationLevels.ts` (already defined in profile.ts for the definitions section; re-export or duplicate — prefer import from `./profile` if identical)
- `MeasurementInputData` — exact match
- `OutputGenerationResult` — exact match

Every exported interface/type must have a JSDoc comment.

**Verification:** `cd packages/core && npx tsc --noEmit` passes.

---

### Task 6: Create `packages/core/src/index.ts`

Barrel file re-exporting all public types and the `SCHEMA_VERSION` constant.

**File:** `packages/core/src/index.ts`

Use `export type { ... } from "./types/..."` for all types and `export { SCHEMA_VERSION } from "./types/profile"` for the constant. Follow the exact structure from the design doc (lines 588-661).

**Verification:**
- `cd packages/core && npx tsc --noEmit` passes.
- `grep -r "convex/" packages/core/src/` returns zero results.
- `grep -r "@clerk/" packages/core/src/` returns zero results.
- `grep -r "react" packages/core/src/` returns zero results.

---

### Task 7: Create type-level tests in `packages/core/src/types/__tests__/`

Create test files that verify every exported type is importable and assignable. These are structural tests — they create valid instances of each type and assert on their fields. They serve as both documentation and compile-time verification.

**File:** `packages/core/src/types/__tests__/profile.test.ts`

Test:
- `ProductProfile` with all sections populated (identity, revenue, entities, journey, definitions, outcomes, metrics)
- Each section type independently
- `ActivationDefinition` union: both legacy and multi-level variants
- `SCHEMA_VERSION` equals `"1.0"`

**File:** `packages/core/src/types/__tests__/lenses.test.ts`

Test:
- `AnalyticalLensType` includes all 7 values
- `LensCandidate` with all shared and optional fields
- `LensResult` and `AllLensesResult`

**File:** `packages/core/src/types/__tests__/convergence.test.ts`

Test:
- `ExperientialLensType` includes all 7 values
- `ValidatedCandidate` with validation status variants
- `ValueMoment` with all fields
- `ConvergenceResult` with stats and quality

**File:** `packages/core/src/types/__tests__/outputs.test.ts`

Test:
- `ICPProfile`, `ActivationMap`, `MeasurementSpec` with all nested types
- `MapsTo` discriminated union (all 3 variants)
- `OutputGenerationResult` wrapping all three output artifacts

**File:** `packages/core/src/types/__tests__/common.test.ts`

Test:
- `Evidence`, `SignalStrength`, `ConfidenceLevel`

**Verification:** `cd packages/core && npx vitest run` — all tests pass.

---

### Task 8: Update `convex/analysis/lenses/types.ts` to re-export from core

Replace the file contents with a re-export shim. Preserve the `LensType` name for backward compatibility by aliasing `AnalyticalLensType`.

**File:** `convex/analysis/lenses/types.ts`

```typescript
// Re-export all lens types from the core package.
// LensType is preserved as an alias for backward compatibility.
export type {
  AnalyticalLensType as LensType,
  ConfidenceLevel,
  LensCandidate,
  LensResult,
  AllLensesResult,
} from "@basesignal/core";
```

**Verification:** Existing test `convex/analysis/lenses/types.test.ts` still passes (imports `LensType` which now resolves through the shim). Run `npm test -- convex/analysis/lenses/types.test.ts`.

---

### Task 9: Update `convex/analysis/convergence/types.ts` to re-export from core

Replace the file contents with a re-export shim. Preserve the `LensType` name for backward compatibility by aliasing `ExperientialLensType`.

**File:** `convex/analysis/convergence/types.ts`

```typescript
// Re-export all convergence types from the core package.
// LensType is preserved as an alias for backward compatibility.
export type {
  ExperientialLensType as LensType,
  ValidationStatus,
  ValidatedCandidate,
  CandidateCluster,
  ValueMomentTier,
  ValueMoment,
  QualityStatus,
  QualityCheck,
  QualityReport,
  ConvergenceResult,
} from "@basesignal/core";
```

**Verification:** Run `npm test -- convex/analysis/convergence/types.test.ts` — check if it passes. The test file uses a different `ConvergenceResult` shape than the actual type, so it may have been already broken or relying on `as any` casts. If it passes before and after, this is a clean swap. If it fails, note the failure but do not fix — the test was testing a stale shape.

---

### Task 10: Update `convex/analysis/outputs/types.ts` to re-export from core

Replace the file contents with a re-export shim. This file currently imports from `../convergence/types` and `../extractActivationLevels` — those imports are no longer needed since everything comes from core.

**File:** `convex/analysis/outputs/types.ts`

```typescript
// Re-export all output types from the core package.
export type {
  // Upstream re-exports
  ValueMoment,
  ValueMomentTier,
  SignalStrength,

  // ICP types
  ValueMomentPriority,
  ICPProfile,

  // Activation Map types
  ActivationStage,
  StageTransition,
  ActivationMap,

  // Entity/Property types
  EntityPropertyDef,
  EntityDefinition,
  EventProperty,
  Perspective,
  PerspectiveDistribution,

  // Tracking Event types
  MapsTo,
  TrackingEvent,

  // Measurement Spec
  MeasurementSpec,
  UserStateCriterion,
  UserState,

  // Input/Output containers
  MeasurementInputData,
  OutputGenerationResult,

  // Activation levels (from extractActivationLevels)
  ActivationLevel,
} from "@basesignal/core";

// Backward compatibility: EntityProperty was a type alias for EntityPropertyDef
export type { EntityPropertyDef as EntityProperty } from "@basesignal/core";
```

**Verification:** Run `npm test -- convex/analysis/outputs/types.test.ts` — all tests pass.

---

### Task 11: Update `src/components/product-profile/types.ts` to re-export from core

Replace the file contents with a re-export shim. This eliminates the duplicated `LensType`, `ValueMomentTier`, and `ValueMoment` types and the deep relative import.

**File:** `src/components/product-profile/types.ts`

```typescript
// Re-export product profile types from the core package.
export type {
  ExperientialLensType as LensType,
  ValueMomentTier,
  ValueMoment,
  ActivationMap,
  ActivationStage,
  StageTransition,
  SignalStrength,
} from "@basesignal/core";
```

**Verification:** Run `npm test -- src/components/product-profile/` — tests pass. The `ProductProfilePage.tsx` imports from both this file and the convex outputs file — both are now backed by the same core types.

---

### Task 12: Full test suite verification

Run the complete test suite to verify nothing is broken:

```bash
npm test -- --run
```

**Check specifically:**
1. `packages/core` tests: `cd packages/core && npx vitest run` — all pass
2. Convex analysis tests: `npm test -- convex/analysis/ --run` — all pass
3. Frontend component tests: `npm test -- src/components/product-profile/ --run` — all pass
4. No forbidden imports: `grep -r "from ['\"]convex/" packages/core/src/` returns nothing
5. No framework imports: `grep -r "from ['\"]react" packages/core/src/` returns nothing
6. JSDoc coverage: every exported interface/type in `packages/core/src/types/*.ts` has a `/** ... */` comment

If any tests fail due to the shape discrepancies noted in the prerequisite section (convergence test using stale ConvergenceResult shape), log the failure but do not modify the test — those are pre-existing issues outside this story's scope.

---

## File Summary

### New Files Created

| File | Purpose |
|------|---------|
| `packages/core/src/types/common.ts` | Evidence, SignalStrength, ConfidenceLevel |
| `packages/core/src/types/profile.ts` | ProductProfile root + all section types |
| `packages/core/src/types/lenses.ts` | AnalyticalLensType, LensCandidate, LensResult, AllLensesResult |
| `packages/core/src/types/convergence.ts` | ExperientialLensType, ValidatedCandidate, ValueMoment, ConvergenceResult |
| `packages/core/src/types/outputs.ts` | ICPProfile, ActivationMap, MeasurementSpec, and all sub-types |
| `packages/core/src/index.ts` | Barrel re-export of all public types + SCHEMA_VERSION |
| `packages/core/src/types/__tests__/common.test.ts` | Tests for common primitives |
| `packages/core/src/types/__tests__/profile.test.ts` | Tests for profile types |
| `packages/core/src/types/__tests__/lenses.test.ts` | Tests for lens types |
| `packages/core/src/types/__tests__/convergence.test.ts` | Tests for convergence types |
| `packages/core/src/types/__tests__/outputs.test.ts` | Tests for output types |

### New Files Created (if S001 not done)

| File | Purpose |
|------|---------|
| `packages/core/package.json` | Package configuration |
| `packages/core/tsconfig.json` | TypeScript config |
| `packages/core/vitest.config.ts` | Test runner config |

### Existing Files Modified

| File | Change |
|------|--------|
| `package.json` | Add `workspaces` field (if S001 not done) and `@basesignal/core` dependency |
| `tsconfig.app.json` | Add `@basesignal/core` path alias |
| `vitest.config.ts` | Add `@basesignal/core` resolve alias |
| `convex/analysis/lenses/types.ts` | Replace definitions with re-export shim from `@basesignal/core` |
| `convex/analysis/convergence/types.ts` | Replace definitions with re-export shim from `@basesignal/core` |
| `convex/analysis/outputs/types.ts` | Replace definitions with re-export shim from `@basesignal/core` |
| `src/components/product-profile/types.ts` | Replace definitions with re-export shim from `@basesignal/core` |

### Files NOT Modified

| File | Reason |
|------|--------|
| `convex/schema.ts` | Convex validators stay as-is (design doc: "No changes to the Convex schema") |
| `convex/productProfiles.ts` | Convex validators stay as-is |
| `convex/analysis/extractActivationLevels.ts` | Runtime code stays; types are extracted but the file keeps its own copies (consumers that import `ActivationLevel` and `SignalStrength` from here will continue to work; making this file a re-export shim is deferred since it also exports functions and Convex actions) |
| Any test files in `convex/analysis/` | They import from the shim files which re-export from core — no import path changes needed |
| Any component files in `src/` | They import from the shim files — no import path changes needed |
