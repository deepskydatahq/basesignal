# M008-E001-S002: Extract ProductProfile Type System into packages/core

## Overview

Extract all product profile types from three Convex-coupled source files into a single, framework-agnostic `@basesignal/core` package. The types become the canonical source of truth that both the existing Convex app and future open-source consumers import from, with zero runtime dependencies.

## Problem Statement

The ProductProfile type system is currently scattered across three files inside the Convex backend directory:

- `convex/analysis/outputs/types.ts` -- ICPProfile, ActivationMap, MeasurementSpec, and supporting types
- `convex/analysis/lenses/types.ts` -- LensCandidate, LensResult, AllLensesResult
- `convex/analysis/convergence/types.ts` -- ValidatedCandidate, ValueMoment, ConvergenceResult, quality types

Additionally, the ProductProfile shape itself is defined only as a Convex schema validator in `convex/schema.ts` (the `productProfiles` table) with duplicated validator objects in `convex/productProfiles.ts`. There is no standalone TypeScript interface for the full ProductProfile -- it exists only as an inferred Convex `Doc<"productProfiles">` type, which includes `_id` and `_creationTime` and uses `Id<"products">` for the foreign key.

The frontend has already started duplicating types: `src/components/product-profile/types.ts` manually mirrors `ValueMoment` and `LensType` from the convergence pipeline and re-exports `ActivationMap` from the outputs file via a relative path three directories deep.

This coupling prevents:
1. Publishing the schema as a standalone npm package
2. Using the types outside of the Convex/React ecosystem
3. Non-TypeScript consumers from understanding the schema (blocks JSON Schema generation in S004)

## Expert Perspectives

### Technical Architect

The core question is: what is the minimal set of types that defines a ProductProfile? The answer is surprisingly clean -- a ProductProfile is a tree of about 10 section types, plus 3 pipeline output types. The real work is not inventing new abstractions but stripping away the storage-layer coupling (`v.id()`, `Doc<>`, Convex validators) and letting plain TypeScript interfaces stand on their own. The `definitions` section with its union type (legacy flat vs. multi-level activation) is the only genuinely complex shape; everything else is straightforward nested objects.

Key insight: the `LensType` union is defined differently in two files. The lenses pipeline uses 7 analytical lens types (`capability_mapping`, `effort_elimination`, etc.) while the convergence pipeline uses 7 experiential lens types (`jtbd`, `outcomes`, `pains`, etc.). These are distinct domain concepts and should remain separate types, not merged. Name them `AnalyticalLensType` and `ExperientialLensType` in the core package to eliminate confusion.

### Simplification Reviewer

**Verdict: APPROVED with cuts**

What to remove:
- **Do NOT create branded types.** Plain `string` for IDs is correct at this stage. Branded types add ceremony without value when there is no runtime validation layer yet (that is S003's job).
- **Do NOT create a `ProfileMetadata` type.** The story hints at adding `created`, `updated`, `source` metadata. Keep it to two fields (`basesignal_version` and `schema_version`) on the root `ProductProfile` interface. Timestamps and provenance belong to the storage layer, not the schema.
- **Do NOT re-export everything from a barrel `index.ts`.** Organize by domain (profile, lenses, convergence, outputs) and let consumers import from subpaths. A single flat namespace with 40+ exports becomes unnavigable.
- **Do NOT introduce type helpers, utility types, or builder patterns.** Pure data interfaces only. Utility functions belong in S005 (analysis-utilities).

What feels inevitable: the profile sections (`CoreIdentity`, `RevenueArchitecture`, `EntityModel`, `UserJourney`, `DefinitionsMap`, `OutcomesSection`, `MetricsSection`) map 1:1 to the existing Convex schema sections. This is the right structure -- it matches how data actually flows through the system.

## Proposed Solution

### File Structure

```
packages/core/src/
  index.ts                      # Main entry: re-exports all public types
  types/
    profile.ts                  # ProductProfile root + section types
    lenses.ts                   # LensCandidate, AnalyticalLensType, ExperientialLensType
    convergence.ts              # ValidatedCandidate, ValueMoment, ConvergenceResult
    outputs.ts                  # ICPProfile, ActivationMap, MeasurementSpec
    common.ts                   # Evidence, SignalStrength, ConfidenceLevel -- shared primitives
```

### Key Types

#### `types/common.ts` -- Shared Primitives

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

#### `types/profile.ts` -- ProductProfile Root

```typescript
import type { Evidence } from "./common";

/** Schema version for forward compatibility. */
export const SCHEMA_VERSION = "1.0" as const;

/** Root container for a fully analyzed product profile. */
export interface ProductProfile {
  /** Semver-compatible schema version. */
  basesignal_version: string;

  /** Core product identity extracted from website. */
  identity?: CoreIdentity;

  /** Revenue model and pricing architecture. */
  revenue?: RevenueArchitecture;

  /** Data entities the product manages. */
  entities?: EntityModel;

  /** User journey stages from first touch to expansion. */
  journey?: UserJourney;

  /** Behavioral definitions for user lifecycle states. */
  definitions?: DefinitionsMap;

  /** Business outcomes the product enables. */
  outcomes?: OutcomesSection;

  /** Key metrics for measuring product performance. */
  metrics?: MetricsSection;

  /** Computed: fraction of sections populated (0-1). */
  completeness: number;

  /** Computed: weighted average confidence across populated sections (0-1). */
  overallConfidence: number;
}

/** Core product identity. */
export interface CoreIdentity {
  productName: string;
  description: string;
  targetCustomer: string;
  businessModel: string;
  industry?: string;
  companyStage?: string;
  confidence: number;
  evidence: Evidence[];
}

/** Revenue model, pricing tiers, and expansion/contraction paths. */
export interface RevenueArchitecture {
  model: string;
  billingUnit?: string;
  hasFreeTier: boolean;
  tiers: PricingTier[];
  expansionPaths: string[];
  contractionRisks: string[];
  confidence: number;
  evidence: Evidence[];
}

export interface PricingTier {
  name: string;
  price: string;
  features: string[];
}

/** Entity model: the core data objects the product manages. */
export interface EntityModel {
  items: EntityItem[];
  relationships: EntityRelationship[];
  confidence: number;
  evidence: Evidence[];
}

export interface EntityItem {
  name: string;
  type: string;
  properties: string[];
}

export interface EntityRelationship {
  from: string;
  to: string;
  type: string;
}

/** User journey stages. */
export interface UserJourney {
  stages: JourneyStage[];
  confidence: number;
  evidence: Evidence[];
}

export interface JourneyStage {
  name: string;
  description: string;
  order: number;
}

/** Behavioral definitions for lifecycle states. */
export interface DefinitionsMap {
  activation?: ActivationDefinition;
  firstValue?: LifecycleDefinition;
  active?: LifecycleDefinition;
  atRisk?: LifecycleDefinition;
  churn?: LifecycleDefinition;
}

/** Legacy flat activation definition. */
export interface LifecycleDefinition {
  criteria: string[];
  timeWindow?: string;
  reasoning: string;
  confidence: number;
  source: string;
  evidence: Evidence[];
  /** Present only on firstValue definitions. */
  description?: string;
}

/** Activation criterion for multi-level activation. */
export interface ActivationCriterion {
  action: string;
  count: number;
  timeWindow?: string;
}

/** Single activation level within multi-level activation. */
export interface ActivationLevelDef {
  level: number;
  name: string;
  signalStrength: SignalStrength;
  criteria: ActivationCriterion[];
  reasoning: string;
  confidence: number;
  evidence: Evidence[];
}

/**
 * Activation definition -- supports both legacy flat format
 * and the newer multi-level format as a discriminated union.
 */
export type ActivationDefinition = LegacyActivationDefinition | MultiLevelActivationDefinition;

/** Legacy flat activation format. */
export interface LegacyActivationDefinition {
  criteria: string[];
  timeWindow?: string;
  reasoning: string;
  confidence: number;
  source: string;
  evidence: Evidence[];
}

/** Multi-level activation format with progressive signal strengths. */
export interface MultiLevelActivationDefinition {
  levels: ActivationLevelDef[];
  primaryActivation?: number;
  overallConfidence: number;
}

/** Outcomes section. */
export interface OutcomesSection {
  items: OutcomeItem[];
  confidence: number;
  evidence: Evidence[];
}

export interface OutcomeItem {
  description: string;
  type: string;
  linkedFeatures: string[];
}

/** Metrics section. */
export interface MetricsSection {
  items: MetricItem[];
  confidence: number;
  evidence: Evidence[];
}

export interface MetricItem {
  name: string;
  category: string;
  formula?: string;
  linkedTo: string[];
}

// Re-export SignalStrength for activation levels
import type { SignalStrength } from "./common";
```

#### `types/lenses.ts` -- Lens Pipeline Types

```typescript
import type { ConfidenceLevel } from "./common";

/**
 * Analytical lens types used during initial extraction.
 * Each lens examines the product from a different angle.
 */
export type AnalyticalLensType =
  | "capability_mapping"
  | "effort_elimination"
  | "info_asymmetry"
  | "decision_enablement"
  | "state_transitions"
  | "time_compression"
  | "artifact_creation";

/** A candidate value moment discovered through a single lens. */
export interface LensCandidate {
  id: string;
  lens: AnalyticalLensType;
  name: string;
  description: string;
  role: string;
  confidence: ConfidenceLevel;
  source_urls: string[];

  // Lens-specific optional fields
  enabling_features?: string[];
  effort_eliminated?: string;
  information_gained?: string;
  decision_enabled?: string;
  state_transition?: string;
  time_compression?: string;
  artifact_type?: string;
}

/** Result from running a single analytical lens. */
export interface LensResult {
  lens: AnalyticalLensType;
  candidates: LensCandidate[];
  candidate_count: number;
  execution_time_ms: number;
}

/** Aggregated result from running all analytical lenses. */
export interface AllLensesResult {
  productId: string;
  candidates: LensCandidate[];
  per_lens: Array<{
    lens: AnalyticalLensType;
    candidate_count: number;
    execution_time_ms: number;
  }>;
  total_candidates: number;
  execution_time_ms: number;
  errors: Array<{ lens: AnalyticalLensType; error: string }>;
}
```

#### `types/convergence.ts` -- Convergence Pipeline Types

```typescript
/**
 * Experiential lens types used after validation and clustering.
 * These represent the user experience dimensions.
 */
export type ExperientialLensType =
  | "jtbd"
  | "outcomes"
  | "pains"
  | "gains"
  | "alternatives"
  | "workflows"
  | "emotions";

/** Validation status after quality checks. */
export type ValidationStatus = "valid" | "rewritten" | "removed";

/** A candidate that has passed through validation. */
export interface ValidatedCandidate {
  id: string;
  lens: ExperientialLensType;
  name: string;
  description: string;
  confidence: number;
  validation_status: ValidationStatus;
  validation_issue?: string;
  rewritten_from?: { name: string; description: string };
}

/** A cluster of semantically related candidates. */
export interface CandidateCluster {
  cluster_id: string;
  candidates: ValidatedCandidate[];
  lens_count: number;
  lenses: ExperientialLensType[];
}

/** Tier classification for value moments (1 = highest convergence). */
export type ValueMomentTier = 1 | 2 | 3;

/** A converged value moment distilled from multiple candidates. */
export interface ValueMoment {
  id: string;
  name: string;
  description: string;
  tier: ValueMomentTier;
  lenses: ExperientialLensType[];
  lens_count: number;
  roles: string[];
  product_surfaces: string[];
  contributing_candidates: string[];
}

/** Quality check status. */
export type QualityStatus = "pass" | "warn" | "fail";

/** Individual quality check result. */
export interface QualityCheck {
  name: string;
  status: QualityStatus;
  message: string;
}

/** Quality report across all checks. */
export interface QualityReport {
  overall: QualityStatus;
  checks: QualityCheck[];
}

/** Full result of the convergence pipeline. */
export interface ConvergenceResult {
  value_moments: ValueMoment[];
  clusters: CandidateCluster[];
  stats: {
    total_candidates: number;
    total_clusters: number;
    total_moments: number;
    tier_1_count: number;
    tier_2_count: number;
    tier_3_count: number;
  };
  quality?: QualityReport;
}
```

#### `types/outputs.ts` -- Generated Output Types

```typescript
import type { SignalStrength } from "./common";
import type { ValueMoment, ValueMomentTier } from "./convergence";

// Re-export for convenience
export type { ValueMoment, ValueMomentTier, SignalStrength };

/** Priority ranking of a value moment for a specific ICP. */
export interface ValueMomentPriority {
  moment_id: string;
  priority: 1 | 2 | 3;
  relevance_reason: string;
}

/** Ideal Customer Profile derived from value moment analysis. */
export interface ICPProfile {
  id: string;
  name: string;
  description: string;
  value_moment_priorities: ValueMomentPriority[];
  activation_triggers: string[];
  pain_points: string[];
  success_metrics: string[];
  confidence: number;
  sources: string[];
}

/** A stage in the activation progression. */
export interface ActivationStage {
  level: number;
  name: string;
  signal_strength: SignalStrength;
  trigger_events: string[];
  value_moments_unlocked: string[];
  drop_off_risk: "low" | "medium" | "high";
  drop_off_reasons?: string[];
}

/** Transition between activation stages. */
export interface StageTransition {
  from_level: number;
  to_level: number;
  trigger_events: string[];
  typical_timeframe?: string;
}

/** Multi-stage activation map showing progression from trial to power user. */
export interface ActivationMap {
  stages: ActivationStage[];
  transitions: StageTransition[];
  primary_activation_level: number;
  confidence: number;
  sources: string[];
}

/** Property definition for a tracking entity or event. */
export interface EntityPropertyDef {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  description: string;
  isRequired: boolean;
}

/** Entity definition in the measurement spec. */
export interface EntityDefinition {
  id: string;
  name: string;
  description: string;
  isHeartbeat: boolean;
  properties: EntityPropertyDef[];
}

/** Criterion for determining a user state. */
export interface UserStateCriterion {
  event_name: string;
  condition: string;
}

/** A user lifecycle state definition. */
export interface UserState {
  name: string;
  definition: string;
  criteria: UserStateCriterion[];
}

/** Property on a tracking event. */
export type EventProperty = EntityPropertyDef;

/** Perspective from which an event is observed. */
export type Perspective = "customer" | "product" | "interaction";

/** Distribution of events across perspectives. */
export interface PerspectiveDistribution {
  customer: number;
  product: number;
  interaction: number;
}

/** What a tracking event maps to in the value framework. */
export type MapsTo =
  | { type: "value_moment"; moment_id: string }
  | { type: "activation_level"; activation_level: number }
  | { type: "both"; moment_id: string; activation_level: number };

/** A tracking event in the measurement specification. */
export interface TrackingEvent {
  name: string;
  entity_id: string;
  description: string;
  perspective: Perspective;
  properties: EventProperty[];
  trigger_condition: string;
  maps_to: MapsTo;
  category: string;
}

/** Complete measurement specification: entities, events, states, and coverage. */
export interface MeasurementSpec {
  entities: EntityDefinition[];
  events: TrackingEvent[];
  total_events: number;
  coverage: {
    activation_levels_covered: number[];
    value_moments_covered: string[];
    perspective_distribution: PerspectiveDistribution;
  };
  userStateModel: UserState[];
  confidence: number;
  sources: string[];
  warnings?: string[];
}

/** Activation level used as input to measurement spec generation. */
export interface ActivationLevel {
  level: number;
  name: string;
  signalStrength: SignalStrength;
  criteria: Array<{ action: string; count: number; timeWindow?: string }>;
  reasoning: string;
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

/** Input data bundle for measurement spec generation. */
export interface MeasurementInputData {
  value_moments: ValueMoment[];
  activation_levels: ActivationLevel[];
  icp_profiles: ICPProfile[];
  activation_map: ActivationMap;
}

/** Result container from the full output generation pipeline. */
export interface OutputGenerationResult {
  productId: string;
  icp_profiles: ICPProfile[];
  activation_map: ActivationMap;
  measurement_spec: MeasurementSpec;
  generated_at: string;
  execution_time_ms: number;
}
```

#### `index.ts` -- Package Entry Point

```typescript
// ProductProfile and section types
export type {
  ProductProfile,
  CoreIdentity,
  RevenueArchitecture,
  PricingTier,
  EntityModel,
  EntityItem,
  EntityRelationship,
  UserJourney,
  JourneyStage,
  DefinitionsMap,
  ActivationDefinition,
  LegacyActivationDefinition,
  MultiLevelActivationDefinition,
  ActivationLevelDef,
  ActivationCriterion,
  LifecycleDefinition,
  OutcomesSection,
  OutcomeItem,
  MetricsSection,
  MetricItem,
} from "./types/profile";

export { SCHEMA_VERSION } from "./types/profile";

// Common primitives
export type { Evidence, SignalStrength, ConfidenceLevel } from "./types/common";

// Lens pipeline types
export type {
  AnalyticalLensType,
  LensCandidate,
  LensResult,
  AllLensesResult,
} from "./types/lenses";

// Convergence pipeline types
export type {
  ExperientialLensType,
  ValidationStatus,
  ValidatedCandidate,
  CandidateCluster,
  ValueMomentTier,
  ValueMoment,
  QualityStatus,
  QualityCheck,
  QualityReport,
  ConvergenceResult,
} from "./types/convergence";

// Output types
export type {
  ValueMomentPriority,
  ICPProfile,
  ActivationStage,
  StageTransition,
  ActivationMap,
  EntityPropertyDef,
  EntityDefinition,
  UserStateCriterion,
  UserState,
  EventProperty,
  Perspective,
  PerspectiveDistribution,
  MapsTo,
  TrackingEvent,
  MeasurementSpec,
  ActivationLevel,
  MeasurementInputData,
  OutputGenerationResult,
} from "./types/outputs";
```

### Backward Compatibility Strategy

The existing Convex app files will be updated to re-export from `@basesignal/core` instead of defining types locally:

**`convex/analysis/outputs/types.ts`** becomes:
```typescript
// Re-export all output types from the core package
export type {
  ICPProfile,
  ActivationMap,
  // ... all current exports
} from "@basesignal/core";

// Also re-export LensType as the old name for backward compat
export type { AnalyticalLensType as LensType } from "@basesignal/core";
```

**`convex/analysis/lenses/types.ts`** becomes:
```typescript
export type {
  AnalyticalLensType as LensType,
  ConfidenceLevel,
  LensCandidate,
  LensResult,
  AllLensesResult,
} from "@basesignal/core";
```

**`convex/analysis/convergence/types.ts`** becomes:
```typescript
export type {
  ExperientialLensType as LensType,
  ValidationStatus,
  ValidatedCandidate,
  // ... all current exports
} from "@basesignal/core";
```

**`src/components/product-profile/types.ts`** becomes:
```typescript
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

This means every existing import path continues to work unchanged. Consumers do not need to update their `import from` paths. The local files become thin re-export shims.

## Key Decisions

1. **Two distinct LensType unions, not one.** The analytical lens types (`capability_mapping`, etc.) and experiential lens types (`jtbd`, etc.) serve different pipeline stages. They are renamed to `AnalyticalLensType` and `ExperientialLensType` in the core package. The old `LensType` name is preserved in the re-export shims for backward compatibility.

2. **Plain `string` for IDs, not branded types.** The story mentions `v.id("products")` becoming `string`. Branded types (e.g., `ProductId = string & { __brand: "ProductId" }`) add complexity without benefit at the pure-types layer. If runtime validation needs stronger ID checking, that belongs in S003 (zod schemas).

3. **`basesignal_version` on ProductProfile, but no `ProfileMetadata`.** The root `ProductProfile` gets a `basesignal_version: string` field for schema versioning. Timestamps (`createdAt`, `updatedAt`) and storage-specific fields (`productId` as `Id<"products">`) are intentionally excluded -- those belong to the storage adapter layer, not the canonical schema.

4. **Discriminated union for activation definitions preserved.** The existing Convex schema already uses a union for `definitions.activation` (legacy flat format vs. multi-level). This is faithfully preserved as `ActivationDefinition = LegacyActivationDefinition | MultiLevelActivationDefinition`. Discriminating between them at runtime can use the presence of `levels` (multi-level) vs `criteria` as `string[]` (legacy).

5. **Five files, not one.** Types are organized by domain (`profile`, `lenses`, `convergence`, `outputs`, `common`) rather than dumped into a single file. This matches how the analysis pipeline is structured and keeps each file under 150 lines.

6. **Re-export shims for backward compatibility.** Existing source files become thin re-export wrappers. This is a one-line change per file and means zero breaking changes for existing imports throughout the codebase.

7. **No runtime code in this story.** All exports are `type` exports. No functions, no validation, no utilities. Those are S003 (zod validation) and S005 (analysis utilities).

## What This Does NOT Do

- **No runtime validation.** No zod schemas, no `validate()` functions, no type guards. That is M008-E001-S003.
- **No JSON Schema generation.** That is M008-E001-S004.
- **No analysis utilities or helper functions.** No completeness calculation, no confidence averaging, no type guards like `isICPProfile()`. Those are M008-E001-S005.
- **No convergence tiering logic.** That is M008-E001-S006.
- **No changes to the Convex schema.** The `productProfiles` table definition in `convex/schema.ts` stays exactly as-is. The Convex validators in `convex/productProfiles.ts` stay as-is.
- **No monorepo setup.** That is M008-E001-S001. This story assumes `packages/core/` already exists with a working build.
- **No new types invented.** Every type in the core package traces directly to an existing type in the codebase. The only new additions are `basesignal_version` on `ProductProfile` and the renamed lens type unions.

## Verification Steps

1. **TypeScript compilation:** `cd packages/core && npx tsc --noEmit` passes with zero errors.

2. **No forbidden imports:** `grep -r "convex/" packages/core/src/` returns zero results. Same for `@clerk/` and `react`.

3. **Export completeness:** A test file imports every type listed in the acceptance criteria and successfully assigns valid data to each:
   - `ProductProfile` with all sections populated
   - Each section type independently (`CoreIdentity`, `RevenueArchitecture`, etc.)
   - Output types: `ICPProfile`, `ActivationMap`, `MeasurementSpec`, `ValueMoment`
   - Pipeline types: `LensCandidate`, `ValidatedCandidate`, `ConvergenceResult`

4. **Backward compatibility:** Running `npm test` from the project root passes -- all existing tests in `convex/analysis/` and `src/` continue to work through the re-export shims.

5. **JSDoc coverage:** Every exported interface has a JSDoc comment explaining its purpose.

6. **Schema version:** `SCHEMA_VERSION` is exported and equals `"1.0"`.

## Success Criteria

- All types from the three source files are present in `packages/core/src/types/`
- `ProductProfile` interface exists as a root type aggregating all sections
- Every type is independently importable from `@basesignal/core`
- Zero imports from `convex/`, `@clerk/`, or `react` in `packages/core/`
- Every exported interface/type has a JSDoc comment
- Existing Convex source files become re-export shims pointing to `@basesignal/core`
- All existing tests continue to pass without modification
- `basesignal_version` field exists on `ProductProfile`
