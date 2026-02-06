# Infer Entity Model from Product Content — Design

## Overview

Create `convex/analysis/extractEntities.ts` as an `internalAction` that fetches crawled pages (features, pricing, homepage, about), sends them to Claude Haiku in a single pass with labeled sections, and stores the entities section on the product profile.

## Problem Statement

After a website scan, crawled pages contain implicit information about a product's data model — what objects exist, how they relate, and which one drives billing. This extractor infers that entity model from marketing copy and pricing structure.

## Expert Perspectives

### Technical
- Single-pass with labeled page sections is the right approach — entity extraction is a cross-referencing problem (can't classify "billable" without seeing features + pricing together)
- Two-pass alternative rejected: doubles cost, classification pass still needs features context
- Follows established S001/S002 pattern

### Simplification Review
- Removed confidence threshold magic numbers (let LLM assign, validate post-hoc)
- Removed JSON parsing details from design (implementation concern)
- Tightened entity type definitions
- Added explicit dependency on S001 for shared internal functions

## Proposed Solution

```
extractEntities (internalAction)
  ├── ctx.runQuery(internal.crawledPages.listByProductInternal, { productId })
  │     → filter to pageType in ["features", "pricing", "homepage", "about"]
  │     → label each section by page type in prompt
  ├── Claude Haiku API call (single pass)
  │     → system prompt: JSON schema + entity type definitions + relationship rules
  │     → user prompt: labeled, truncated page content (~25KB each)
  └── ctx.runMutation(internal.productProfiles.updateSectionInternal, ...)
        → patches profile with section="entities", recalculates completeness
```

## Design Details

### Files

| File | Change |
|------|--------|
| `convex/analysis/extractEntities.ts` | New internalAction |
| `convex/crawledPages.ts` | Reuses `listByProductInternal` from S001 |
| `convex/productProfiles.ts` | Reuses `updateSectionInternal` from S001 |

**Dependency:** Requires `listByProductInternal` and `updateSectionInternal` to be implemented (part of S001 design).

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pass count | Single pass, labeled sections | Cross-referencing problem; billing classification needs features + pricing together |
| Page types | features, pricing, homepage, about | All four contribute different signals to entity inference |
| Model | Claude Haiku | Pattern matching, consistent with S001/S002 |
| Entity types | billable, value, supporting | Required by AC; maps to billing, user value, and organizational |
| Relationships | has_many, belongs_to, has_one, many_to_many | Standard cardinality; inferred from feature descriptions |
| Evidence | Flat `[{ url, excerpt }]` | Matches existing schema |
| Confidence | LLM-assigned 0-1 | General guidance in prompt, no hardcoded thresholds |

### Entity Type Definitions

- **billable**: The entity that maps to the pricing page's billing unit. "Per seat" → User is billable. "Per project" → Project is billable. At most one entity should be billable (zero if billing unit is unclear or no pricing page).
- **value**: Entities users create or interact with as the core of the product — the things that deliver the product's main value. Examples: Document, Board, Campaign, Dashboard.
- **supporting**: Entities that organize or enable value entities but aren't the product's core objects. Examples: Workspace, Team, Folder, Tag.

### Output Schema

```typescript
{
  items: [{ name: string, type: "billable"|"value"|"supporting", properties: string[] }],
  relationships: [{ from: string, to: string, type: "has_many"|"belongs_to"|"has_one"|"many_to_many" }],
  confidence: number,
  evidence: [{ url: string, excerpt: string }]
}
```

### Error Handling

Throw on: no pages found, unparseable JSON, missing profile. No retries — caller responsible.

## Alternatives Considered

- **Two-pass (extract then classify)**: Rejected — doubles cost, classification pass still needs features context to disambiguate.
- **Enrichment after S002 (revenue)**: Rejected — orchestrator (S007) runs entities in parallel with revenue, so revenue results aren't available.
- **Including docs/blog pages**: Rejected — features/pricing/homepage/about are sufficient for entity inference.

## Success Criteria

- Extracts entities with types and properties from crawled pages
- Infers relationships between entities
- Billing unit from pricing correctly identifies billable entity
- Evidence links claims to specific page content
- Stores via updateSectionInternal, completeness recalculates
- Works as part of the analysis pipeline (called by orchestrator S007)
