# Implementation Plan: Schema Specification v1.0 Documentation

**Task:** basesignal-99q
**Story:** M008-E006-S003
**Design:** [2026-02-15-schema-specification-design.md](./2026-02-15-schema-specification-design.md)

## Summary

Create the formal Basesignal ProductProfile schema specification as a versioned documentation artifact at `docs/specification/v1.0/`. This includes one overview page (`profile.md`), six section documents (`identity.md`, `journey.md`, `definitions.md`, `entities.md`, `metrics.md`, `revenue.md`), a `schema.json` copy, a `schema.ts` re-export file, and a top-level `CHANGELOG.md`. The specification documents existing types from `@basesignal/core` -- it does not define new types.

**Dependency:** This story depends on M008-E001-S004 (JSON Schema generation) which produces `packages/core/schema.json`. If `packages/core/` does not yet exist, the schema.json copy and schema.ts re-export steps should use placeholder content with TODO markers indicating the source files.

## Directory Structure

```
docs/specification/
  v1.0/
    profile.md          # Full ProductProfile overview
    identity.md         # CoreIdentity section
    journey.md          # UserJourney section
    definitions.md      # DefinitionsMap section (activation, firstValue, active, atRisk, churn)
    entities.md         # EntityModel section
    metrics.md          # MetricsSection + OutcomesSection (combined)
    revenue.md          # RevenueArchitecture section
    schema.json         # Copy of packages/core/schema.json
    schema.ts           # Re-export file importing from @basesignal/core
  CHANGELOG.md          # Tracks spec versions
```

---

## Steps

### Step 1: Create the directory structure

Create the `docs/specification/v1.0/` directory.

```bash
mkdir -p docs/specification/v1.0
```

No tests for this step.

---

### Step 2: Create `docs/specification/CHANGELOG.md`

**File:** `docs/specification/CHANGELOG.md` (new)

Write the CHANGELOG with a single v1.0 entry:

```markdown
# Schema Specification Changelog

All notable changes to the Basesignal ProductProfile schema specification.

Versioning follows semver rules:
- **Minor** (1.0 -> 1.1): New optional fields or enum values. Existing profiles remain valid.
- **Major** (1.0 -> 2.0): Breaking changes. Existing profiles may not validate.

## v1.0 - 2026-02-15

Initial release of the Basesignal ProductProfile schema specification.

### Sections
- CoreIdentity: product name, description, target customer, business model
- RevenueArchitecture: pricing model, tiers, expansion/contraction paths
- EntityModel: data entities and relationships
- UserJourney: lifecycle stages from first touch to expansion
- DefinitionsMap: activation, first value, active, at-risk, and churn definitions
- OutcomesSection: business outcomes linked to features
- MetricsSection: P&L framework metrics (reach, engagement, value delivery, value capture)

### Features
- basesignal_version field for schema versioning
- Confidence scoring (0-1) per section
- Evidence arrays linking data to source URLs
- Multi-level activation definition format (alongside legacy flat format)
- JSON Schema Draft 2020-12 for non-TypeScript consumers
- TypeScript type definitions via @basesignal/core
```

No tests for this step.

---

### Step 3: Create `docs/specification/v1.0/profile.md`

**File:** `docs/specification/v1.0/profile.md` (new)

This is the root entry point for the specification. It must include:

1. **Title and introduction** -- what a ProductProfile is: a structured representation of a product's performance model covering identity, journey, definitions, entities, metrics, outcomes, and revenue.

2. **Schema version section** -- explain the `basesignal_version` field:
   - Every profile carries `basesignal_version` (e.g., `"1.0"`)
   - Minor bumps (1.0 -> 1.1): additive changes only, old profiles remain valid
   - Major bumps (1.0 -> 2.0): breaking changes, old profiles may not validate

3. **Section overview table** -- list all top-level fields:

   | Field | Type | Required | Description |
   |-------|------|----------|-------------|
   | `basesignal_version` | `string` | Yes | Schema version (e.g., `"1.0"`) |
   | `identity` | `CoreIdentity` | No | Core product identity |
   | `revenue` | `RevenueArchitecture` | No | Revenue model and pricing |
   | `entities` | `EntityModel` | No | Data entities the product manages |
   | `journey` | `UserJourney` | No | User lifecycle stages |
   | `definitions` | `DefinitionsMap` | No | Behavioral state definitions |
   | `outcomes` | `OutcomesSection` | No | Business outcomes |
   | `metrics` | `MetricsSection` | No | Key performance metrics |
   | `completeness` | `number` | Yes | Fraction of sections populated (0-1) |
   | `overallConfidence` | `number` | Yes | Weighted average confidence (0-1) |

   Each section name should link to its corresponding section doc (e.g., `[CoreIdentity](./identity.md)`).

4. **ProductProfile TypeScript interface** -- the full root interface from `packages/core/src/types/profile.ts`, with JSDoc comments:

   ```typescript
   interface ProductProfile {
     basesignal_version: string;
     identity?: CoreIdentity;
     revenue?: RevenueArchitecture;
     entities?: EntityModel;
     journey?: UserJourney;
     definitions?: DefinitionsMap;
     outcomes?: OutcomesSection;
     metrics?: MetricsSection;
     completeness: number;
     overallConfidence: number;
   }
   ```

5. **Computed fields** -- explain `completeness` and `overallConfidence`:
   - `completeness`: fraction of optional sections that are populated (0-1). A profile with 3 of 7 sections populated has completeness = 0.43.
   - `overallConfidence`: weighted average of the `confidence` field across all populated sections (0-1).

6. **Complete example** -- a full ProductProfile JSON for a realistic product (use Linear as the example product, sanitized). All sections should be populated with realistic data. This is the most valuable part for new readers.

7. **Compatibility guarantees** -- summarize the five compatibility rules from the design doc:
   - Within a major version, profiles are forward-compatible
   - Within a major version, the schema is backward-compatible
   - Major versions make no compatibility promises
   - `basesignal_version` is always present
   - Unknown fields are preserved, not rejected

8. **Links** -- link to `schema.json` for machine-readable schema and `schema.ts` for TypeScript re-exports.

No tests for this step.

---

### Step 4: Create `docs/specification/v1.0/identity.md`

**File:** `docs/specification/v1.0/identity.md` (new)

Follow the per-section document format from the design:

1. **Purpose** -- one paragraph explaining CoreIdentity: the foundational product identity extracted from crawled website pages. Populated during the initial analysis phase from homepage, about, and features pages.

2. **Type definition** -- the `CoreIdentity` TypeScript interface:

   ```typescript
   interface CoreIdentity {
     productName: string;
     description: string;
     targetCustomer: string;
     businessModel: string;
     industry?: string;
     companyStage?: string;
     confidence: number;
     evidence: Evidence[];
   }

   interface Evidence {
     url: string;
     excerpt: string;
   }
   ```

3. **Field reference table:**

   | Field | Type | Required | Description | Constraints |
   |-------|------|----------|-------------|-------------|
   | `productName` | `string` | Yes | The product's name | Non-empty |
   | `description` | `string` | Yes | Brief product description | Non-empty |
   | `targetCustomer` | `string` | Yes | Who the product serves | Non-empty |
   | `businessModel` | `string` | Yes | How the product generates revenue | Non-empty |
   | `industry` | `string` | No | Industry vertical | -- |
   | `companyStage` | `string` | No | Company maturity stage | -- |
   | `confidence` | `number` | Yes | Extraction confidence score | 0-1 |
   | `evidence` | `Evidence[]` | Yes | Source evidence | Array of {url, excerpt} |

4. **Example** -- use Linear as the example (from the design doc):

   ```json
   {
     "productName": "Linear",
     "description": "Modern project management tool built for software teams",
     "targetCustomer": "Software development teams at startups and mid-market companies",
     "businessModel": "Per-seat SaaS subscription",
     "industry": "Developer Tools",
     "companyStage": "Growth",
     "confidence": 0.92,
     "evidence": [
       { "url": "https://linear.app/", "excerpt": "Linear is a better way to build software" },
       { "url": "https://linear.app/pricing", "excerpt": "Per member per month" }
     ]
   }
   ```

5. **Confidence scoring** -- explain what drives confidence up/down:
   - High (0.8-1.0): product name and description found on multiple pages, pricing page confirms business model
   - Medium (0.5-0.79): fewer corroborating sources, business model inferred from indirect signals
   - Low (0.0-0.49): single source, significant inference required

6. **Evidence** -- explain the evidence array: each entry links an extracted data point to a specific URL and text excerpt from the crawled page.

No tests for this step.

---

### Step 5: Create `docs/specification/v1.0/journey.md`

**File:** `docs/specification/v1.0/journey.md` (new)

Same format as Step 4, documenting the UserJourney section.

1. **Purpose** -- the user journey represents lifecycle stages from first touch through activation, core usage, expansion, and potential churn. Populated during analysis from product pages that describe user onboarding, workflows, and growth paths.

2. **Type definition:**

   ```typescript
   interface UserJourney {
     stages: JourneyStage[];
     confidence: number;
     evidence: Evidence[];
   }

   interface JourneyStage {
     name: string;
     description: string;
     order: number;
   }
   ```

3. **Field reference table** for both `UserJourney` and `JourneyStage`:

   UserJourney:
   | Field | Type | Required | Description | Constraints |
   |-------|------|----------|-------------|-------------|
   | `stages` | `JourneyStage[]` | Yes | Ordered lifecycle stages | Non-empty array |
   | `confidence` | `number` | Yes | Extraction confidence | 0-1 |
   | `evidence` | `Evidence[]` | Yes | Source evidence | Array of {url, excerpt} |

   JourneyStage:
   | Field | Type | Required | Description | Constraints |
   |-------|------|----------|-------------|-------------|
   | `name` | `string` | Yes | Stage name | Non-empty |
   | `description` | `string` | Yes | What happens in this stage | Non-empty |
   | `order` | `number` | Yes | Position in the journey | Integer >= 0 |

4. **Example** -- use a realistic project management tool journey (Linear-style):

   ```json
   {
     "stages": [
       { "name": "Discovery", "description": "User visits website and explores features", "order": 0 },
       { "name": "Signup", "description": "Creates account and sets up workspace", "order": 1 },
       { "name": "Onboarding", "description": "Creates first project, invites team members", "order": 2 },
       { "name": "Activation", "description": "Team creates and triages first issues", "order": 3 },
       { "name": "Core Usage", "description": "Daily sprint management and issue tracking", "order": 4 },
       { "name": "Expansion", "description": "Adopts roadmaps, cycles, and integrations", "order": 5 }
     ],
     "confidence": 0.85,
     "evidence": [
       { "url": "https://linear.app/docs/getting-started", "excerpt": "Create your workspace and invite your team" }
     ]
   }
   ```

5. **Confidence scoring** and **Evidence** sections as per format.

No tests for this step.

---

### Step 6: Create `docs/specification/v1.0/definitions.md`

**File:** `docs/specification/v1.0/definitions.md` (new)

This is the most complex section doc because it contains the union type for activation.

1. **Purpose** -- behavioral definitions for user lifecycle states. Defines when a user is considered activated, has received first value, is actively engaged, is at risk, or has churned. These are the measurable criteria that drive the P&L framework.

2. **Type definitions** -- must show ALL types:

   ```typescript
   interface DefinitionsMap {
     activation?: ActivationDefinition;
     firstValue?: LifecycleDefinition;
     active?: LifecycleDefinition;
     atRisk?: LifecycleDefinition;
     churn?: LifecycleDefinition;
   }

   // Union type: legacy flat OR multi-level
   type ActivationDefinition = LegacyActivationDefinition | MultiLevelActivationDefinition;

   interface LegacyActivationDefinition {
     criteria: string[];
     timeWindow?: string;
     reasoning: string;
     confidence: number;
     source: string;
     evidence: Evidence[];
   }

   interface MultiLevelActivationDefinition {
     levels: ActivationLevelDef[];
     primaryActivation?: number;
     overallConfidence: number;
   }

   interface ActivationLevelDef {
     level: number;
     name: string;
     signalStrength: SignalStrength;
     criteria: ActivationCriterion[];
     reasoning: string;
     confidence: number;
     evidence: Evidence[];
   }

   interface ActivationCriterion {
     action: string;
     count: number;
     timeWindow?: string;
   }

   type SignalStrength = "weak" | "medium" | "strong" | "very_strong";

   interface LifecycleDefinition {
     criteria: string[];
     timeWindow?: string;
     reasoning: string;
     confidence: number;
     source: string;
     evidence: Evidence[];
     description?: string;
   }
   ```

3. **Field reference tables** -- one table for each type.

4. **Discriminating the union type at runtime** -- explain how to tell legacy from multi-level:
   - If the object has a `levels` field (array), it is `MultiLevelActivationDefinition`
   - If the object has a `criteria` field (string array) at the top level, it is `LegacyActivationDefinition`

5. **Two examples:**
   - Legacy activation example (simple criteria list)
   - Multi-level activation example (with levels, signal strengths, structured criteria)
   - Also include examples for `firstValue`, `active`, `atRisk`, and `churn`

6. **Lifecycle states overview** -- briefly explain each of the five states:
   - `activation`: when a user first derives value (union type)
   - `firstValue`: the specific moment of first value delivery
   - `active`: ongoing engagement criteria
   - `atRisk`: disengagement signals
   - `churn`: loss criteria

7. **Confidence scoring** and **Evidence** sections.

No tests for this step.

---

### Step 7: Create `docs/specification/v1.0/entities.md`

**File:** `docs/specification/v1.0/entities.md` (new)

1. **Purpose** -- the entity model describes the core data objects a product manages and their relationships. It maps the product's domain model as understood from public-facing pages.

2. **Type definitions:**

   ```typescript
   interface EntityModel {
     items: EntityItem[];
     relationships: EntityRelationship[];
     confidence: number;
     evidence: Evidence[];
   }

   interface EntityItem {
     name: string;
     type: string;
     properties: string[];
   }

   interface EntityRelationship {
     from: string;
     to: string;
     type: string;
   }
   ```

3. **Field reference tables** for `EntityModel`, `EntityItem`, and `EntityRelationship`.

4. **Example** -- project management tool entities:

   ```json
   {
     "items": [
       { "name": "Issue", "type": "core", "properties": ["title", "status", "priority", "assignee", "labels"] },
       { "name": "Project", "type": "container", "properties": ["name", "lead", "status", "targetDate"] },
       { "name": "Team", "type": "organization", "properties": ["name", "members", "projects"] },
       { "name": "Cycle", "type": "time-bound", "properties": ["name", "startDate", "endDate", "issues"] }
     ],
     "relationships": [
       { "from": "Team", "to": "Project", "type": "has many" },
       { "from": "Project", "to": "Issue", "type": "has many" },
       { "from": "Team", "to": "Cycle", "type": "has many" },
       { "from": "Cycle", "to": "Issue", "type": "contains" }
     ],
     "confidence": 0.88,
     "evidence": [
       { "url": "https://linear.app/docs/issues", "excerpt": "Issues are the building blocks of Linear" }
     ]
   }
   ```

5. **Confidence scoring** and **Evidence** sections.

No tests for this step.

---

### Step 8: Create `docs/specification/v1.0/metrics.md`

**File:** `docs/specification/v1.0/metrics.md` (new)

This file documents **both** MetricsSection and OutcomesSection (combined per design decision -- they are closely related in the P&L framework).

1. **Purpose** -- metrics measure product performance across the P&L framework layers (Reach, Engagement, Value Delivery, Value Capture). Outcomes describe the business results the product enables and link them to specific features.

2. **Type definitions for MetricsSection:**

   ```typescript
   interface MetricsSection {
     items: MetricItem[];
     confidence: number;
     evidence: Evidence[];
   }

   interface MetricItem {
     name: string;
     category: string;  // "reach" | "engagement" | "value_delivery" | "value_capture"
     formula?: string;
     linkedTo: string[];
   }
   ```

3. **Type definitions for OutcomesSection:**

   ```typescript
   interface OutcomesSection {
     items: OutcomeItem[];
     confidence: number;
     evidence: Evidence[];
   }

   interface OutcomeItem {
     description: string;
     type: string;
     linkedFeatures: string[];
   }
   ```

4. **Field reference tables** for all four types.

5. **P&L framework mapping** -- explain how metric categories map to the P&L layers:
   - `reach`: new user volume, trial starts, activation rate
   - `engagement`: active rate, feature adoption, usage intensity
   - `value_delivery`: user-defined activation/active rules, derived account states
   - `value_capture`: conversion, retention, expansion rates

6. **Examples** -- one for MetricsSection and one for OutcomesSection:

   MetricsSection example:
   ```json
   {
     "items": [
       { "name": "Weekly Active Users", "category": "engagement", "formula": "COUNT(DISTINCT users WHERE active_last_7d)", "linkedTo": ["Issue tracking", "Sprint planning"] },
       { "name": "Trial-to-Paid Conversion", "category": "value_capture", "formula": "paid_users / trial_users", "linkedTo": ["Onboarding flow"] },
       { "name": "Signup Rate", "category": "reach", "linkedTo": ["Landing page", "Pricing page"] }
     ],
     "confidence": 0.78,
     "evidence": [
       { "url": "https://linear.app/pricing", "excerpt": "Start free, upgrade when ready" }
     ]
   }
   ```

   OutcomesSection example:
   ```json
   {
     "items": [
       { "description": "Engineering teams ship features 2x faster", "type": "efficiency", "linkedFeatures": ["Issue tracking", "Cycles", "Auto-triage"] },
       { "description": "Product managers gain real-time project visibility", "type": "visibility", "linkedFeatures": ["Roadmaps", "Project views", "Updates"] }
     ],
     "confidence": 0.72,
     "evidence": [
       { "url": "https://linear.app/customers", "excerpt": "Teams ship faster with Linear" }
     ]
   }
   ```

7. **Confidence scoring** and **Evidence** sections.

No tests for this step.

---

### Step 9: Create `docs/specification/v1.0/revenue.md`

**File:** `docs/specification/v1.0/revenue.md` (new)

1. **Purpose** -- the revenue architecture describes how the product captures value: pricing model, billing mechanics, tier structure, upsell vectors, and downgrade risks.

2. **Type definitions:**

   ```typescript
   interface RevenueArchitecture {
     model: string;
     billingUnit?: string;
     hasFreeTier: boolean;
     tiers: PricingTier[];
     expansionPaths: string[];
     contractionRisks: string[];
     confidence: number;
     evidence: Evidence[];
   }

   interface PricingTier {
     name: string;
     price: string;
     features: string[];
   }
   ```

3. **Field reference tables:**

   RevenueArchitecture:
   | Field | Type | Required | Description | Constraints |
   |-------|------|----------|-------------|-------------|
   | `model` | `string` | Yes | Revenue model (e.g., "Per-seat SaaS subscription") | Non-empty |
   | `billingUnit` | `string` | No | What the customer pays per (e.g., "seat", "usage") | -- |
   | `hasFreeTier` | `boolean` | Yes | Whether a free plan exists | -- |
   | `tiers` | `PricingTier[]` | Yes | Available pricing tiers | Array |
   | `expansionPaths` | `string[]` | Yes | Upsell/cross-sell vectors | Array |
   | `contractionRisks` | `string[]` | Yes | Downgrade trigger scenarios | Array |
   | `confidence` | `number` | Yes | Extraction confidence | 0-1 |
   | `evidence` | `Evidence[]` | Yes | Source evidence | Array of {url, excerpt} |

   PricingTier:
   | Field | Type | Required | Description | Constraints |
   |-------|------|----------|-------------|-------------|
   | `name` | `string` | Yes | Tier name | Non-empty |
   | `price` | `string` | Yes | Price description | Non-empty |
   | `features` | `string[]` | Yes | Features included in this tier | Array |

4. **Example:**

   ```json
   {
     "model": "Per-seat SaaS subscription",
     "billingUnit": "seat",
     "hasFreeTier": true,
     "tiers": [
       { "name": "Free", "price": "$0/month", "features": ["Up to 250 issues", "Basic integrations"] },
       { "name": "Standard", "price": "$8/user/month", "features": ["Unlimited issues", "Cycles", "Priority support"] },
       { "name": "Plus", "price": "$14/user/month", "features": ["Advanced analytics", "SLA", "SAML SSO"] }
     ],
     "expansionPaths": [
       "Free to Standard: teams hitting the 250 issue limit",
       "Standard to Plus: enterprises needing SSO and compliance",
       "Seat expansion: team growth adds per-user revenue"
     ],
     "contractionRisks": [
       "Team downsizing reduces seat count",
       "Switching to competing tool (Jira, Shortcut)",
       "Plus to Standard downgrade if advanced features unused"
     ],
     "confidence": 0.91,
     "evidence": [
       { "url": "https://linear.app/pricing", "excerpt": "Free for small teams. Standard at $8/user/month." }
     ]
   }
   ```

5. **Confidence scoring** and **Evidence** sections.

No tests for this step.

---

### Step 10: Create `docs/specification/v1.0/schema.ts`

**File:** `docs/specification/v1.0/schema.ts` (new)

Create the TypeScript re-export file. If `@basesignal/core` does not yet exist as an installable package, add a comment noting the import source and that this file will work once the core package is published.

```typescript
// docs/specification/v1.0/schema.ts
//
// Re-export all ProductProfile types from @basesignal/core.
// This file exists so that consumers who discover the specification
// can immediately find the canonical TypeScript types.

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
  Evidence,
  SignalStrength,
  ConfidenceLevel,
} from "@basesignal/core";

export { SCHEMA_VERSION, checkVersion } from "@basesignal/core";
```

No tests for this step.

---

### Step 11: Create `docs/specification/v1.0/schema.json`

**File:** `docs/specification/v1.0/schema.json` (new)

If `packages/core/schema.json` exists, copy it:

```bash
cp packages/core/schema.json docs/specification/v1.0/schema.json
```

If `packages/core/schema.json` does not yet exist (dependency on M008-E001-S004 not yet complete), create a placeholder JSON Schema that captures the ProductProfile structure based on the type definitions from the design doc. The placeholder should:

- Use JSON Schema Draft 2020-12 (`"$schema": "https://json-schema.org/draft/2020-12/schema"`)
- Set `"$id": "https://basesignal.dev/schema/v1.0/product-profile.json"`
- Set `"title": "Basesignal Product Profile"`
- Define the full ProductProfile structure with all sections as optional properties
- Define `basesignal_version`, `completeness`, and `overallConfidence` as required
- Include nested type definitions for CoreIdentity, RevenueArchitecture, EntityModel, UserJourney, DefinitionsMap, OutcomesSection, MetricsSection
- Include the Evidence and PricingTier sub-schemas
- Handle the ActivationDefinition union type with `oneOf`

The schema should validate realistic test profiles. When `packages/core/schema.json` is built, this file should be replaced with a copy from there.

**Test:** `docs/specification/v1.0/__tests__/schema-validation.test.ts` (new)

```typescript
import { describe, it, expect } from "vitest";
import schema from "../schema.json";
import Ajv from "ajv/dist/2020";

describe("schema.json", () => {
  it("is a valid JSON Schema", () => {
    const ajv = new Ajv();
    const valid = ajv.validateSchema(schema);
    expect(valid).toBe(true);
  });

  it("validates a minimal valid profile", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      basesignal_version: "1.0",
      completeness: 0,
      overallConfidence: 0,
    };
    expect(validate(profile)).toBe(true);
  });

  it("validates a profile with identity section", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      basesignal_version: "1.0",
      completeness: 0.14,
      overallConfidence: 0.92,
      identity: {
        productName: "Linear",
        description: "Modern project management tool",
        targetCustomer: "Software development teams",
        businessModel: "Per-seat SaaS subscription",
        confidence: 0.92,
        evidence: [
          { url: "https://linear.app/", excerpt: "Linear is a better way to build software" },
        ],
      },
    };
    expect(validate(profile)).toBe(true);
  });

  it("rejects a profile missing basesignal_version", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      completeness: 0,
      overallConfidence: 0,
    };
    expect(validate(profile)).toBe(false);
  });

  it("rejects identity with missing required fields", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      basesignal_version: "1.0",
      completeness: 0.14,
      overallConfidence: 0.5,
      identity: {
        productName: "Linear",
        // missing description, targetCustomer, businessModel, confidence, evidence
      },
    };
    expect(validate(profile)).toBe(false);
  });
});
```

**Note on test placement:** If test infrastructure does not support tests inside `docs/`, move the test to a more conventional location such as `tests/specification/schema-validation.test.ts` and adjust the import path. The key requirement is that the test validates `docs/specification/v1.0/schema.json` against realistic profiles.

---

### Step 12: Create `docs/specification/v1.0/schema.ts` compilation test

**File:** `docs/specification/v1.0/__tests__/schema-reexport.test.ts` (new) -- or in `tests/specification/` if needed.

This test verifies that the schema.ts re-export file is syntactically correct. Since `@basesignal/core` may not be available yet, this test should check file existence and basic structure:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("schema.ts re-export", () => {
  const schemaTs = readFileSync(
    resolve(__dirname, "../schema.ts"),
    "utf-8"
  );

  it("imports from @basesignal/core", () => {
    expect(schemaTs).toContain("@basesignal/core");
  });

  it("re-exports ProductProfile type", () => {
    expect(schemaTs).toContain("ProductProfile");
  });

  it("re-exports SCHEMA_VERSION", () => {
    expect(schemaTs).toContain("SCHEMA_VERSION");
  });

  it("re-exports checkVersion", () => {
    expect(schemaTs).toContain("checkVersion");
  });

  it("re-exports all section types", () => {
    const requiredTypes = [
      "CoreIdentity",
      "RevenueArchitecture",
      "EntityModel",
      "UserJourney",
      "DefinitionsMap",
      "OutcomesSection",
      "MetricsSection",
    ];
    for (const t of requiredTypes) {
      expect(schemaTs).toContain(t);
    }
  });
});
```

When `@basesignal/core` is published, this test should be upgraded to a TypeScript compilation check (`tsc --noEmit` on the file).

---

### Step 13: Verify all files exist and content is complete

Run a final verification:

1. Confirm all 8 files exist in `docs/specification/v1.0/`:
   - `profile.md`, `identity.md`, `journey.md`, `definitions.md`, `entities.md`, `metrics.md`, `revenue.md`, `schema.json`, `schema.ts`

2. Confirm `docs/specification/CHANGELOG.md` exists.

3. Confirm each section doc contains:
   - A Purpose section
   - A TypeScript type definition
   - A field reference table
   - At least one JSON example with realistic data
   - A Confidence Scoring section
   - An Evidence section

4. Confirm `profile.md` contains:
   - The section overview table with links to all section docs
   - The ProductProfile TypeScript interface
   - A complete JSON example
   - Compatibility guarantees

5. Run tests: `npm test` should pass, including the new schema validation tests.

---

## Acceptance Criteria Mapping

| Acceptance Criterion | Step |
|---------------------|------|
| `docs/specification/v1.0/profile.md` provides complete overview | Step 3 |
| Section docs exist: identity.md, journey.md, definitions.md, entities.md, metrics.md, revenue.md | Steps 4-9 |
| `docs/specification/v1.0/schema.json` is valid JSON Schema that validates test profiles | Step 11 |
| `docs/specification/v1.0/schema.ts` re-exports TypeScript types from @basesignal/core | Steps 10, 12 |
| `docs/specification/CHANGELOG.md` documents v1.0 release | Step 2 |
| Each section doc includes field descriptions, types, required vs optional, and examples | Steps 4-9 |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Example product | Linear (sanitized) | Well-known, all sections populated, audience (product engineers) understands it |
| JSON Schema approach | Hand-write if packages/core not ready, copy later | Unblocks the spec regardless of E001 status |
| Test location | Under docs/ or tests/ depending on infrastructure | Schema validation must be tested regardless of location |
| Metrics + Outcomes combined | Single `metrics.md` file | Per design -- closely related in P&L framework, typically read together |
| No diagrams in v1.0 | Text and tables only | Per design simplification -- add when user feedback requests them |
| No per-section JSON Schema fragments | Full `schema.json` only | Eliminates sync problem; section schemas extractable from full schema |
