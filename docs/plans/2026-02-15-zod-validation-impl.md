# Zod Runtime Validation Schemas Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create Zod v4 schemas for every ProductProfile type in `packages/core/schema/`, making Zod the single source of truth for both runtime validation and TypeScript types (via `z.infer`). Expose `validateProfile(data)` and `validateSection(section, data)` in `packages/core/validation/`.

**Architecture:** Each profile section gets its own schema file in `packages/core/schema/`. A `validation/` directory exports two functions that wrap Zod's `safeParse` and normalize errors into a flat `ValidationError[]` format. Types are derived from schemas via `z.infer`, not maintained separately. Type compatibility tests verify the inferred types match the hand-written types from S002 (when those exist) or the Convex source types.

**Tech Stack:** Zod v4 (`zod@4.1.12`, import from `zod/v4`), TypeScript, Vitest

**Dependency:** This story assumes S001 (monorepo workspace setup) and S002 (ProductProfile type extraction) have been completed. If `packages/core/` does not yet exist, S001 must be completed first. The schema files created here will either replace or validate against the hand-written types from S002.

---

## Prerequisite Context

### Source of Truth Files (Convex types to mirror)

| Source File | Types Defined | Key Lines |
|------------|---------------|-----------|
| `convex/schema.ts` | productProfiles table definition (identity, revenue, entities, journey, definitions, outcomes, metrics) | Lines 443-600 |
| `convex/productProfiles.ts` | `sectionValidators` object, `DEFINITION_KEYS` | Lines 6-73 |
| `convex/analysis/outputs/types.ts` | ICPProfile, ActivationMap, MeasurementSpec, TrackingEvent, MapsTo, EntityDefinition, UserState, etc. | Full file (159 lines) |
| `convex/analysis/lenses/types.ts` | LensType, LensCandidate, LensResult, AllLensesResult | Full file (52 lines) |
| `convex/analysis/convergence/types.ts` | ValidatedCandidate, ValueMoment, CandidateCluster, ConvergenceResult, QualityReport | Full file (71 lines) |
| `convex/analysis/extractActivationLevels.ts` | SignalStrength, ActivationCriterion, ActivationLevel, ActivationLevelsResult | Lines 8-30 |

### New Files to Create

| File | Purpose |
|------|---------|
| `packages/core/schema/common.ts` | Shared primitives: Evidence, Confidence |
| `packages/core/schema/identity.ts` | CoreIdentity schema |
| `packages/core/schema/revenue.ts` | RevenueArchitecture schema |
| `packages/core/schema/entities.ts` | EntityModel schema |
| `packages/core/schema/journey.ts` | JourneyStages schema |
| `packages/core/schema/definitions.ts` | Definitions (activation, firstValue, active, atRisk, churn) |
| `packages/core/schema/outcomes.ts` | Outcomes schema |
| `packages/core/schema/metrics.ts` | Metrics schema |
| `packages/core/schema/outputs.ts` | ICPProfile, ActivationMap, MeasurementSpec schemas |
| `packages/core/schema/lenses.ts` | LensCandidate, LensResult, AllLensesResult schemas |
| `packages/core/schema/convergence.ts` | ValidatedCandidate, ValueMoment, ConvergenceResult schemas |
| `packages/core/schema/profile.ts` | Top-level ProductProfile schema |
| `packages/core/schema/index.ts` | Re-exports all schemas and types |
| `packages/core/validation/result.ts` | ValidationResult and ValidationError types |
| `packages/core/validation/index.ts` | validateProfile(), validateSection() |
| `packages/core/schema/__tests__/common.test.ts` | Tests for common schemas |
| `packages/core/schema/__tests__/identity.test.ts` | Tests for identity schema |
| `packages/core/schema/__tests__/revenue.test.ts` | Tests for revenue schema |
| `packages/core/schema/__tests__/entities.test.ts` | Tests for entities schema |
| `packages/core/schema/__tests__/journey.test.ts` | Tests for journey schema |
| `packages/core/schema/__tests__/definitions.test.ts` | Tests for definitions (including union type) |
| `packages/core/schema/__tests__/outcomes.test.ts` | Tests for outcomes schema |
| `packages/core/schema/__tests__/metrics.test.ts` | Tests for metrics schema |
| `packages/core/schema/__tests__/outputs.test.ts` | Tests for output type schemas |
| `packages/core/schema/__tests__/lenses.test.ts` | Tests for lens schemas |
| `packages/core/schema/__tests__/convergence.test.ts` | Tests for convergence schemas |
| `packages/core/validation/__tests__/validate.test.ts` | Tests for validateProfile() and validateSection() |

### Zod v4 API Reference

Zod v4 is already installed (`zod@4.1.12`). Key API differences from v3:

- Import: `import { z } from "zod/v4"`
- `z.url()` is a standalone schema (not `z.string().url()`)
- `safeParse` returns `{ success: true, data } | { success: false, error: ZodError }`
- Error issues have `{ expected, code, path, message }` shape (no `received` field by default)
- `z.discriminatedUnion("type", [...])` works as in v3

### Constraints

- Zero imports from `convex/`, `@clerk/`, or `react` in `packages/core/`
- Each schema file stays under 100 lines
- One validation strictness mode (strict) -- optional fields use `z.optional()`, required fields are required
- Types derived via `z.infer`, not hand-written

---

## Tasks

### Task 1: Create `packages/core/schema/common.ts` -- shared primitives

Create the shared primitive schemas used across all section schemas.

**File:** `packages/core/schema/common.ts`

```typescript
import { z } from "zod/v4";

export const EvidenceSchema = z.object({
  url: z.string().min(1),
  excerpt: z.string().min(1),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ConfidenceSchema = z.number().min(0).max(1);
export type Confidence = z.infer<typeof ConfidenceSchema>;
```

**Notes:**
- Use `z.string().min(1)` for evidence URLs instead of `z.url()` -- the Convex schema uses `v.string()` which allows non-URL strings (some evidence URLs are relative paths or incomplete). Matching Convex behavior takes precedence over strict URL validation.
- Confidence is a number 0-1 matching the Convex `v.number()` with semantic constraints.

**Test:** `packages/core/schema/__tests__/common.test.ts`
- Valid evidence object passes
- Missing `url` fails with path `["url"]`
- Missing `excerpt` fails with path `["excerpt"]`
- Empty string url fails
- Confidence 0 passes, 1 passes, 0.5 passes
- Confidence 1.01 fails, -0.1 fails

---

### Task 2: Create `packages/core/schema/identity.ts` -- CoreIdentity

**File:** `packages/core/schema/identity.ts`

Mirror `convex/schema.ts` lines 447-456:

```typescript
import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

export const CoreIdentitySchema = z.object({
  productName: z.string().min(1),
  description: z.string().min(1),
  targetCustomer: z.string().min(1),
  businessModel: z.string().min(1),
  industry: z.string().optional(),
  companyStage: z.string().optional(),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type CoreIdentity = z.infer<typeof CoreIdentitySchema>;
```

**Test:** `packages/core/schema/__tests__/identity.test.ts`
- Valid identity with all fields passes
- Valid identity with only required fields passes (no industry, companyStage)
- Missing productName fails with path `["productName"]`
- Empty productName fails
- Invalid confidence (1.5) fails with path `["confidence"]`
- Invalid evidence entry (missing excerpt) fails with path like `["evidence", "0", "excerpt"]`

---

### Task 3: Create `packages/core/schema/revenue.ts` -- RevenueArchitecture

**File:** `packages/core/schema/revenue.ts`

Mirror `convex/schema.ts` lines 459-472:

```typescript
import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

export const PricingTierSchema = z.object({
  name: z.string().min(1),
  price: z.string().min(1),
  features: z.array(z.string()),
});
export type PricingTier = z.infer<typeof PricingTierSchema>;

export const RevenueArchitectureSchema = z.object({
  model: z.string().min(1),
  billingUnit: z.string().optional(),
  hasFreeTier: z.boolean(),
  tiers: z.array(PricingTierSchema),
  expansionPaths: z.array(z.string()),
  contractionRisks: z.array(z.string()),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type RevenueArchitecture = z.infer<typeof RevenueArchitectureSchema>;
```

**Test:** `packages/core/schema/__tests__/revenue.test.ts`
- Valid revenue with all fields passes
- Missing hasFreeTier fails
- Tier with empty name fails
- Empty tiers array passes (some products may not have tiers yet)
- Optional billingUnit absent passes

---

### Task 4: Create `packages/core/schema/entities.ts` -- EntityModel

**File:** `packages/core/schema/entities.ts`

Mirror `convex/schema.ts` lines 475-488:

```typescript
import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

export const EntityItemSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  properties: z.array(z.string()),
});
export type EntityItem = z.infer<typeof EntityItemSchema>;

export const EntityRelationshipSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.string().min(1),
});
export type EntityRelationship = z.infer<typeof EntityRelationshipSchema>;

export const EntityModelSchema = z.object({
  items: z.array(EntityItemSchema),
  relationships: z.array(EntityRelationshipSchema),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type EntityModel = z.infer<typeof EntityModelSchema>;
```

**Test:** `packages/core/schema/__tests__/entities.test.ts`
- Valid entities with items and relationships passes
- Empty items array passes
- Entity item with missing name fails
- Relationship with missing `from` fails

---

### Task 5: Create `packages/core/schema/journey.ts` -- JourneyStages

**File:** `packages/core/schema/journey.ts`

Mirror `convex/schema.ts` lines 491-499:

```typescript
import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

export const JourneyStageSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  order: z.number(),
});
export type JourneyStage = z.infer<typeof JourneyStageSchema>;

export const JourneyStagesSchema = z.object({
  stages: z.array(JourneyStageSchema),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type JourneyStages = z.infer<typeof JourneyStagesSchema>;
```

**Test:** `packages/core/schema/__tests__/journey.test.ts`
- Valid journey with stages passes
- Stage missing description fails
- Order as non-number fails

---

### Task 6: Create `packages/core/schema/definitions.ts` -- Definitions with union type

This is the most complex schema because the activation definition has a union type (legacy flat vs. multi-level).

**File:** `packages/core/schema/definitions.ts`

Mirror `convex/schema.ts` lines 502-568:

```typescript
import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

// Shared definition shape (used by firstValue, active, atRisk, churn)
const BaseDefinitionSchema = z.object({
  criteria: z.array(z.string()),
  timeWindow: z.string().optional(),
  reasoning: z.string().min(1),
  confidence: ConfidenceSchema,
  source: z.string().min(1),
  evidence: z.array(EvidenceSchema),
});

// firstValue has an extra `description` field
const FirstValueDefinitionSchema = BaseDefinitionSchema.extend({
  description: z.string().min(1),
});

// Legacy flat activation format
const LegacyActivationSchema = BaseDefinitionSchema;

// Multi-level activation format
const ActivationCriterionSchema = z.object({
  action: z.string().min(1),
  count: z.number().int().positive(),
  timeWindow: z.string().optional(),
});

const SignalStrengthSchema = z.enum(["weak", "medium", "strong", "very_strong"]);

const ActivationLevelSchema = z.object({
  level: z.number().int().positive(),
  name: z.string().min(1),
  signalStrength: SignalStrengthSchema,
  criteria: z.array(ActivationCriterionSchema),
  reasoning: z.string().min(1),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});

const MultiLevelActivationSchema = z.object({
  levels: z.array(ActivationLevelSchema),
  primaryActivation: z.number().optional(),
  overallConfidence: ConfidenceSchema,
});

const ActivationDefinitionSchema = z.union([
  LegacyActivationSchema,
  MultiLevelActivationSchema,
]);

export const DefinitionsSchema = z.object({
  activation: ActivationDefinitionSchema.optional(),
  firstValue: FirstValueDefinitionSchema.optional(),
  active: BaseDefinitionSchema.optional(),
  atRisk: BaseDefinitionSchema.optional(),
  churn: BaseDefinitionSchema.optional(),
});
export type Definitions = z.infer<typeof DefinitionsSchema>;

// Export sub-schemas for consumers that need them
export {
  ActivationDefinitionSchema,
  LegacyActivationSchema,
  MultiLevelActivationSchema,
  FirstValueDefinitionSchema,
  BaseDefinitionSchema as DefinitionSchema,
  SignalStrengthSchema,
  ActivationCriterionSchema,
  ActivationLevelSchema,
};
export type SignalStrength = z.infer<typeof SignalStrengthSchema>;
export type ActivationCriterion = z.infer<typeof ActivationCriterionSchema>;
export type ActivationLevel = z.infer<typeof ActivationLevelSchema>;
```

**Notes:**
- `BaseDefinitionSchema` is shared between active, atRisk, and churn, which all have the same shape. `firstValue` extends it with a `description` field.
- The activation union uses `z.union()` (not `z.discriminatedUnion()`) because the two formats do not share a discriminant key -- legacy has `criteria` (string array) and multi-level has `levels` (object array). Zod will try each branch in order.

**Test:** `packages/core/schema/__tests__/definitions.test.ts`
- Legacy activation format (flat criteria) passes
- Multi-level activation format passes
- Data matching neither format fails
- firstValue with description passes
- firstValue without description fails
- active, atRisk, churn with base shape pass
- All sub-definitions optional -- empty object `{}` passes
- Confidence boundary: 0 passes, 1 passes, 1.01 fails
- SignalStrength enum: "weak", "medium", "strong", "very_strong" all pass; "invalid" fails
- ActivationCriterion: count must be positive integer; 0 fails, -1 fails, 1.5 fails

---

### Task 7: Create `packages/core/schema/outcomes.ts` -- Outcomes

**File:** `packages/core/schema/outcomes.ts`

Mirror `convex/schema.ts` lines 572-580:

```typescript
import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

export const OutcomeItemSchema = z.object({
  description: z.string().min(1),
  type: z.string().min(1),
  linkedFeatures: z.array(z.string()),
});
export type OutcomeItem = z.infer<typeof OutcomeItemSchema>;

export const OutcomesSchema = z.object({
  items: z.array(OutcomeItemSchema),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type Outcomes = z.infer<typeof OutcomesSchema>;
```

**Test:** `packages/core/schema/__tests__/outcomes.test.ts`
- Valid outcomes passes
- Missing description on item fails
- Empty linkedFeatures array passes

---

### Task 8: Create `packages/core/schema/metrics.ts` -- Metrics

**File:** `packages/core/schema/metrics.ts`

Mirror `convex/schema.ts` lines 583-592:

```typescript
import { z } from "zod/v4";
import { EvidenceSchema, ConfidenceSchema } from "./common";

export const MetricItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  formula: z.string().optional(),
  linkedTo: z.array(z.string()),
});
export type MetricItem = z.infer<typeof MetricItemSchema>;

export const MetricsSectionSchema = z.object({
  items: z.array(MetricItemSchema),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type MetricsSection = z.infer<typeof MetricsSectionSchema>;
```

**Test:** `packages/core/schema/__tests__/metrics.test.ts`
- Valid metrics passes
- Missing name on item fails
- Optional formula absent passes
- Optional formula present passes

---

### Task 9: Create `packages/core/schema/outputs.ts` -- ICPProfile, ActivationMap, MeasurementSpec

Mirror types from `convex/analysis/outputs/types.ts`.

**File:** `packages/core/schema/outputs.ts`

```typescript
import { z } from "zod/v4";

// --- Perspective & MapsTo ---

export const PerspectiveSchema = z.enum(["customer", "product", "interaction"]);
export type Perspective = z.infer<typeof PerspectiveSchema>;

export const PerspectiveDistributionSchema = z.object({
  customer: z.number(),
  product: z.number(),
  interaction: z.number(),
});
export type PerspectiveDistribution = z.infer<typeof PerspectiveDistributionSchema>;

export const MapsToSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("value_moment"), moment_id: z.string().min(1) }),
  z.object({ type: z.literal("activation_level"), activation_level: z.number() }),
  z.object({ type: z.literal("both"), moment_id: z.string().min(1), activation_level: z.number() }),
]);
export type MapsTo = z.infer<typeof MapsToSchema>;

// --- Value Moment Priority (used by ICPProfile) ---

export const ValueMomentPrioritySchema = z.object({
  moment_id: z.string().min(1),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  relevance_reason: z.string().min(1),
});
export type ValueMomentPriority = z.infer<typeof ValueMomentPrioritySchema>;

// --- ICP Profile ---

export const ICPProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  value_moment_priorities: z.array(ValueMomentPrioritySchema),
  activation_triggers: z.array(z.string()),
  pain_points: z.array(z.string()),
  success_metrics: z.array(z.string()),
  confidence: z.number(),
  sources: z.array(z.string()),
});
export type ICPProfile = z.infer<typeof ICPProfileSchema>;

// --- Entity Property / Entity Definition ---

export const EntityPropertyDefSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "array"]),
  description: z.string().min(1),
  isRequired: z.boolean(),
});
export type EntityPropertyDef = z.infer<typeof EntityPropertyDefSchema>;

export const EntityDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  isHeartbeat: z.boolean(),
  properties: z.array(EntityPropertyDefSchema),
});
export type EntityDefinition = z.infer<typeof EntityDefinitionSchema>;

// --- Activation Stages / Map ---

export const ActivationStageSchema = z.object({
  level: z.number(),
  name: z.string().min(1),
  signal_strength: z.enum(["weak", "medium", "strong", "very_strong"]),
  trigger_events: z.array(z.string()),
  value_moments_unlocked: z.array(z.string()),
  drop_off_risk: z.enum(["low", "medium", "high"]),
  drop_off_reasons: z.array(z.string()).optional(),
});
export type ActivationStage = z.infer<typeof ActivationStageSchema>;

export const StageTransitionSchema = z.object({
  from_level: z.number(),
  to_level: z.number(),
  trigger_events: z.array(z.string()),
  typical_timeframe: z.string().optional(),
});
export type StageTransition = z.infer<typeof StageTransitionSchema>;

export const ActivationMapSchema = z.object({
  stages: z.array(ActivationStageSchema),
  transitions: z.array(StageTransitionSchema),
  primary_activation_level: z.number(),
  confidence: z.number(),
  sources: z.array(z.string()),
});
export type ActivationMap = z.infer<typeof ActivationMapSchema>;

// --- User State Model ---

export const UserStateCriterionSchema = z.object({
  event_name: z.string().min(1),
  condition: z.string().min(1),
});
export type UserStateCriterion = z.infer<typeof UserStateCriterionSchema>;

export const UserStateSchema = z.object({
  name: z.string().min(1),
  definition: z.string().min(1),
  criteria: z.array(UserStateCriterionSchema),
});
export type UserState = z.infer<typeof UserStateSchema>;

// --- Tracking Event ---

export const TrackingEventSchema = z.object({
  name: z.string().min(1),
  entity_id: z.string().min(1),
  description: z.string().min(1),
  perspective: PerspectiveSchema,
  properties: z.array(EntityPropertyDefSchema),
  trigger_condition: z.string().min(1),
  maps_to: MapsToSchema,
  category: z.string().min(1),
});
export type TrackingEvent = z.infer<typeof TrackingEventSchema>;

// --- Measurement Spec ---

export const MeasurementSpecSchema = z.object({
  entities: z.array(EntityDefinitionSchema),
  events: z.array(TrackingEventSchema),
  total_events: z.number().int().min(0),
  coverage: z.object({
    activation_levels_covered: z.array(z.number()),
    value_moments_covered: z.array(z.string()),
    perspective_distribution: PerspectiveDistributionSchema,
  }),
  userStateModel: z.array(UserStateSchema),
  confidence: z.number(),
  sources: z.array(z.string()),
  warnings: z.array(z.string()).optional(),
});
export type MeasurementSpec = z.infer<typeof MeasurementSpecSchema>;
```

**Notes:**
- `MapsTo` uses `z.discriminatedUnion("type", ...)` since all variants share a `type` discriminant.
- `ValueMomentPriority.priority` uses `z.union([z.literal(1), z.literal(2), z.literal(3)])` to match the `1 | 2 | 3` TypeScript type.
- ICPProfile and ActivationMap use `z.number()` for confidence (no 0-1 constraint) because these are generated outputs and the Convex source types do not constrain the range.

**Test:** `packages/core/schema/__tests__/outputs.test.ts`
- ICPProfile valid data passes
- ICPProfile missing `id` fails
- MapsTo: all three discriminated union variants pass
- MapsTo: invalid `type` value fails
- ActivationStage: all signal_strength values pass
- ActivationMap valid data passes
- MeasurementSpec valid data passes
- MeasurementSpec optional warnings absent passes
- MeasurementSpec optional warnings present passes
- TrackingEvent with each perspective value passes
- EntityPropertyDef: all type values pass, invalid type fails
- ValueMomentPriority: priority 1, 2, 3 pass; priority 4 fails

---

### Task 10: Create `packages/core/schema/lenses.ts` -- LensCandidate, LensResult, AllLensesResult

Mirror types from `convex/analysis/lenses/types.ts`.

**File:** `packages/core/schema/lenses.ts`

```typescript
import { z } from "zod/v4";

export const LensTypeSchema = z.enum([
  "capability_mapping",
  "effort_elimination",
  "info_asymmetry",
  "decision_enablement",
  "state_transitions",
  "time_compression",
  "artifact_creation",
]);
export type LensType = z.infer<typeof LensTypeSchema>;

export const ConfidenceLevelSchema = z.enum(["high", "medium", "low"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const LensCandidateSchema = z.object({
  id: z.string().min(1),
  lens: LensTypeSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  role: z.string().min(1),
  confidence: ConfidenceLevelSchema,
  source_urls: z.array(z.string()),
  // Lens-specific optional fields
  enabling_features: z.array(z.string()).optional(),
  effort_eliminated: z.string().optional(),
  information_gained: z.string().optional(),
  decision_enabled: z.string().optional(),
  state_transition: z.string().optional(),
  time_compression: z.string().optional(),
  artifact_type: z.string().optional(),
});
export type LensCandidate = z.infer<typeof LensCandidateSchema>;

export const LensResultSchema = z.object({
  lens: LensTypeSchema,
  candidates: z.array(LensCandidateSchema),
  candidate_count: z.number().int().min(0),
  execution_time_ms: z.number(),
});
export type LensResult = z.infer<typeof LensResultSchema>;

export const AllLensesResultSchema = z.object({
  productId: z.string().min(1),
  candidates: z.array(LensCandidateSchema),
  per_lens: z.array(z.object({
    lens: LensTypeSchema,
    candidate_count: z.number().int().min(0),
    execution_time_ms: z.number(),
  })),
  total_candidates: z.number().int().min(0),
  execution_time_ms: z.number(),
  errors: z.array(z.object({
    lens: LensTypeSchema,
    error: z.string(),
  })),
});
export type AllLensesResult = z.infer<typeof AllLensesResultSchema>;
```

**Test:** `packages/core/schema/__tests__/lenses.test.ts`
- All 7 LensType values pass
- Invalid lens type fails
- LensCandidate with only required fields passes
- LensCandidate with all optional fields passes
- All 3 ConfidenceLevel values pass
- LensResult valid data passes
- AllLensesResult valid data passes

---

### Task 11: Create `packages/core/schema/convergence.ts` -- ValidatedCandidate, ValueMoment, ConvergenceResult

Mirror types from `convex/analysis/convergence/types.ts`.

**File:** `packages/core/schema/convergence.ts`

```typescript
import { z } from "zod/v4";

// Convergence uses a different LensType set than lenses/types.ts
export const ConvergenceLensTypeSchema = z.enum([
  "jtbd",
  "outcomes",
  "pains",
  "gains",
  "alternatives",
  "workflows",
  "emotions",
]);
export type ConvergenceLensType = z.infer<typeof ConvergenceLensTypeSchema>;

export const ValidationStatusSchema = z.enum(["valid", "rewritten", "removed"]);
export type ValidationStatus = z.infer<typeof ValidationStatusSchema>;

export const ValidatedCandidateSchema = z.object({
  id: z.string().min(1),
  lens: ConvergenceLensTypeSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  confidence: z.number(),
  validation_status: ValidationStatusSchema,
  validation_issue: z.string().optional(),
  rewritten_from: z.object({
    name: z.string(),
    description: z.string(),
  }).optional(),
});
export type ValidatedCandidate = z.infer<typeof ValidatedCandidateSchema>;

export const ValueMomentTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type ValueMomentTier = z.infer<typeof ValueMomentTierSchema>;

export const ValueMomentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  tier: ValueMomentTierSchema,
  lenses: z.array(ConvergenceLensTypeSchema),
  lens_count: z.number().int().min(0),
  roles: z.array(z.string()),
  product_surfaces: z.array(z.string()),
  contributing_candidates: z.array(z.string()),
});
export type ValueMoment = z.infer<typeof ValueMomentSchema>;

export const CandidateClusterSchema = z.object({
  cluster_id: z.string().min(1),
  candidates: z.array(ValidatedCandidateSchema),
  lens_count: z.number().int().min(0),
  lenses: z.array(ConvergenceLensTypeSchema),
});
export type CandidateCluster = z.infer<typeof CandidateClusterSchema>;

export const QualityStatusSchema = z.enum(["pass", "warn", "fail"]);
export type QualityStatus = z.infer<typeof QualityStatusSchema>;

export const QualityCheckSchema = z.object({
  name: z.string().min(1),
  status: QualityStatusSchema,
  message: z.string().min(1),
});
export type QualityCheck = z.infer<typeof QualityCheckSchema>;

export const QualityReportSchema = z.object({
  overall: QualityStatusSchema,
  checks: z.array(QualityCheckSchema),
});
export type QualityReport = z.infer<typeof QualityReportSchema>;

export const ConvergenceResultSchema = z.object({
  value_moments: z.array(ValueMomentSchema),
  clusters: z.array(CandidateClusterSchema),
  stats: z.object({
    total_candidates: z.number().int().min(0),
    total_clusters: z.number().int().min(0),
    total_moments: z.number().int().min(0),
    tier_1_count: z.number().int().min(0),
    tier_2_count: z.number().int().min(0),
    tier_3_count: z.number().int().min(0),
  }),
  quality: QualityReportSchema.optional(),
});
export type ConvergenceResult = z.infer<typeof ConvergenceResultSchema>;
```

**Notes:**
- The convergence pipeline uses a different `LensType` enum (`jtbd`, `outcomes`, etc.) than the lens extraction pipeline (`capability_mapping`, etc.). Both are modeled as separate Zod enums.
- `ValidatedCandidate.confidence` is a `number` (not the `ConfidenceLevel` enum) -- this matches the convergence types definition.
- `rewritten_from` is `{ name, description }` per the type definition in `convergence/types.ts` line 22.

**Test:** `packages/core/schema/__tests__/convergence.test.ts`
- ValidatedCandidate with `validation_status: "valid"` passes
- ValidatedCandidate with `rewritten_from` passes
- ValueMoment with all tiers passes
- ValueMoment with invalid tier (4) fails
- ConvergenceResult with stats passes
- ConvergenceResult with optional quality absent passes
- ConvergenceResult with quality report passes
- CandidateCluster valid data passes

---

### Task 12: Create `packages/core/schema/profile.ts` -- top-level ProductProfile

Compose all section schemas into the top-level ProductProfile schema.

**File:** `packages/core/schema/profile.ts`

```typescript
import { z } from "zod/v4";
import { CoreIdentitySchema } from "./identity";
import { RevenueArchitectureSchema } from "./revenue";
import { EntityModelSchema } from "./entities";
import { JourneyStagesSchema } from "./journey";
import { DefinitionsSchema } from "./definitions";
import { OutcomesSchema } from "./outcomes";
import { MetricsSectionSchema } from "./metrics";

export const ProfileMetadataSchema = z.object({
  created: z.string().optional(),
  updated: z.string().optional(),
  source: z.string().optional(),
});
export type ProfileMetadata = z.infer<typeof ProfileMetadataSchema>;

export const ProductProfileSchema = z.object({
  basesignal_version: z.string().min(1),
  identity: CoreIdentitySchema.optional(),
  revenue: RevenueArchitectureSchema.optional(),
  entities: EntityModelSchema.optional(),
  journey: JourneyStagesSchema.optional(),
  definitions: DefinitionsSchema.optional(),
  outcomes: OutcomesSchema.optional(),
  metrics: MetricsSectionSchema.optional(),
  completeness: z.number().min(0).max(1),
  overallConfidence: z.number().min(0).max(1),
  metadata: ProfileMetadataSchema.optional(),
});
export type ProductProfile = z.infer<typeof ProductProfileSchema>;
```

**Notes:**
- All section fields are optional (a profile can be partially filled).
- `basesignal_version` is required -- every profile must declare its schema version.
- `completeness` and `overallConfidence` are 0-1 range numbers.
- Output types (ICPProfile, ActivationMap, MeasurementSpec) are NOT part of the core profile schema -- they are generated artifacts stored separately. They have their own schemas in `outputs.ts` for validation but are not composed into the profile.

**Test:** Covered by the `validateProfile()` tests in Task 14.

---

### Task 13: Create `packages/core/schema/index.ts` -- barrel export

Re-export all schemas and types from a single entry point.

**File:** `packages/core/schema/index.ts`

```typescript
// Common
export { EvidenceSchema, ConfidenceSchema } from "./common";
export type { Evidence, Confidence } from "./common";

// Profile sections
export { CoreIdentitySchema } from "./identity";
export type { CoreIdentity } from "./identity";

export { RevenueArchitectureSchema, PricingTierSchema } from "./revenue";
export type { RevenueArchitecture, PricingTier } from "./revenue";

export { EntityModelSchema, EntityItemSchema, EntityRelationshipSchema } from "./entities";
export type { EntityModel, EntityItem, EntityRelationship } from "./entities";

export { JourneyStagesSchema, JourneyStageSchema } from "./journey";
export type { JourneyStages, JourneyStage } from "./journey";

export {
  DefinitionsSchema,
  ActivationDefinitionSchema,
  LegacyActivationSchema,
  MultiLevelActivationSchema,
  FirstValueDefinitionSchema,
  DefinitionSchema,
  SignalStrengthSchema,
  ActivationCriterionSchema,
  ActivationLevelSchema,
} from "./definitions";
export type { Definitions, SignalStrength, ActivationCriterion, ActivationLevel } from "./definitions";

export { OutcomesSchema, OutcomeItemSchema } from "./outcomes";
export type { Outcomes, OutcomeItem } from "./outcomes";

export { MetricsSectionSchema, MetricItemSchema } from "./metrics";
export type { MetricsSection, MetricItem } from "./metrics";

// Output types
export {
  ICPProfileSchema,
  ActivationMapSchema,
  MeasurementSpecSchema,
  TrackingEventSchema,
  MapsToSchema,
  PerspectiveSchema,
  PerspectiveDistributionSchema,
  ValueMomentPrioritySchema,
  EntityPropertyDefSchema,
  EntityDefinitionSchema,
  ActivationStageSchema,
  StageTransitionSchema,
  UserStateCriterionSchema,
  UserStateSchema,
} from "./outputs";
export type {
  ICPProfile,
  ActivationMap,
  MeasurementSpec,
  TrackingEvent,
  MapsTo,
  Perspective,
  PerspectiveDistribution,
  ValueMomentPriority,
  EntityPropertyDef,
  EntityDefinition,
  ActivationStage,
  StageTransition,
  UserStateCriterion,
  UserState,
} from "./outputs";

// Lens types
export {
  LensTypeSchema,
  ConfidenceLevelSchema,
  LensCandidateSchema,
  LensResultSchema,
  AllLensesResultSchema,
} from "./lenses";
export type {
  LensType,
  ConfidenceLevel,
  LensCandidate,
  LensResult,
  AllLensesResult,
} from "./lenses";

// Convergence types
export {
  ConvergenceLensTypeSchema,
  ValidationStatusSchema,
  ValidatedCandidateSchema,
  ValueMomentTierSchema,
  ValueMomentSchema,
  CandidateClusterSchema,
  QualityStatusSchema,
  QualityCheckSchema,
  QualityReportSchema,
  ConvergenceResultSchema,
} from "./convergence";
export type {
  ConvergenceLensType,
  ValidationStatus,
  ValidatedCandidate,
  ValueMomentTier,
  ValueMoment,
  CandidateCluster,
  QualityStatus,
  QualityCheck,
  QualityReport,
  ConvergenceResult,
} from "./convergence";

// Profile
export { ProductProfileSchema, ProfileMetadataSchema } from "./profile";
export type { ProductProfile, ProfileMetadata } from "./profile";
```

**No test needed** -- this is just re-exports. TypeScript compilation verifies correctness.

---

### Task 14: Create `packages/core/validation/result.ts` and `packages/core/validation/index.ts`

**File:** `packages/core/validation/result.ts`

```typescript
export interface ValidationError {
  path: string[];
  expected: string;
  received: string;
  message: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };
```

**File:** `packages/core/validation/index.ts`

```typescript
import { z } from "zod/v4";
import { ProductProfileSchema } from "../schema/profile";
import { CoreIdentitySchema } from "../schema/identity";
import { RevenueArchitectureSchema } from "../schema/revenue";
import { EntityModelSchema } from "../schema/entities";
import { JourneyStagesSchema } from "../schema/journey";
import { DefinitionsSchema } from "../schema/definitions";
import { OutcomesSchema } from "../schema/outcomes";
import { MetricsSectionSchema } from "../schema/metrics";
import type { ProductProfile } from "../schema/profile";
import type { ValidationResult, ValidationError } from "./result";

export type { ValidationResult, ValidationError } from "./result";

const sectionSchemas = {
  identity: CoreIdentitySchema,
  revenue: RevenueArchitectureSchema,
  entities: EntityModelSchema,
  journey: JourneyStagesSchema,
  definitions: DefinitionsSchema,
  outcomes: OutcomesSchema,
  metrics: MetricsSectionSchema,
} as const;

type SectionName = keyof typeof sectionSchemas;

export function validateProfile(data: unknown): ValidationResult<ProductProfile> {
  const result = ProductProfileSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: mapZodErrors(result.error) };
}

export function validateSection<S extends SectionName>(
  section: S,
  data: unknown,
): ValidationResult<z.infer<(typeof sectionSchemas)[S]>> {
  const schema = sectionSchemas[section];
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: mapZodErrors(result.error) };
}

function mapZodErrors(error: z.ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String),
    expected: (issue as Record<string, unknown>).expected as string ?? "valid value",
    received: String((issue as Record<string, unknown>).received ?? "unknown"),
    message: issue.message,
  }));
}
```

**Notes:**
- `mapZodErrors` accesses `expected` and `received` via casting because Zod v4's issue types vary by issue code. The `invalid_type` code has `expected`, others have `format` or `code`. The fallback `"valid value"` and `"unknown"` handle non-type errors gracefully.
- `validateSection` only accepts the 7 profile section names (not output types or lens types). To validate output types, consumers use the schemas directly (e.g., `ICPProfileSchema.safeParse(data)`).

**Test:** `packages/core/validation/__tests__/validate.test.ts`

Comprehensive tests:

1. **`validateProfile` happy path:**
   - Complete valid profile returns `{ success: true, data }`
   - Minimal valid profile (just `basesignal_version`, `completeness`, `overallConfidence`) passes

2. **`validateProfile` error cases:**
   - Missing `basesignal_version` fails with path `["basesignal_version"]`
   - Invalid nested field fails with correct deep path (e.g., `["identity", "evidence", "0", "url"]`)
   - `completeness` out of range fails

3. **`validateSection` per section:**
   - `validateSection("identity", validIdentity)` returns `{ success: true }`
   - `validateSection("identity", {})` returns errors for missing required fields
   - `validateSection("revenue", validRevenue)` passes
   - `validateSection("definitions", legacyActivation)` passes
   - `validateSection("definitions", multiLevelActivation)` passes

4. **Error structure:**
   - Errors have `path`, `expected`, `received`, `message` fields
   - Path is a string array, not joined
   - Multiple errors returned for multiple invalid fields

5. **Edge cases:**
   - `validateProfile(null)` fails gracefully
   - `validateProfile(undefined)` fails gracefully
   - `validateProfile("string")` fails gracefully
   - Empty sections object `{}` for definitions passes (all sub-fields optional)

---

### Task 15: Verify -- no Convex dependencies, TypeScript builds, all tests pass

Final verification task. Run these checks:

1. **No Convex dependencies:**
   ```bash
   # Should return zero matches
   grep -r "convex/" packages/core/schema/ packages/core/validation/ || echo "PASS: no convex imports"
   grep -r "@clerk/" packages/core/ || echo "PASS: no clerk imports"
   grep -r "from \"react\"" packages/core/ || echo "PASS: no react imports"
   ```

2. **TypeScript compilation:**
   ```bash
   cd packages/core && npx tsc --noEmit
   ```

3. **All tests pass:**
   ```bash
   npm test -- --run packages/core/
   ```

4. **Schema completeness check:** Manually verify every field in `convex/schema.ts` lines 443-600 has a corresponding Zod schema field. The mapping is:

   | Convex field | Zod schema |
   |-------------|------------|
   | `productId` | Omitted (Convex-specific, not in portable profile) |
   | `identity` | `CoreIdentitySchema` |
   | `revenue` | `RevenueArchitectureSchema` |
   | `entities` | `EntityModelSchema` |
   | `journey` | `JourneyStagesSchema` |
   | `definitions` | `DefinitionsSchema` |
   | `outcomes` | `OutcomesSchema` |
   | `metrics` | `MetricsSectionSchema` |
   | `completeness` | `z.number().min(0).max(1)` in `ProductProfileSchema` |
   | `overallConfidence` | `z.number().min(0).max(1)` in `ProductProfileSchema` |
   | `createdAt` / `updatedAt` | Omitted (Convex-specific timestamps; `ProfileMetadata` covers portable equivalents) |

**Success criteria from the story:**
- [x] Zod schemas exist for ProductProfile and all sub-types
- [x] `validateProfile(data)` returns `{ success: true, data: ProductProfile }` for valid data
- [x] `validateProfile(data)` returns `{ success: false, errors: ValidationError[] }` for invalid data with field-level error paths
- [x] `validateSection('identity', data)` validates individual sections
- [x] TypeScript types inferred from Zod schemas match the source types
- [x] Zero imports from `convex/`, `@clerk/`, or `react` in `packages/core/`
