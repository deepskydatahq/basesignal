# Zod Runtime Validation Schema Design

## Overview

Define Zod v4 schemas for every ProductProfile type in `packages/core/schema/`, making the Zod schema the single source of truth for both runtime validation and TypeScript types (via `z.infer`). Expose two entry points -- `validateProfile(data)` for full-profile validation and `validateSection(section, data)` for per-section validation -- both returning a discriminated result with structured, field-path-level errors.

## Problem Statement

Today, data flowing into ProductProfile has three different "validation" strategies, none of which are adequate:

1. **Convex validators** (`v.object`, `v.string`) in `convex/schema.ts` and `convex/productProfiles.ts` -- these validate at the database layer but are Convex-specific and cannot be used outside the Convex runtime. They also use `v.any()` in 11 places, punching holes in the type safety.

2. **Hand-rolled guards** (`convex/analysis/outputs/guards.ts`) -- shallow duck-type checks (`isICPProfile`, `isActivationMap`, `isMeasurementSpec`) that verify only 2-3 fields per type. These miss structural errors in nested objects entirely.

3. **Manual `typeof` checks** scattered across `parseLensResponse`, `parseIdentityResponse`, `parseEntities`, `parseUserStateModel`, etc. -- each extraction function re-implements its own field-by-field validation with inconsistent error messages and no shared error format.

The result: LLM outputs, crawl results, and imported profiles can silently carry malformed data through the system until it causes a runtime error far from the source. The open-source `@basesignal/core` package needs a proper validation layer that external consumers can use without Convex.

## Expert Perspectives

### Technical Architect

The key insight is that Zod schemas should be the **single source of truth**. Do not maintain separate TypeScript interfaces and Zod schemas -- that creates a synchronization problem. Define the schema in Zod, derive the TypeScript type with `z.infer`, and export both. The Convex validators in `schema.ts` remain as they are (they serve the database layer), but the `@basesignal/core` package uses only Zod.

Validate at boundaries only -- where data enters the system (LLM response parsing, file import, API input). Interior code trusts the types. This keeps the validation surface small and the runtime cost negligible.

The API should be two functions, not a framework. `validateProfile(data: unknown)` and `validateSection(name, data: unknown)` cover every use case. Resist the urge to add middleware, decorators, or validation pipelines.

### Simplification Reviewer

**Verdict: APPROVED with one cut.**

Remove any plan for "validation modes" (strict vs. lenient vs. partial). One mode: strict. If a field is optional in the schema, it is `z.optional()`. If required, it is required. There is no second dimension of strictness -- that is complexity disguised as flexibility.

The proposed scope is tight: schemas mirror types, two validation functions, structured errors. Nothing to cut from the core proposal.

**One concern:** Do not duplicate the Convex `sectionValidators` object pattern. The Zod schemas ARE the section validators. The existing `sectionValidators` in `convex/productProfiles.ts` (lines 6-73) should eventually be replaced by Zod, but that is a future story (Convex layer adaptation). For this story, the Zod schemas are independent and self-contained in `packages/core/`.

## Proposed Solution

### File Structure

```
packages/core/
  schema/
    index.ts              # Re-exports everything
    common.ts             # Shared primitives: Evidence, Confidence, etc.
    identity.ts           # CoreIdentity schema
    revenue.ts            # RevenueArchitecture schema
    entities.ts           # EntityModel schema
    journey.ts            # JourneyStages schema
    definitions.ts        # Definitions (activation, firstValue, active, atRisk, churn)
    outcomes.ts           # Outcomes schema
    metrics.ts            # Metrics schema
    outputs.ts            # ICPProfile, ActivationMap, MeasurementSpec schemas
    lenses.ts             # LensCandidate, AllLensesResult schemas
    convergence.ts        # ValidatedCandidate, ValueMoment, ConvergenceResult schemas
    profile.ts            # Top-level ProductProfile schema (composes all sections)
  validation/
    index.ts              # validateProfile(), validateSection()
    result.ts             # ValidationResult type
```

### Schema Approach: Zod as Source of Truth

Each schema file defines a Zod schema and exports both the schema and the inferred type:

```typescript
// packages/core/schema/common.ts
import { z } from "zod/v4";

export const EvidenceSchema = z.object({
  url: z.url(),
  excerpt: z.string().min(1),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ConfidenceSchema = z.number().min(0).max(1);
export type Confidence = z.infer<typeof ConfidenceSchema>;
```

```typescript
// packages/core/schema/identity.ts
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

```typescript
// packages/core/schema/profile.ts
import { z } from "zod/v4";
import { CoreIdentitySchema } from "./identity";
import { RevenueArchitectureSchema } from "./revenue";
import { EntityModelSchema } from "./entities";
import { JourneyStagesSchema } from "./journey";
import { DefinitionsSchema } from "./definitions";
import { OutcomesSchema } from "./outcomes";
import { MetricsSectionSchema } from "./metrics";

export const ProductProfileSchema = z.object({
  basesignal_version: z.string(),  // e.g. "1.0"
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

### Definitions Section: Handling the Union Type

The activation definition has a union type (legacy flat format vs. multi-level format). Zod handles this with `z.union()`:

```typescript
// packages/core/schema/definitions.ts
const LegacyActivationSchema = z.object({
  criteria: z.array(z.string()),
  timeWindow: z.string().optional(),
  reasoning: z.string(),
  confidence: ConfidenceSchema,
  source: z.string(),
  evidence: z.array(EvidenceSchema),
});

const MultiLevelActivationSchema = z.object({
  levels: z.array(z.object({
    level: z.number().int().positive(),
    name: z.string().min(1),
    signalStrength: z.enum(["weak", "medium", "strong", "very_strong"]),
    criteria: z.array(z.object({
      action: z.string().min(1),
      count: z.number().int().positive(),
      timeWindow: z.string().optional(),
    })),
    reasoning: z.string(),
    confidence: ConfidenceSchema,
    evidence: z.array(EvidenceSchema),
  })),
  primaryActivation: z.number().optional(),
  overallConfidence: ConfidenceSchema,
});

const ActivationDefinitionSchema = z.union([
  LegacyActivationSchema,
  MultiLevelActivationSchema,
]);
```

### Output Types Schemas

The output types (ICPProfile, ActivationMap, MeasurementSpec) and pipeline types (LensCandidate, ValueMoment, ConvergenceResult) follow the same pattern -- one schema file each, exporting both the Zod schema and the inferred type.

```typescript
// packages/core/schema/outputs.ts
import { z } from "zod/v4";

const PerspectiveSchema = z.enum(["customer", "product", "interaction"]);

const MapsToSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("value_moment"), moment_id: z.string() }),
  z.object({ type: z.literal("activation_level"), activation_level: z.number() }),
  z.object({ type: z.literal("both"), moment_id: z.string(), activation_level: z.number() }),
]);

// ... remaining schemas following the types in convex/analysis/outputs/types.ts
```

### Validation API

```typescript
// packages/core/validation/result.ts
export interface ValidationError {
  path: string[];        // e.g. ["identity", "evidence", "0", "url"]
  expected: string;      // e.g. "valid URL"
  received: string;      // e.g. "not-a-url"
  message: string;       // e.g. "Invalid url: expected a valid URL but received 'not-a-url'"
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };
```

```typescript
// packages/core/validation/index.ts
import { ProductProfileSchema, type ProductProfile } from "../schema/profile";
import type { ValidationResult, ValidationError } from "./result";

// Section name -> schema mapping
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
  if (!schema) {
    return {
      success: false,
      errors: [{ path: [], expected: `valid section name`, received: section, message: `Unknown section: ${section}` }],
    };
  }
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: mapZodErrors(result.error) };
}

function mapZodErrors(error: z.ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String),
    expected: issue.expected ?? "valid value",
    received: String(issue.received ?? "unknown"),
    message: issue.message,
  }));
}
```

### Type Derivation Strategy

The direction is **Zod schema -> TypeScript type**, not the reverse:

```
                     z.infer<typeof Schema>
Zod Schema ──────────────────────────────────► TypeScript Type
    │
    │  zod-to-json-schema (S004)
    ▼
JSON Schema
```

This means:
- S002 (ProductProfile type system) defines the **shapes** as plain interfaces for documentation and initial development.
- S003 (this story) redefines those shapes as Zod schemas and derives the types via `z.infer`.
- The hand-written interfaces from S002 become **compatibility checks** -- a type test file asserts that `z.infer<typeof CoreIdentitySchema>` is assignable to the hand-written `CoreIdentity` and vice versa, catching drift.

```typescript
// packages/core/schema/__tests__/type-compatibility.test.ts
import { expectTypeOf } from "vitest";
import type { CoreIdentity as HandWritten } from "../../types/identity";
import type { CoreIdentity as Inferred } from "../identity";

// Bidirectional assignability check
expectTypeOf<Inferred>().toMatchTypeOf<HandWritten>();
expectTypeOf<HandWritten>().toMatchTypeOf<Inferred>();
```

### Where Validation Happens (Boundary Strategy)

Validate at trust boundaries only:

| Boundary | Data Source | Validator |
|----------|-----------|-----------|
| LLM response parsing | Claude API JSON output | `validateSection('identity', parsed)` |
| File import | JSON file loaded from disk | `validateProfile(parsed)` |
| MCP tool input | External tool calling basesignal | `validateProfile(data)` or `validateSection(...)` |
| Crawl result parsing | Web scraper output | Section-specific validation |
| CLI scan output | Before writing profile to disk | `validateProfile(profile)` |

Interior code (functions that receive an already-validated `ProductProfile`) does NOT re-validate. TypeScript's type system handles interior correctness.

## Key Decisions

### 1. Zod schemas are the single source of truth for types

**Decision:** Types are derived from Zod schemas via `z.infer`, not maintained separately.

**Why:** Maintaining both hand-written interfaces and Zod schemas creates a synchronization problem. When the schema and the type disagree, bugs hide. `z.infer` guarantees they are always identical.

**Tradeoff:** Developers must read Zod syntax to understand types. This is acceptable -- Zod's `z.object()` reads nearly identically to TypeScript interfaces.

### 2. Validate at boundaries only

**Decision:** Validation happens where data enters the system. Interior functions trust TypeScript types.

**Why:** Validating everywhere is wasteful and noisy. The value of runtime validation is catching malformed external data. Once data is validated and typed, TypeScript's compiler handles the rest.

### 3. Flat error structure with field paths

**Decision:** Errors are `{ path: string[], expected, received, message }` -- a flat array, not a nested tree.

**Why:** Flat arrays are easier to display in UIs (map over them), serialize to JSON, and filter by path prefix. A nested tree mirrors the schema structure but adds complexity without proportional benefit.

### 4. One validation strictness mode

**Decision:** No "strict" vs. "lenient" modes. Optional fields use `z.optional()`. Required fields are required. There is no second axis of strictness.

**Why:** Multiple modes create ambiguity about which mode to use and lead to bugs where lenient mode masks real errors. If a field is sometimes absent, it should be `optional()` in the schema.

### 5. Separate schema files per section

**Decision:** One file per profile section (identity.ts, revenue.ts, etc.) rather than one giant schema file.

**Why:** Composability. A consumer who only cares about identity validation can import `CoreIdentitySchema` without pulling in the entire profile schema. Each file stays under 100 lines. Files map 1:1 to the conceptual sections of the ProductProfile.

### 6. Use zod v4 import path

**Decision:** Import from `zod/v4` (the new import path for Zod 4.x).

**Why:** Zod 4 is already installed (`zod@4.1.12`). The `zod/v4` import path is the standard for Zod 4.x and ensures we get the v4 API surface. The downstream `zod-to-json-schema` package (already installed at `3.25.1`) supports Zod 4 schemas, enabling S004 (JSON Schema generation).

## What This Does NOT Do

- **Does not replace Convex validators.** The `v.object()` validators in `convex/schema.ts` and `convex/productProfiles.ts` remain as-is. They serve the Convex database layer. A future story may generate Convex validators from Zod schemas, but that is out of scope.
- **Does not add validation middleware or decorators.** No Express middleware, no function wrappers. Just `validateProfile()` and `validateSection()`.
- **Does not handle schema migration.** Profile versioning and migration between schema versions is S004's scope (`checkVersion()`, `basesignal_version`).
- **Does not validate LLM prompt/response formats.** The schemas validate the *parsed output* of LLM calls, not the raw text or prompt templates.
- **Does not create the `packages/core/` workspace.** That is S001 (monorepo workspace setup). This story assumes `packages/core/` exists with a working TypeScript build.
- **Does not add validation to the existing Convex codebase.** The existing extraction functions (`parseIdentityResponse`, `parseLensResponse`, etc.) keep their current validation. A future story may refactor them to use the Zod schemas.

## Verification Steps

1. **Schema completeness**: Every field in the Convex `productProfiles` table definition (lines 443-600 of `convex/schema.ts`) has a corresponding Zod schema field. Run a manual diff or write a test.

2. **Type compatibility**: The `z.infer` types match the hand-written types from S002. Type-level test files verify bidirectional assignability.

3. **Valid data passes**: Feed a complete, well-formed ProductProfile JSON into `validateProfile()` and confirm `{ success: true, data }`.

4. **Invalid data fails with useful errors**: Feed profiles with missing required fields, wrong types, invalid URLs, out-of-range confidence scores. Confirm errors include the field path, expected type, and received value.

5. **Section validation works**: Call `validateSection('identity', data)` with valid and invalid identity data. Confirm it validates only the identity section, not the full profile.

6. **No Convex dependencies**: Run `grep -r "convex/" packages/core/` and confirm zero matches. The package must be framework-agnostic.

7. **Build succeeds**: `tsc --noEmit` in `packages/core/` passes with no errors.

8. **Tests pass**: `npm test` in `packages/core/` passes. Coverage should include:
   - One test per section schema (valid + invalid input)
   - `validateProfile()` happy path and error path
   - `validateSection()` for each section name
   - Edge cases: empty arrays, boundary confidence values (0, 1, 1.01), union type discrimination (legacy vs. multi-level activation)

## Success Criteria

- Zod schemas exist for ProductProfile and all sub-types (CoreIdentity, RevenueArchitecture, EntityModel, JourneyStages, Definitions, Outcomes, Metrics, plus output types).
- `validateProfile(data)` returns `{ success: true, data: ProductProfile }` for valid data.
- `validateProfile(data)` returns `{ success: false, errors: ValidationError[] }` for invalid data, with field-level error paths (e.g., `["identity", "evidence", "0", "url"]`).
- `validateSection('identity', data)` validates individual sections without requiring a full profile.
- TypeScript types inferred from Zod schemas (`z.infer<typeof Schema>`) match the hand-written types from S002 (verified by type-level tests).
- Zero imports from `convex/`, `@clerk/`, or `react` in `packages/core/`.
