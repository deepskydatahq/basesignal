# M008-E006-S003: Schema Specification v1.0 Documentation

## Overview

Create the formal Basesignal ProductProfile schema specification as a versioned documentation artifact at `docs/specification/v1.0/`. This is the reference document that makes Basesignal a standard, not just a tool. It provides human-readable descriptions of every type, field, and relationship in the ProductProfile schema, alongside the machine-readable JSON Schema and TypeScript re-exports already produced by M008-E001.

## Problem Statement

The `@basesignal/core` package (M008-E001) produces three artifacts:

1. TypeScript types (`packages/core/src/types/`) -- for TypeScript consumers
2. Zod schemas (`packages/core/src/schema/`) -- for runtime validation
3. JSON Schema (`packages/core/schema.json`) -- for non-TypeScript consumers

These are the *machine-readable* definitions. What is missing is the *human-readable* specification: a set of documentation pages that explain **what each field means, when it is populated, why it exists, and what valid values look like**. Without this, an external developer staring at `schema.json` has to reverse-engineer intent from field names.

The specification is the most important documentation artifact for open source adoption. It is what a developer reads to understand whether Basesignal's ProductProfile model can represent their product. It is what a contributor reads before proposing a schema change. It is what a tool builder reads to create compatible implementations.

## Expert Perspectives

### Technical Architect

The specification should be a thin documentation layer over the existing type system, not an independent source of truth. The types and zod schemas in `@basesignal/core` are the canonical definitions. The specification documents them -- it does not redefine them. This means:

- The JSON Schema is not written by hand; it is copied from `packages/core/schema.json` (the build artifact from S004).
- The TypeScript re-exports file imports from `@basesignal/core`, not from local definitions.
- If the spec and the code disagree, the code wins. The spec is documentation, not a contract separate from the implementation.

The specification should be structured around how users think about ProductProfile, not how the code is organized. Users think in sections: "What is a product's identity? What is a journey? How do definitions work?" Each section doc should be self-contained enough to read without the others.

### Simplification Reviewer

**Verdict: APPROVED with cuts.**

What to remove:
- **No specification-level JSON Schema fragments per section.** The full `schema.json` is the machine-readable artifact. Duplicating fragments into each section `.md` file creates a synchronization problem. Instead, each section doc links to the relevant `$ref` in `schema.json` and shows TypeScript types inline (which are easier for humans to read than JSON Schema).
- **No specification "format" beyond markdown.** No generated documentation site, no OpenAPI-style tooling, no custom spec format. Markdown files in `docs/specification/v1.0/` are the spec. They are readable on GitHub, in any editor, and in any documentation site that supports markdown.
- **No specification-level versioning policy document.** The versioning strategy is already defined in S004 (`SCHEMA_VERSION`, `checkVersion()`, semver rules). The spec CHANGELOG covers what changed; the CHANGELOG does not need a "versioning philosophy" section.
- **No diagrams in v1.0.** Mermaid diagrams showing relationships between types are nice-to-have but not essential for v1.0. The field reference tables are sufficient. Add diagrams when user feedback requests them.

What feels right: one page per section, each with a clear field table, typed examples, and required-vs-optional annotations. The `profile.md` overview stitches them together. The CHANGELOG is minimal for v1.0 (one entry: "Initial release").

## Proposed Solution

### Directory Structure

```
docs/specification/
  v1.0/
    profile.md          # Full ProductProfile overview, how sections compose
    identity.md         # CoreIdentity section
    journey.md          # UserJourney section
    definitions.md      # Lifecycle definitions (activation, firstValue, active, atRisk, churn)
    entities.md         # EntityModel section
    metrics.md          # MetricsSection + OutcomesSection
    revenue.md          # RevenueArchitecture section
    schema.json         # Copy of packages/core/schema.json (or symlink)
    schema.ts           # Re-export file that imports from @basesignal/core
  CHANGELOG.md          # Tracks spec versions
```

### profile.md -- The Root Document

This is the entry point. It explains:

1. **What a ProductProfile is.** A structured representation of a product's performance model: who it serves, how users progress, what defines success, and how value is captured. It is the output of Basesignal's analysis pipeline.

2. **Schema version.** Every profile carries a `basesignal_version` field (e.g., `"1.0"`). This field determines which schema version the profile conforms to. The versioning rules:
   - Minor bumps (1.0 -> 1.1): additive changes only (new optional fields, new enum values). Old profiles remain valid.
   - Major bumps (1.0 -> 2.0): breaking changes (removed fields, type changes, renames). Old profiles may not validate.

3. **Section overview table.** Lists all sections with their purpose, whether they are optional, and a link to the section doc.

4. **Complete example.** A full ProductProfile JSON for a realistic (but sanitized) product, with all sections populated. This is the most valuable part of the spec for new readers -- they can see the whole shape at once.

5. **Computed fields.** Explains `completeness` (fraction of sections populated, 0-1) and `overallConfidence` (weighted average confidence across populated sections, 0-1).

**Section overview table format:**

| Section | Type | Required | Description |
|---------|------|----------|-------------|
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

### Per-Section Document Format

Each section doc follows the same structure:

1. **Purpose** -- What this section represents and when it gets populated during analysis. One paragraph.

2. **Type definition** -- The TypeScript interface, copied from `@basesignal/core` with JSDoc comments preserved. TypeScript is used as the human-readable type notation because it is more accessible than JSON Schema for most developers.

3. **Field reference table** -- Every field listed with:
   - Name
   - Type
   - Required/Optional
   - Description (1-2 sentences)
   - Constraints (min/max, enum values, format)

4. **Example** -- A realistic JSON example for this section, from a sanitized real product analysis.

5. **Confidence scoring** -- How the `confidence` field is determined for this section. Each section has a confidence score (0-1) representing how certain the analysis engine is about the extracted data. Explains what drives confidence up or down.

6. **Evidence** -- How the `evidence` array works for this section. Every section includes source evidence linking extracted data to specific URLs and excerpts from crawled pages.

### Section Document Details

#### identity.md -- CoreIdentity

Fields: `productName`, `description`, `targetCustomer`, `businessModel`, `industry` (optional), `companyStage` (optional), `confidence`, `evidence`.

Example:
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

#### journey.md -- UserJourney

Fields: `stages` (array of `JourneyStage`), `confidence`, `evidence`.

Each stage has: `name`, `description`, `order`.

Documents the standard lifecycle stages that Basesignal identifies: from first touch through activation, core usage, expansion, and potential churn.

#### definitions.md -- DefinitionsMap

This is the most complex section because it contains two format variants for activation:

- **Legacy flat format** (`LifecycleDefinition`): A simple list of criteria strings.
- **Multi-level format** (`MultiLevelActivationDefinition`): Progressive activation levels with signal strengths, structured criteria, and per-level confidence.

Documents all five lifecycle states:
- `activation` -- when a user first derives value (union type)
- `firstValue` -- the specific moment of first value delivery
- `active` -- ongoing engagement criteria
- `atRisk` -- disengagement signals
- `churn` -- loss criteria

Each definition includes `criteria`, `timeWindow`, `reasoning`, `confidence`, `source`, and `evidence`.

The document explains how to distinguish between the two activation formats at runtime (presence of `levels` field indicates multi-level format).

#### entities.md -- EntityModel

Fields: `items` (array of `EntityItem`), `relationships` (array of `EntityRelationship`), `confidence`, `evidence`.

Entity items have: `name`, `type`, `properties` (string array).
Relationships have: `from`, `to`, `type`.

Documents the core data objects a product manages and their relationships. Examples: a project management tool has Projects, Issues, Teams, and Users with relationships like "Team has many Projects", "Project has many Issues".

#### metrics.md -- MetricsSection and OutcomesSection

These two sections are documented together because they are closely related:

**MetricsSection**: `items` (array of `MetricItem`), `confidence`, `evidence`.
MetricItem: `name`, `category` (reach/engagement/value_delivery/value_capture), `formula` (optional), `linkedTo`.

**OutcomesSection**: `items` (array of `OutcomeItem`), `confidence`, `evidence`.
OutcomeItem: `description`, `type`, `linkedFeatures`.

Explains how metrics map to the P&L framework layers (Reach, Engagement, Value Delivery, Value Capture) and how outcomes connect to specific product features.

#### revenue.md -- RevenueArchitecture

Fields: `model`, `billingUnit` (optional), `hasFreeTier`, `tiers` (array of `PricingTier`), `expansionPaths`, `contractionRisks`, `confidence`, `evidence`.

PricingTier: `name`, `price`, `features`.

Documents the revenue model detection: how Basesignal identifies pricing tiers, expansion paths (upsell/cross-sell vectors), and contraction risks (downgrade triggers).

### schema.json -- Machine-Readable Schema

This file is a copy (or symlink) of `packages/core/schema.json`, the JSON Schema Draft 2020-12 file generated from the Zod schemas by M008-E001-S004.

Placement in the specification directory makes it discoverable alongside the human-readable docs. The `$id` field in the schema already points to `https://basesignal.dev/schema/v1.0/product-profile.json`.

**Decision: copy, not symlink.** A copy is more portable and works in all environments (npm packages, GitHub rendering, documentation sites). The build step for the spec should copy from `packages/core/schema.json` to `docs/specification/v1.0/schema.json`. A CI check verifies the copy is not stale.

### schema.ts -- TypeScript Re-Export

A minimal file that re-exports the types from `@basesignal/core`:

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

### CHANGELOG.md

Tracks specification versions. For v1.0, this is a single entry:

```markdown
# Schema Specification Changelog

All notable changes to the Basesignal ProductProfile schema specification.

Versioning follows semver rules:
- **Minor** (1.0 -> 1.1): New optional fields or enum values. Existing profiles remain valid.
- **Major** (1.0 -> 2.0): Breaking changes. Existing profiles may not validate.

## v1.0 - 2026-02-XX

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

## Versioning Strategy

The spec versioning is tightly coupled to the `SCHEMA_VERSION` constant in `@basesignal/core`:

```
packages/core/src/version.ts   ← Source of truth: SCHEMA_VERSION = "1.0"
                                   │
docs/specification/v1.0/        ← Docs for that version
                                   │
docs/specification/CHANGELOG.md ← What changed between versions
```

**When a new version is released:**

1. The `SCHEMA_VERSION` constant in `packages/core/src/version.ts` is bumped.
2. A new `docs/specification/vX.Y/` directory is created with updated docs.
3. The CHANGELOG gets a new entry.
4. The old version directory remains unchanged (archived).

**For minor bumps (1.0 -> 1.1):**
- The v1.0 directory is NOT updated. A new v1.1 directory is created.
- The v1.1 docs inherit from v1.0 and note the additions.
- Alternatively, for small additive changes, v1.0 docs could be updated in-place with "[Added in v1.1]" annotations. This avoids directory proliferation for small changes.

**Recommended approach for minor bumps:** Update the existing version directory in-place with clear annotations. Only create a new directory for major versions. This keeps the directory tree manageable and avoids readers having to figure out which minor version to read.

```
docs/specification/
  v1/                   # Covers v1.0, v1.1, v1.2, etc.
    profile.md          # Annotated with "[v1.1]" for added fields
    ...
  v2/                   # Created only on major version bump
    ...
  CHANGELOG.md
```

**Decision: use `v1/` not `v1.0/`.** The directory covers the entire v1.x series. Minor version changes are annotated inline. This is simpler than the directory-per-minor approach described in the story acceptance criteria. However, the story specifies `v1.0/` -- so we follow the story's convention for now and can rename later if needed.

## Compatibility Guarantees

The specification documents these guarantees:

1. **Within a major version, profiles are forward-compatible.** A v1.0 profile validates against the v1.1 schema. New fields added in v1.1 are optional.

2. **Within a major version, the schema is backward-compatible.** The v1.1 schema accepts all valid v1.0 profiles. No required fields are added. No field types change. No fields are removed.

3. **Major versions make no compatibility promises.** A v1.x profile may not validate against v2.0. The `checkVersion()` utility in `@basesignal/core` returns `"incompatible"` when major versions differ.

4. **The `basesignal_version` field is always present.** Every valid ProductProfile includes this field. It is the only required string field besides `completeness` and `overallConfidence` (both numbers).

5. **Unknown fields are preserved, not rejected.** Validators use Zod's default behavior -- extra fields not in the schema are not cause for validation failure. This ensures forward compatibility when older code reads newer profiles.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Format | Markdown files | Readable everywhere: GitHub, editors, doc sites. No tooling required. |
| TypeScript as notation | Show TypeScript interfaces in docs, not JSON Schema | More readable for the target audience (product engineers). JSON Schema is available as `schema.json` for machine consumption. |
| One file per section | 6 section docs + 1 overview | Each section is self-contained. Readers can jump to the section they care about. |
| Metrics and Outcomes together | Combined in `metrics.md` | They are closely related in the P&L framework and are typically read together. |
| Schema.json as copy, not symlink | Copy with staleness CI check | More portable across platforms. Symlinks cause issues in npm packages and some git workflows. |
| Version directory per major only | `v1/` covers v1.0-v1.x, `v2/` for breaking changes | Avoids directory proliferation. Minor changes are annotated inline. |
| No per-section JSON Schema fragments | Full `schema.json` only | Eliminates synchronization problem. Section schemas can be extracted programmatically from the full schema if needed. |
| CHANGELOG is flat markdown | No structured changelog format | Simple. The audience is developers reading on GitHub. |
| Examples use realistic products | Sanitized but recognizable examples | Concrete examples are more useful than abstract placeholders. Using well-known products (Linear, Figma, etc.) makes the schema immediately understandable. |

## What This Does NOT Do

- **Does not create the `@basesignal/core` package.** That is M008-E001. This story depends on S004 (JSON Schema generation) being complete.
- **Does not define new types.** Every type documented in the specification already exists in `@basesignal/core`. The specification documents existing types; it does not introduce new ones.
- **Does not build a documentation site.** The spec is markdown files in the git repository. A VitePress/Docusaurus site is a future consideration.
- **Does not document pipeline types.** `LensCandidate`, `ValidatedCandidate`, `ConvergenceResult`, and other pipeline-internal types are not part of the specification. The spec covers only the ProductProfile and its sections -- the shape that external consumers read and write. Pipeline types are implementation details documented in `@basesignal/core`'s package README.
- **Does not document the MCP tools or CLI.** That is M008-E006-S002 (documentation site content). The spec is about the data model, not the tools that produce it.

## Implementation Notes

### Generating the Complete Example

The complete example in `profile.md` should be generated from a real Basesignal analysis, then sanitized. Steps:

1. Run a scan against a well-known product (e.g., Linear).
2. Export the resulting ProductProfile as JSON.
3. Validate it against `schema.json` to ensure it is spec-compliant.
4. Replace any sensitive data (actual pricing numbers if they have changed, etc.).
5. Embed in `profile.md` as a fenced JSON block.

### Evidence and Confidence Scoring Section

Each section doc includes a "Confidence Scoring" subsection. The general pattern:

- **High confidence (0.8-1.0):** Multiple corroborating evidence sources, data from official product pages.
- **Medium confidence (0.5-0.79):** Fewer sources, some inference from indirect signals.
- **Low confidence (0.0-0.49):** Single source, significant inference, or limited information.

The spec documents the general framework. Specific confidence calculation logic is implementation-specific and documented in `@basesignal/core`.

### Relationship to S002 (Documentation)

S002 creates general documentation (`getting-started.md`, `data-model.md`, etc.). S003 creates the formal specification. The `data-model.md` doc from S002 should link to the specification for detailed type definitions rather than duplicating them. The specification is the authoritative reference; `data-model.md` is the friendly introduction.

## Verification Steps

1. **`docs/specification/v1.0/profile.md` exists** and provides a complete overview of the ProductProfile structure, including the section overview table and a full JSON example.

2. **Individual section docs exist:** `identity.md`, `journey.md`, `definitions.md`, `entities.md`, `metrics.md`, `revenue.md`. Each contains purpose, TypeScript type definition, field reference table, and example.

3. **`docs/specification/v1.0/schema.json` validates test profiles.** Copy of `packages/core/schema.json`. A test loads both files and confirms they are identical.

4. **`docs/specification/v1.0/schema.ts` re-exports from `@basesignal/core`.** TypeScript compilation succeeds (`tsc --noEmit`).

5. **`docs/specification/CHANGELOG.md` documents v1.0.** Contains sections list, features, and date.

6. **Each section doc includes:** field descriptions, types, required vs. optional, and at least one example with realistic data.

## Success Criteria

- [ ] `docs/specification/v1.0/profile.md` provides complete ProductProfile overview
- [ ] Section docs exist: `identity.md`, `journey.md`, `definitions.md`, `entities.md`, `metrics.md`, `revenue.md`
- [ ] `docs/specification/v1.0/schema.json` is a valid JSON Schema that validates test profiles
- [ ] `docs/specification/v1.0/schema.ts` re-exports TypeScript types from `@basesignal/core`
- [ ] `docs/specification/CHANGELOG.md` documents the v1.0 release
- [ ] Each section doc includes field descriptions, types, required vs optional, and examples
